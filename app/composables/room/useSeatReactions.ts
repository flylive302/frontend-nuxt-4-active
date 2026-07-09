/**
 * Seat Reactions Composable (ADR 0015 / seat-reactions slice 01)
 *
 * Orchestrator: GATE (seated + own reaction not already playing) → EXECUTE
 * (socket emit) → no REACT. The sender renders its own reaction from the
 * `seat:reaction` broadcast (no local echo) — see useRoomEventHandlers.
 */
import type { ComputedRef } from 'vue';
import { useAudioSocket } from './useAudioSocket';

export interface UseSeatReactionsReturn {
  sendReaction: (code: string) => void;
  /** True while the current user holds a Seat — gates the drawer trigger. */
  isSelfSeated: ComputedRef<boolean>;
  /** True while the current user's own Reaction is still playing. */
  isSelfReactionPlaying: ComputedRef<boolean>;
}

export function useSeatReactions(): UseSeatReactionsReturn {
  const { socket } = useAudioSocket();
  const authStore = useAuthStore();
  const roomStore = useRoomStore();
  const seatsStore = useRoomSeatsStore();

  function isOwnReactionPlaying(userId: number): boolean {
    return seatsStore.activeReactions.has(userId);
  }

  function isSeated(userId: number): boolean {
    return seatsStore.seats.some((seat) => seat.occupantId === userId);
  }

  const isSelfSeated = computed(() => {
    const userId = authStore.user?.id;
    return userId !== undefined && isSeated(userId);
  });

  const isSelfReactionPlaying = computed(() => {
    const userId = authStore.user?.id;
    return userId !== undefined && isOwnReactionPlaying(userId);
  });

  function getCurrentRoomId(): string | null {
    return roomStore.currentRoom?.id.toString() ?? null;
  }

  function validate(): string | null {
    const roomId = getCurrentRoomId();
    const userId = authStore.user?.id;

    if (!socket.value || !roomId || !userId) {
      return 'not-ready';
    }
    if (!isSeated(userId)) {
      return 'not-seated';
    }
    if (isOwnReactionPlaying(userId)) {
      return 'reaction-already-playing';
    }
    return null;
  }

  function sendReaction(code: string): void {
    // GATE
    const gateError = validate();
    if (gateError) return;

    // EXECUTE
    const roomId = getCurrentRoomId()!;
    socket.value!.emit('seat:reaction', { roomId, code });
  }

  return {
    sendReaction,
    isSelfSeated,
    isSelfReactionPlaying,
  };
}
