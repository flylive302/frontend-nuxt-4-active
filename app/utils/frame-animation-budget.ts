/**
 * Frame Animation Budget (room-battery-perf/02)
 *
 * Pure decision module: given the current roster of occupied seats with an
 * EQUIPPED frame plus the active-speaker set, decide which seats may run a
 * live animated SVGA frame this tick. Everything else falls back to the
 * cached still-frame (`staticFrame` on UserAvatar).
 *
 * Rules:
 *  - Hard cap (default FRAME_ANIMATION_BUDGET = 15) on concurrently animated
 *    frames.
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
import { FRAME_ANIMATION_BUDGET } from '~/constants/room';

export interface EligibleFrameSeat {
  /** 0-based seat index. */
  seatIndex: number;
  /** Whether this seat's occupant is currently an active speaker. */
  isSpeaker: boolean;
}

export interface FrameAnimationBudget {
  /**
   * Decide the set of seat indices allowed to animate, given every occupied
   * seat that has an equipped frame. Returns a new Set on every call.
   */
  compute(eligible: readonly EligibleFrameSeat[]): ReadonlySet<number>;
  /** Forget the previous selection (e.g. on room leave). */
  reset(): void;
}

export function createFrameAnimationBudget(
  cap: number = FRAME_ANIMATION_BUDGET,
): FrameAnimationBudget {
  let previous = new Set<number>();

  return {
    compute(eligible: readonly EligibleFrameSeat[]): ReadonlySet<number> {
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
  };
}
