/**
 * Frame Animation Budget (room-battery-perf/02)
 *
 * Pure decision module: given the current roster of occupied seats with an
 * EQUIPPED frame plus the active-speaker set, decide which seats may run a
 * live animated SVGA frame this tick. Everything else falls back to the
 * cached still-frame (`staticFrame` on UserAvatar).
 *
 * Rules:
 *  - Hard cap on concurrently animated frames, passed to every `compute()`
 *    call because it changes at runtime (device tier × user switch —
 *    `utils/frame-animation-tier.ts`, android-client-performance/16). A cap
 *    of 0 admits nobody: every seat shows its cached still frame.
 *    android-client-performance/14: measured 2026-09-23 on Oppo A6x — 13 live
 *    SVGA canvases put the main thread at 96% busy; speakers keep priority.
 *  - Active speakers are admitted first (seat-index order among speakers).
 *  - Remaining slots: seats that were ALREADY animating keep their slot
 *    (stability — an unrelated seat joining/leaving or an unrelated speaker
 *    change never evicts an unaffected animating seat), then free slots fill
 *    in seat-index order.
 *
 * Deliberately framework-free: no Vue reactivity, no DOM, no timers. The
 * only state is the previous selection, kept for the no-thrash guarantee.
 * `compute()` is idempotent for an unchanged roster.
 */
export interface EligibleFrameSeat {
  /** 0-based seat index. */
  seatIndex: number;
  /** Whether this seat's occupant is currently an active speaker. */
  isSpeaker: boolean;
}

export interface FrameAnimationBudget {
  /**
   * Decide the set of seat indices allowed to animate, given every occupied
   * seat that has an equipped frame and the cap in force for this tick.
   * Returns a new Set on every call.
   */
  compute(eligible: readonly EligibleFrameSeat[], cap: number): ReadonlySet<number>;
  /** Forget the previous selection (e.g. on room leave). */
  reset(): void;
  /**
   * How many seats the last `compute()` allowed. Read-only measurement hook for
   * `services/stallMonitor.ts`; never recomputes, because `compute()` writes the
   * no-thrash memory and an instrument must not alter what it measures.
   */
  readonly activeCount: number;
}

export function createFrameAnimationBudget(): FrameAnimationBudget {
  let previous = new Set<number>();

  return {
    compute(eligible: readonly EligibleFrameSeat[], cap: number): ReadonlySet<number> {
      if (cap <= 0) {
        previous = new Set<number>();
        return previous;
      }

      const byIndex = [...eligible].sort((a, b) => a.seatIndex - b.seatIndex);
      const next = new Set<number>();

      // 1. Speakers first (seat-index order among speakers).
      for (const seat of byIndex) {
        if (next.size >= cap) break;
        if (seat.isSpeaker) next.add(seat.seatIndex);
      }

      // 2. Stability: still-eligible seats that were already animating keep
      //    their slot ahead of newcomers.
      for (const seat of byIndex) {
        if (next.size >= cap) break;
        if (previous.has(seat.seatIndex)) next.add(seat.seatIndex);
      }

      // 3. Fill any remaining slots in seat-index order.
      for (const seat of byIndex) {
        if (next.size >= cap) break;
        next.add(seat.seatIndex);
      }

      previous = next;
      return next;
    },

    reset(): void {
      previous = new Set<number>();
    },

    get activeCount(): number {
      return previous.size;
    },
  };
}
