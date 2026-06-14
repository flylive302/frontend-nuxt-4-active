/**
 * Slide overlap engine — pure, framework-agnostic.
 *
 * Buckets triggered slides by **vertical-band collision** so overlapping slides
 * queue and play sequentially while disjoint bands play concurrently. This is
 * the isolation boundary the PRD calls for (mirrors `utils/playlist-queue.ts`):
 * **no Vue reactivity, no Web Audio, no socket/DOM dependencies** — just data
 * and operations, fully unit-testable. The composable owns the wall clock (it
 * passes `now` into every mutator) and the TTL tick cadence; the store mirrors
 * `playing` for rendering. See ADR 0009 (unified slide overlay system).
 *
 * Documented boundary semantics:
 * - **Collision (concurrency)**: two slides collide when their bands
 *   `[top, top+height]` intersect (touching edges are disjoint). A new slide
 *   plays immediately only if it collides with no playing slide and the global
 *   cap allows; otherwise it waits.
 * - **Band identity (queue / cap / priority)**: items with the same
 *   `top:height` share a band queue. Within it, higher priority sits at the
 *   head and the per-band depth cap drops the oldest low-priority item.
 * - **Priority**: a higher-priority slide (`priority > 0`) jumps to its band's
 *   head and is exempt from depth-drop and TTL, but **never interrupts** a
 *   playing slide — it plays when the band frees on completion.
 * - **Freshness TTL**: a non-exempt waiter older than `ttlMs` is expired on
 *   `tick(now)` (and skipped during promotion) and never plays.
 * - **Combo-coalesce**: a repeated `(slideId, senderId, recipientId)` within
 *   `coalesceWindowMs` collapses into the existing item with an incremented
 *   `count`, keeping its `instanceId` stable so the SVGA never remounts.
 */
import type { SlidePlayPayload, SlideScope } from '~/types/slide';

/** Injected, tunable back-pressure limits (defaults live in `constants/room.ts`). */
export interface SlideQueueConfig {
  /** Non-exempt waiters older than this (ms) are expired and never play. */
  ttlMs: number;
  /** Max queued items per band before the oldest low-priority item is dropped. */
  perBandDepth: number;
  /** Max slides playing concurrently across all bands. */
  globalCap: number;
  /** Repeated identical triggers within this window (ms) coalesce into one item. */
  coalesceWindowMs: number;
}

/** The wire payload plus the trigger identity the queue coalesces on. */
export interface SlideEnqueueInput extends SlidePlayPayload {
  /** Trigger user (e.g. gift sender). Part of the coalesce key. */
  senderId: number | null;
  /**
   * Trigger recipient. Part of the coalesce key. Currently always `null` — the
   * S1 wire payload carries no recipient id; the backend resolver supplies it in
   * a later slice (documented gap, ADR 0009). Until then coalesce is effectively
   * **sender-scoped**: one sender firing within the window collapses into a
   * single banner (showing the first send's resolved text) with a count, even if
   * the sends targeted different recipients.
   */
  recipientId: number | null;
}

/** An enqueued item: the input plus queue bookkeeping. Assignable to `ActiveSlide`. */
export interface QueuedSlide extends SlideEnqueueInput {
  instanceId: string;
  /** Coalesced send count (1 for a lone slide). */
  count: number;
  /** When the item first entered the queue (drives TTL). */
  enqueuedAt: number;
  /** When the item was last (re)triggered (drives the sliding coalesce window). */
  lastSeenAt: number;
}

/** Module-level monotonic counter — guarantees instance ids are unique across instances. */
let slideIdCounter = 0;

/** Two bands collide when their `[top, top+height]` intervals overlap (edges disjoint). */
function bandsIntersect(a: SlideEnqueueInput, b: SlideEnqueueInput): boolean {
  return a.top < b.top + b.height && b.top < a.top + a.height;
}

/** Exact band identity used for queue grouping, depth cap and priority ordering. */
function bandKey(item: SlideEnqueueInput): string {
  return `${item.top}:${item.height}`;
}

