/**
 * Lucky fly renderer — draws every lucky gift fly on ONE 2D canvas.
 *
 * Why: a lucky combo fans out one fly per recipient per tap. As individual
 * <img> elements with Web Animations, a 500-tap burst meant ~1,500 DOM nodes,
 * compositor layers and forced layouts, which jammed low-end phones long
 * enough to miss the socket heartbeat. Here a fly is a plain object; a frame
 * is a loop of `drawImage` calls.
 *
 * Worker-ready: this class touches only a 2D context, `CanvasImageSource`s
 * and numbers. Hand it an `OffscreenCanvas` context plus a fetch-based image
 * loader and it runs unchanged inside a Web Worker (the planned "B flip").
 * It must never import Vue, stores, or query the DOM.
 */
import {
  buildFlyTimeline,
  launchIntervalMs,
  parseEasing,
  sampleFly,
  type FlyPath,
  type FlyTimeline,
} from '~/utils/lucky-fly-path';

type Fly2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Resolves a thumbnail URL to something `drawImage` accepts. */
export type FlyImageLoader = (url: string) => Promise<CanvasImageSource>;

export interface LuckyFlyRendererOptions {
  readonly ctx: Fly2DContext;
  readonly loadImage: FlyImageLoader;
  /** Thumbnail box size in CSS px (drawn centred on the path point). */
  readonly thumbnailSize: number;
  readonly durationMs: number;
  readonly holdMs: number;
  readonly easing: string;
  readonly staggerMs: number;
  readonly maxStreamMs: number;
  readonly jitterPx: number;
  /**
   * gift-backlog-and-lag 01 — a pending fly older than this at launch time is
   * dropped (the loop was stalled: hidden tab / backgrounded app). Omit or
   * `Infinity` = never drop.
   */
  readonly maxAgeMs?: number;
  /** Frame gap above which a frame counts as slow (fold trigger). */
  readonly slowFrameMs?: number;
  /** Consecutive slow frames before folding starts. */
  readonly slowFramesToFold?: number;
  /** In-flight count at or above which folding starts regardless of frame rate. */
  readonly foldActiveThreshold?: number;
}

export interface FlyRequest {
  readonly thumbnailUrl: string;
  readonly path: FlyPath;
}

interface ActiveFly {
  readonly url: string;
  readonly timeline: FlyTimeline;
  readonly startedAt: number;
  /** > 1 when several identical flies were folded into this one (drawn as "×N"). */
  readonly count: number;
}

/** One queued batch item: `count` identical flies, expanded (or folded) at launch. */
interface PendingEntry {
  readonly request: FlyRequest;
  count: number;
  /** Renderer-clock time it was queued; NaN = unknown, never considered stale. */
  readonly queuedAt: number;
}

const CLEAR_RESERVE_PX = 8;
/**
 * Distinct thumbnails held at once. A room sees a handful of lucky gifts, but
 * the cache used to live for the whole session with no ceiling — and an
 * `ImageBitmap` holds a real GPU/heap allocation until it is closed.
 */
const MAX_CACHED_IMAGES = 24;
const BADGE_FONT_PX = 13;

export class LuckyFlyRenderer {
  private readonly ctx: Fly2DContext;
  private readonly loadImage: FlyImageLoader;
  private readonly opts: LuckyFlyRendererOptions;
  private readonly ease: (t: number) => number;
  private readonly images = new Map<string, CanvasImageSource>();
  private readonly loading = new Set<string>();
  private readonly pending: PendingEntry[] = [];
  /**
   * Running total of `pending[].count`. Kept incrementally because `enqueue`
   * reads it on every call — walking `pending` there made a 500-tap burst
   * O(n²).
   */
  private pendingCount = 0;
  private active: ActiveFly[] = [];
  private lastLaunchAt = -Infinity;
  /** Last frame time while the loop was running; -1 while idle (no work). */
  private lastTickAt = -1;
  /** Consecutive slow frames, saturating at `slowFramesToFold`. */
  private slowFrames = 0;
  /** Diagnostics/tests: flies dropped as stale, flies folded into a badge. */
  private droppedStale = 0;
  private folded = 0;
  /** Current launch gap. Shrinks as a burst's backlog grows; resets when drained. */
  private burstInterval: number;
  private width = 0;
  private height = 0;
  private dpr = 1;

