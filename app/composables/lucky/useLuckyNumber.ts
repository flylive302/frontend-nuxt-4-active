/**
 * Lucky Number Composable (lucky-number/01)
 *
 * Orchestrator: GATE (game enabled + owner/admin + no live round + cooldown
 * elapsed) → EXECUTE (socket emit) → no REACT. The sender renders the round
 * from the `luckyNumber:started` broadcast (no local echo) — see
 * useRoomEventHandlers. MSAB draws the number; the client never does.
 *
 * Countdown: derives from the server's `endsAt` against a local 1 Hz clock
 * that exists ONLY while a round is live (plus one shot at cooldown end).
 * No rAF, no per-frame store writes.
 */
import type { ComputedRef } from 'vue';
import { useAudioSocket } from '../room/useAudioSocket';
import { LUCKY_NUMBER } from '~/constants/lucky-number';

export type LuckyNumberStartGateError =
  | 'not-ready'
  | 'disabled'
  | 'not-moderator'
  | 'round-live'
  | 'cooling-down';

export type LuckyNumberPickGateError =
  | 'not-ready'
  | 'not-seated'
  | 'no-round'
  | 'out-of-range';

export interface UseLuckyNumberReturn {
  startRound: () => void;
  /**
   * Lock in a guess (lucky-number/02). Rapid taps are coalesced: the first
   * goes out at once, later ones inside the window collapse to ONE trailing
   * emit carrying the latest number. No local echo of the ✓ badge — that
   * renders from `luckyNumber:picked` like everyone else's.
   */
  pick: (n: number) => void;
  /** Why `pick` would be refused right now (range aside), or null when it can go. */
  pickGateError: ComputedRef<LuckyNumberPickGateError | null>;
  /** Viewer is seated and a round is live — the number strip replaces the bottom bar. */
  canPick: ComputedRef<boolean>;
  /** The number this viewer last sent for the live round (strip highlight); null when none. */
  myPick: ComputedRef<number | null>;
  /** userIds that have locked in a pick this round (✓ badges). */
  pickedUserIds: ComputedRef<Set<number>>;
  /** Explains why `startRound` would be refused right now, or null when it can go. */
  startGateError: ComputedRef<LuckyNumberStartGateError | null>;
  /** MSAB has the game switched on for this room session. */
  isEnabled: ComputedRef<boolean>;
  /** Viewer may see the start button at all (enabled + owner/admin). */
  canSeeStartButton: ComputedRef<boolean>;
  isRoundLive: ComputedRef<boolean>;
  isCoolingDown: ComputedRef<boolean>;
  /** Whole seconds left in the live round; 0 when none. */
  secondsLeft: ComputedRef<number>;
  reveal: ComputedRef<{
    drawn: number;
    winners: string[];
    picks: Record<string, number>;
  } | null>;
}

// ---- shared local clock (module scope, ref-counted) ----
// Several components read the countdown at once (bottom-bar button, centre
// overlay); they share ONE 1 Hz interval that runs only while a round is live.
const now = ref(Date.now());
let tick: ReturnType<typeof setInterval> | null = null;
let tickConsumers = 0;

function acquireTick(): void {
  tickConsumers += 1;
  now.value = Date.now();
  if (tick) return;
  tick = setInterval(() => {
    now.value = Date.now();
  }, LUCKY_NUMBER.countdownTickMs);
}

function releaseTick(): void {
  tickConsumers = Math.max(0, tickConsumers - 1);
  if (tickConsumers === 0 && tick) {
    clearInterval(tick);
    tick = null;
  }
}