/** Higher-priority slides are exempt from depth-drop and TTL expiry. */
function isExempt(item: QueuedSlide): boolean {
  return item.priority > 0;
}

/** Same trigger identity → candidates for combo-coalesce. */
function sameTrigger(a: QueuedSlide, b: SlideEnqueueInput): boolean {
  return a.slideId === b.slideId && a.senderId === b.senderId && a.recipientId === b.recipientId;
}

export class SlideQueue {
  /** Currently on-screen slides, in play order. Never exposed by reference. */
  private readonly playingItems: QueuedSlide[] = [];

  /** Waiting slides (insertion order); band order is derived on demand. */
  private readonly waitingItems: QueuedSlide[] = [];

  constructor(private readonly config: SlideQueueConfig) {}

  /** Read-only snapshot of the playing set (what the store mirrors). */
  get playing(): readonly QueuedSlide[] {
    return this.playingItems.slice();
  }

  /** Read-only snapshot of the waiting set (primarily for tests/inspection). */
  get waiting(): readonly QueuedSlide[] {
    return this.waitingItems.slice();
  }

  /**
   * Admit a triggered slide. Repeated triggers within the coalesce window fold
   * into the existing item (count++). Otherwise the slide plays immediately when
   * its band is free and the global cap allows, else it waits in its band's
   * queue (priority-ordered, depth-capped). Returns the new playing snapshot.
   */
  enqueue(input: SlideEnqueueInput, now: number): readonly QueuedSlide[] {
    // Combo-coalesce: a recent identical trigger absorbs this one.
    const existing = this.findCoalesceTarget(input, now);
    if (existing) {
      existing.count += 1;
      existing.lastSeenAt = now;
      return this.playing;
    }

    const item: QueuedSlide = {
      ...input,
      instanceId: `slide-${input.slideId}-${++slideIdCounter}`,
      count: 1,
      enqueuedAt: now,
      lastSeenAt: now,
    };

    if (this.canPlayNow(item)) {
      this.playingItems.push(item);
    } else {
      this.waitingItems.push(item);
      this.enforceDepthCap(bandKey(item));
    }

    return this.playing;
  }

  /**
   * Mark a playing slide finished, freeing its band, then promote as many
   * waiting slides as the cap and band collisions allow. Stale non-exempt
   * waiters encountered are dropped. Unknown ids are an idempotent no-op.
   * Returns the new playing snapshot.
   */
  onComplete(instanceId: string, now: number): readonly QueuedSlide[] {
    const at = this.playingItems.findIndex((s) => s.instanceId === instanceId);
    if (at === -1) return this.playing;

    this.playingItems.splice(at, 1);
    this.promote(now);
    return this.playing;
  }

  /**
   * Expire non-exempt waiters older than the TTL. Expiry only removes waiting
   * items (it never frees a band), so the playing set is unchanged — callers do
   * not need to re-render after a tick.
   */
  tick(now: number): void {
    for (let i = this.waitingItems.length - 1; i >= 0; i--) {
      const item = this.waitingItems[i] as QueuedSlide;
      if (!isExempt(item) && now - item.enqueuedAt > this.config.ttlMs) {
        this.waitingItems.splice(i, 1);
      }
    }
  }

  /** Drop everything (e.g. teardown). */
  clear(): void {
    this.playingItems.length = 0;
    this.waitingItems.length = 0;
  }

  /**
   * Drop every playing + waiting slide of the given scope, then promote eligible
   * remaining waiters into any band the removed slides freed. Scope-selective
   * teardown; the room-leave path uses `clear()` (all scopes) since no slide
   * outlives a room. Returns the new playing snapshot.
   */
  clearScope(scope: SlideScope, now: number): readonly QueuedSlide[] {
    for (let i = this.waitingItems.length - 1; i >= 0; i--) {
      if ((this.waitingItems[i] as QueuedSlide).scope === scope) this.waitingItems.splice(i, 1);
    }
    for (let i = this.playingItems.length - 1; i >= 0; i--) {
      if ((this.playingItems[i] as QueuedSlide).scope === scope) this.playingItems.splice(i, 1);
    }
    this.promote(now);
    return this.playing;
  }