  constructor(opts: LuckyFlyRendererOptions) {
    this.ctx = opts.ctx;
    this.loadImage = opts.loadImage;
    this.opts = opts;
    this.ease = parseEasing(opts.easing);
    this.burstInterval = opts.staggerMs;
  }

  /** CSS-pixel viewport size; the backing store is scaled by `dpr`. */
  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.ctx.canvas.width = Math.round(width * dpr);
    this.ctx.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * Queue a fly, or `count` identical flies (gift-authority-tick-fanout
   * ticket 15 — a batch item folds N merged taps into one request). Never
   * rejects and introduces no concurrency cap: every copy is paced through
   * the same `pending`/`tick` stream. Two exceptions, both gift-backlog-and-lag
   * 01: a copy still queued after `maxAgeMs` is dropped as stale (the loop
   * was stalled, nobody was watching), and under frame pressure the `count`
   * copies launch as ONE fly with a "×N" badge (folded, never dropped).
   *
   * @param queuedAt - Renderer-clock time (same clock as `tick`) the fly was
   *   queued. Omit when the caller has no clock — it is then never stale.
   */
  enqueue(request: FlyRequest, count = 1, queuedAt = Number.NaN): void {
    if (count <= 0) return;
    this.pending.push({ request, count, queuedAt });
    this.pendingCount += count;
    // Compress for the whole burst, sized by its peak backlog — recomputing
    // per remaining item would stretch the tail back out past the budget.
    this.burstInterval = Math.min(
      this.burstInterval,
      launchIntervalMs(this.queued, this.opts.staggerMs, this.opts.maxStreamMs),
    );
    this.ensureImage(request.thumbnailUrl);
  }

  /** True while there is anything to launch or draw. */
  hasWork(): boolean {
    return this.pending.length > 0 || this.active.length > 0;
  }

  /** Backlog count in flies (a folded entry counts once per copy). */
  get queued(): number {
    return this.pendingCount;
  }

  get inFlight(): number {
    return this.active.length;
  }

  /** Flies dropped as stale since construction (diagnostics/tests). */
  get droppedStaleCount(): number {
    return this.droppedStale;
  }

  /** Flies folded into a "×N" badge since construction (diagnostics/tests). */
  get foldedCount(): number {
    return this.folded;
  }

  /**
   * Advance to `now` (ms, monotonic) and redraw. Launches as many pending
   * flies as the compressed stagger allows, retires finished ones, draws the
   * rest. Returns `hasWork()` so the caller can stop its frame loop.
   */
  tick(now: number): boolean {
    this.observeFrameGap(now);
    this.launchDue(now);
    this.ctx.clearRect(-CLEAR_RESERVE_PX, -CLEAR_RESERVE_PX, this.width + CLEAR_RESERVE_PX * 2, this.height + CLEAR_RESERVE_PX * 2);

    const size = this.opts.thumbnailSize;
    const survivors: ActiveFly[] = [];
    for (const fly of this.active) {
      const elapsed = now - fly.startedAt;
      if (elapsed >= fly.timeline.totalMs) continue;
      survivors.push(fly);
      const image = this.images.get(fly.url);
      if (!image) continue;
      const s = sampleFly(fly.timeline, elapsed, this.ease);
      if (s.opacity <= 0) continue;
      const drawSize = size * s.scale;
      this.ctx.globalAlpha = s.opacity;
      this.ctx.drawImage(image, s.x - drawSize / 2, s.y - drawSize / 2, drawSize, drawSize);
      if (fly.count > 1) this.drawBadge(fly.count, s.x + drawSize / 2, s.y - drawSize / 2);
    }
    this.ctx.globalAlpha = 1;
    this.active = survivors;
    const more = this.hasWork();
    this.lastTickAt = more ? now : -1;
    if (!more) this.slowFrames = 0;
    return more;
  }

