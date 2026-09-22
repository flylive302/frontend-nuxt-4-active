/**
 * useFrameAnimationBudget (room-battery-perf/02, android-client-performance/16)
 *
 * Shared consumer of the pure `createFrameAnimationBudget` module: derives
 * the eligible roster (occupied seats with an equipped frame + speaker flag)
 * from the seats store, the cap in force from the device tier × the user's
 * `animatedAvatarFrames` switch (`utils/frame-animation-tier.ts`), and
 * exposes a per-seat "may this seat animate its frame?" query for `RoomSeat`
 * plus the switch for the room settings drawer.
 *
 * One budget + one derived computed for the whole app (every seat component
 * must consult the SAME selection, and the budget's no-thrash memory must be
 * shared), lazily created on first use inside a setup context.
 */
import { effectScope, type ComputedRef } from 'vue';
import { createFrameAnimationBudget } from '~/utils/frame-animation-budget';
import {
  readFrameAnimationTier,
  resolveFrameAnimationCap,
} from '~/utils/frame-animation-tier';

const budget = createFrameAnimationBudget();
let allowedSeats: ComputedRef<ReadonlySet<number>> | null = null;
let frameAnimationCap: ComputedRef<number> | null = null;

export function useFrameAnimationBudget() {
  if (!allowedSeats || !frameAnimationCap) {
    const seatsStore = useRoomSeatsStore();
    const roomStore = useRoomStore();
    const fxPrefs = useFxPreferencesStore();
    const { resolvePropAsset } = usePropLookup();

    // Hardware does not change for the life of the page; read it once.
    const tier = readFrameAnimationTier();

    // Room the budget's no-thrash memory belongs to. Seat indices are reused
    // across rooms, so the memory must not leak into the next room.
    let budgetRoomId: number | null = null;

    // Detached scope: the computed must outlive the first seat component that
    // happened to create it — never tie it to that component's effectScope.
    const scope = effectScope(true);
    frameAnimationCap = scope.run(() =>
      computed(() => resolveFrameAnimationCap(fxPrefs.animatedAvatarFrames, tier)),
    )!;
    const cap = frameAnimationCap;
    allowedSeats = scope.run(() =>
      computed(() => {
        const roomId = roomStore.currentRoom?.id ?? null;
        if (roomId !== budgetRoomId) {
          budget.reset();
          budgetRoomId = roomId;
        }
        const eligible = seatsStore.seatsWithUsers.flatMap((seat, seatIndex) => {
          const frameId = seat.user?.frame_id;
          if (frameId == null || resolvePropAsset(frameId) == null) return [];
          return [{ seatIndex, isSpeaker: seat.isActive }];
        });
        return budget.compute(eligible, cap.value);
      }),
    )!;
  }

  const allowed = allowedSeats;
  const cap = frameAnimationCap;
  const fxPrefs = useFxPreferencesStore();

  /** Whether any seat may animate on this device right now (tier × switch). */
  const frameAnimationEnabled = computed(() => cap.value > 0);

  return {
    /** Whether the given 0-based seat index may run a live animated frame. */
    isFrameAnimationAllowed: (seatIndex: number): boolean =>
      allowed.value.has(seatIndex),
    frameAnimationEnabled,
    /**
     * Flip the user switch against the EFFECTIVE state: a user on a still-by-
     * default phone who taps "Frames" gets `on`; one seeing animation gets
     * `off`. `auto` is only ever the untouched default.
     */
    toggleFrameAnimation: (): void => {
      fxPrefs.setAnimatedAvatarFrames(frameAnimationEnabled.value ? 'off' : 'on');
    },
  };
}

/**
 * How many seats the last budget pass allowed a live animated frame.
 *
 * Read-only measurement hook for `services/stallMonitor.ts`, which samples what
 * work was active when the main thread stalled. Reads the budget's own memory
 * rather than `allowedSeats.value`: touching the computed could force an early
 * re-evaluation, and `compute()` writes the no-thrash memory — so reading it
 * would change which seats animate next. An instrument must not move its own
 * subject.
 */
export function activeFrameAnimationCount(): number {
  return budget.activeCount;
}

/** Test-only: drop the shared computed + budget memory between cases. */
export function __resetFrameAnimationBudgetForTest(): void {
  allowedSeats = null;
  frameAnimationCap = null;
  budget.reset();
}