  // ---- helpers ----

  private findCoalesceTarget(input: SlideEnqueueInput, now: number): QueuedSlide | null {
    const within = (s: QueuedSlide) =>
      sameTrigger(s, input) && now - s.lastSeenAt <= this.config.coalesceWindowMs;
    return this.playingItems.find(within) ?? this.waitingItems.find(within) ?? null;
  }

  /** A slide may play now if the cap allows and no playing band collides with it. */
  private canPlayNow(item: QueuedSlide): boolean {
    if (this.playingItems.length >= this.config.globalCap) return false;
    return !this.playingItems.some((p) => bandsIntersect(p, item));
  }

  /**
   * Promote waiting slides into the playing set, best-first (highest priority,
   * then oldest), each disjoint from all playing bands, until the cap is hit or
   * none remain eligible. Drops stale non-exempt waiters along the way.
   */
  private promote(now: number): void {
    while (this.playingItems.length < this.config.globalCap) {
      const next = this.takeNextEligible(now);
      if (!next) break;
      this.playingItems.push(next);
    }
  }

  /** Remove and return the best eligible waiter, dropping stale ones in passing. */
  private takeNextEligible(now: number): QueuedSlide | null {
    let bestIndex = -1;
    let best: QueuedSlide | null = null;

    for (let i = 0; i < this.waitingItems.length; i++) {
      const item = this.waitingItems[i] as QueuedSlide;

      // Drop stale non-exempt waiters as we scan.
      if (!isExempt(item) && now - item.enqueuedAt > this.config.ttlMs) {
        this.waitingItems.splice(i, 1);
        i--;
        continue;
      }

      // Eligible only if its band collides with nothing currently playing.
      if (this.playingItems.some((p) => bandsIntersect(p, item))) continue;

      if (best === null || this.outranks(item, best)) {
        best = item;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) return null;
    return this.waitingItems.splice(bestIndex, 1)[0] as QueuedSlide;
  }

  /** Queue order: higher priority first, then oldest (FIFO) within equal priority. */
  private outranks(a: QueuedSlide, b: QueuedSlide): boolean {
    if (a.priority !== b.priority) return a.priority > b.priority;
    return a.enqueuedAt < b.enqueuedAt;
  }

  /**
   * Trim a band's waiting queue down to the depth cap by dropping the
   * lowest-priority, then oldest, **non-exempt** item. Exempt (high-priority)
   * items are never dropped, so a band of only exempt items may exceed the cap.
   */
  private enforceDepthCap(key: string): void {
    while (this.bandCount(key) > this.config.perBandDepth) {
      const victim = this.dropCandidate(key);
      if (victim === -1) break; // only exempt items remain — leave them.
      this.waitingItems.splice(victim, 1);
    }
  }

  private bandCount(key: string): number {
    return this.waitingItems.reduce((n, s) => (bandKey(s) === key ? n + 1 : n), 0);
  }

  /** Index of the oldest lowest-priority non-exempt item in the band, or -1. */
  private dropCandidate(key: string): number {
    let index = -1;
    let worst: QueuedSlide | null = null;

    for (let i = 0; i < this.waitingItems.length; i++) {
      const item = this.waitingItems[i] as QueuedSlide;
      if (bandKey(item) !== key || isExempt(item)) continue;

      // "Worst" = lowest priority, then oldest (earliest enqueued).
      const worseThanBest =
        worst === null ||
        item.priority < worst.priority ||
        (item.priority === worst.priority && item.enqueuedAt < worst.enqueuedAt);

      if (worseThanBest) {
        worst = item;
        index = i;
      }
    }

    return index;
  }
}