  /** Drop everything (component unmount, or the viewer went away). */
  clear(): void {
    this.pending.length = 0;
    this.pendingCount = 0;
    this.active = [];
    this.burstInterval = this.opts.staggerMs;
    this.lastTickAt = -1;
    this.slowFrames = 0;
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * Permanent teardown (component unmount). `clear()` keeps decoded thumbnails
   * so a later burst in the same room starts warm; this frees them.
   */
  destroy(): void {
    this.clear();
    for (const image of this.images.values()) this.disposeImage(image);
    this.images.clear();
    this.loading.clear();
  }

  /** True while frames are being missed or too many flies are in flight. */
  private underPressure(): boolean {
    const toFold = this.opts.slowFramesToFold ?? Infinity;
    const activeCap = this.opts.foldActiveThreshold ?? Infinity;
    return this.slowFrames >= toFold || this.active.length >= activeCap;
  }

  private observeFrameGap(now: number): void {
    const slowMs = this.opts.slowFrameMs;
    if (slowMs === undefined || this.lastTickAt < 0) return;
    const toFold = this.opts.slowFramesToFold ?? Infinity;
    this.slowFrames = now - this.lastTickAt > slowMs
      ? Math.min(this.slowFrames + 1, Number.isFinite(toFold) ? toFold : this.slowFrames + 1)
      : Math.max(this.slowFrames - 1, 0);
  }

  private launchDue(now: number): void {
    const interval = this.burstInterval;
    const maxAge = this.opts.maxAgeMs ?? Infinity;
    while (this.pending.length > 0) {
      const entry = this.pending[0]!;
      // Stale: queued while the loop was stalled. Nobody saw the gap, so
      // replaying it now would be the "pile" — drop, do not launch.
      if (Number.isFinite(entry.queuedAt) && now - entry.queuedAt > maxAge) {
        this.pending.shift();
        this.pendingCount -= entry.count;
        this.droppedStale += entry.count;
        continue;
      }
      const due = this.lastLaunchAt + interval;
      if (due > now) break;
      // Virtual launch clock: catch up at most one interval behind `now`, so a
      // sub-frame interval launches several per frame but never snowballs.
      this.lastLaunchAt = Number.isFinite(this.lastLaunchAt) ? Math.max(due, now - interval) : now;

      let count = 1;
      if (entry.count > 1 && this.underPressure()) {
        count = entry.count;
        this.folded += count - 1;
        this.pendingCount -= count;
        this.pending.shift();
      } else {
        this.pendingCount -= 1;
        if (--entry.count <= 0) this.pending.shift();
      }
      this.active.push({
        url: entry.request.thumbnailUrl,
        timeline: buildFlyTimeline(this.jitter(entry.request.path), this.opts.durationMs, this.opts.holdMs),
        startedAt: now,
        count,
      });
    }
    if (this.pending.length === 0) this.burstInterval = this.opts.staggerMs;
  }

  /** "×N" pill at the fly's top-right corner. */
  private drawBadge(count: number, x: number, y: number): void {
    const ctx = this.ctx;
    const label = `×${count}`;
    ctx.font = `bold ${BADGE_FONT_PX}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(label, x, y);
    ctx.fillStyle = '#ffd54a';
    ctx.fillText(label, x, y);
  }

  private jitter(path: FlyPath): FlyPath {
    const j = this.opts.jitterPx;
    if (j <= 0) return path;
    const off = (): number => (Math.random() * 2 - 1) * j;
    return {
      start: path.start,
      center: { x: path.center.x + off(), y: path.center.y + off() },
      end: { x: path.end.x + off() * 0.5, y: path.end.y + off() * 0.5 },
    };
  }

  /** Release a decoded source. Only `ImageBitmap` owns memory we must free. */
  private disposeImage(image: CanvasImageSource): void {
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
  }

  /** Evict least-recently-inserted entries down to the cap (Map keeps order). */
  private trimImages(): void {
    while (this.images.size > MAX_CACHED_IMAGES) {
      const oldest = this.images.keys().next();
      if (oldest.done) return;
      const image = this.images.get(oldest.value);
      this.images.delete(oldest.value);
      if (image) this.disposeImage(image);
    }
  }

  private ensureImage(url: string): void {
    if (this.images.has(url) || this.loading.has(url)) return;
    this.loading.add(url);
    this.loadImage(url)
      .then((image) => {
        this.images.set(url, image);
        this.trimImages();
      })
      .catch(() => {
        /* REACT: a missing thumbnail just draws nothing — the fly still paces the stream */
      })
      .finally(() => {
        this.loading.delete(url);
      });
  }
}
