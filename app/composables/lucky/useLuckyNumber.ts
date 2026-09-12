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

export interface UseLuckyNumberReturn {
  startRound: () => void;
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
  reveal: ComputedRef<{ drawn: number; winners: string[] } | null>;
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
  const { canModerate } = useRoomHierarchy();

  let holdsTick = false;
  let cooldownWake: ReturnType<typeof setTimeout> | null = null;

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
    return r ? { drawn: r.drawn, winners: r.winners } : null;
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

  onScopeDispose(() => {
    stopTick();
    stopCooldownWake();
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

  // ---- EXECUTE ----
  function startRound(): void {
    if (startGateError.value) return;
    socket.value!.emit('luckyNumber:start', { roomId: getCurrentRoomId()! });
  }

  return {
    startRound,
    startGateError,
    isEnabled,
    canSeeStartButton,
    isRoundLive,
    isCoolingDown,
    secondsLeft,
    reveal,
  };
}