export function useLuckyNumber(): UseLuckyNumberReturn {
  const { socket } = useAudioSocket();
  const roomStore = useRoomStore();
  const seatsStore = useRoomSeatsStore();
  const authStore = useAuthStore();
  const { canModerate } = useRoomHierarchy();

  let holdsTick = false;
  let cooldownWake: ReturnType<typeof setTimeout> | null = null;

  // Pick coalescing (per component instance): the number chosen locally for
  // the live round, plus one trailing timer for taps inside the throttle window.
  const chosen = ref<{ roundId: string; number: number } | null>(null);
  let pickSentAt = 0;
  let pickTrailing: ReturnType<typeof setTimeout> | null = null;

  function stopPickTrailing(): void {
    if (pickTrailing) {
      clearTimeout(pickTrailing);
      pickTrailing = null;
    }
  }

  function stopTick(): void {
    if (holdsTick) {
      releaseTick();
      holdsTick = false;
    }
  }

  function stopCooldownWake(): void {
    if (cooldownWake) {
      clearTimeout(cooldownWake);
      cooldownWake = null;
    }
  }

  const isEnabled = computed(() => seatsStore.luckyNumberEnabled);
  const isRoundLive = computed(() => seatsStore.luckyNumberRound !== null);
  const isCoolingDown = computed(() => seatsStore.luckyNumberCooldownUntil > now.value);
  const canSeeStartButton = computed(() => isEnabled.value && canModerate.value);

  const secondsLeft = computed(() => {
    const round = seatsStore.luckyNumberRound;
    if (!round) return 0;
    return Math.max(0, Math.ceil((round.endsAt - now.value) / LUCKY_NUMBER.countdownTickMs));
  });

  const reveal = computed(() => {
    const r = seatsStore.luckyNumberReveal;
    return r ? { drawn: r.drawn, winners: r.winners, picks: r.picks } : null;
  });

  const isSelfSeated = computed(() => {
    const userId = authStore.user?.id;
    return userId !== undefined && seatsStore.seats.some((seat) => seat.occupantId === userId);
  });
  const canPick = computed(() => isRoundLive.value && isSelfSeated.value);
  const pickedUserIds = computed(() => seatsStore.luckyNumberPickedUserIds);
  const myPick = computed(() => {
    const round = seatsStore.luckyNumberRound;
    return round && chosen.value?.roundId === round.roundId ? chosen.value.number : null;
  });

  watch(
    isRoundLive,
    (live) => {
      if (live && !holdsTick) {
        acquireTick();
        holdsTick = true;
      } else if (!live) {
        stopTick();
      }
    },
    { immediate: true },
  );

  // One wake-up at cooldown end so the button re-enables without a running clock.
  watch(
    () => seatsStore.luckyNumberCooldownUntil,
    (until) => {
      stopCooldownWake();
      now.value = Date.now();
      const delay = until - now.value;
      if (delay <= 0) return;
      cooldownWake = setTimeout(() => {
        cooldownWake = null;
        now.value = Date.now();
      }, delay);
    },
    { immediate: true },
  );

  // A round change drops any pending trailing emit — it named the old round.
  watch(
    () => seatsStore.luckyNumberRound?.roundId ?? null,
    () => {
      stopPickTrailing();
      pickSentAt = 0;
    },
  );

  onScopeDispose(() => {
    stopTick();
    stopCooldownWake();
    stopPickTrailing();
  });

  // ---- GATE ----
  function getCurrentRoomId(): string | null {
    return roomStore.currentRoom?.id.toString() ?? null;
  }

  const startGateError = computed<LuckyNumberStartGateError | null>(() => {
    if (!socket.value || !getCurrentRoomId()) return 'not-ready';
    if (!isEnabled.value) return 'disabled';
    if (!canModerate.value) return 'not-moderator';
    if (isRoundLive.value) return 'round-live';
    if (isCoolingDown.value) return 'cooling-down';
    return null;
  });

  const pickGateError = computed<LuckyNumberPickGateError | null>(() => {
    if (!socket.value || !getCurrentRoomId() || authStore.user?.id === undefined) return 'not-ready';
    if (!isRoundLive.value) return 'no-round';
    if (!isSelfSeated.value) return 'not-seated';
    return null;
  });

  function isInRange(n: number): boolean {
    return Number.isInteger(n) && n >= LUCKY_NUMBER.min && n <= LUCKY_NUMBER.max;
  }

  // ---- EXECUTE ----
  function startRound(): void {
    if (startGateError.value) return;
    socket.value!.emit('luckyNumber:start', { roomId: getCurrentRoomId()! });
  }

  function emitPick(roundId: string, number: number): void {
    pickSentAt = Date.now();
    socket.value!.emit(
      'luckyNumber:pick',
      { roomId: getCurrentRoomId()!, roundId, number },
      (response?: { success?: boolean }) => {
        // Server refused (rate limit, round over, unseated): drop the local
        // highlight so the strip does not claim a pick that was never recorded.
        if (response?.success) return;
        if (chosen.value?.roundId === roundId && chosen.value.number === number) {
          chosen.value = null;
        }
      },
    );
  }

  function pick(n: number): void {
    if (pickGateError.value || !isInRange(n)) return;
    const roundId = seatsStore.luckyNumberRound!.roundId;
    chosen.value = { roundId, number: n };

    const elapsed = Date.now() - pickSentAt;
    if (!pickTrailing && elapsed >= LUCKY_NUMBER.pickThrottleMs) {
      emitPick(roundId, n);
      return;
    }
    // Inside the window: one trailing emit with whatever is chosen by then.
    if (pickTrailing) return;
    pickTrailing = setTimeout(() => {
      pickTrailing = null;
      const latest = chosen.value;
      if (!latest || latest.roundId !== seatsStore.luckyNumberRound?.roundId) return;
      if (pickGateError.value) return;
      emitPick(latest.roundId, latest.number);
    }, LUCKY_NUMBER.pickThrottleMs - Math.max(0, elapsed));
  }

  return {
    startRound,
    pick,
    pickGateError,
    canPick,
    myPick,
    pickedUserIds,
    startGateError,
    isEnabled,
    canSeeStartButton,
    isRoundLive,
    isCoolingDown,
    secondsLeft,
    reveal,
  };
}
