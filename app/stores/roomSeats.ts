import { defineStore } from 'pinia';
import type { RoomParticipant, Seat } from '~/types/room/audio';
import { SEAT_COUNT } from '~/constants/room';
import { createLogger } from '~/utils/logger';

const storeLog = createLogger('[RoomSeatsStore]');

// ============================================
// Helpers
// ============================================
function createEmptySeats(): Seat[] {
  return Array.from({ length: SEAT_COUNT }, (_, i) => ({
    index: i,
    user: null,
    isMuted: false,
    isActive: false,
    isLocked: false,
  }));
}

// ============================================
// Store
// ============================================
export const useRoomSeatsStore = defineStore('roomSeatsStore', () => {
  // ========================================
  // Seats (15 speaker seats)
  // ========================================
  const seats = ref<Seat[]>(createEmptySeats());

  // ========================================
  // Seat Gift Totals (ephemeral per-session)
  // ========================================
  const seatGiftTotals = ref<Map<number, number>>(new Map());

  // ========================================
  // Seat UI State
  // ========================================
  const activeSeat = ref<number | null>(null);
  const inviteModeSeat = ref<number | null>(null);

  // ========================================
  // Computed
  // ========================================
  const speakersCount = computed(() => seats.value.filter((s) => s.user !== null).length);

  // ========================================
  // Seat Actions
  // ========================================

  /**
   * Update a seat with user and mute state.
   * Looks up the user from the audio store's participants.
   * BUG-3 FIX: If user not yet in participants (race condition),
   * creates a minimal placeholder so the seat renders as occupied.
   */
  function updateSeat(seatIndex: number, userId: number | null, isMuted: boolean) {
    if (seatIndex >= 0 && seatIndex < seats.value.length) {
      const audioStore = useRoomAudioStore();
      let user = userId !== null ? audioStore.participants.get(userId) ?? null : null;

      // BUG-3 FIX: If user not in participants map (cross-instance race),
      // create a minimal placeholder so the seat doesn't appear empty.
      if (userId !== null && !user) {
        storeLog.debug('updateSeat: user not in participants, creating placeholder for userId:', userId);
        user = {
          id: userId,
          name: `User ${userId}`,
          signature: '',
          avatar: '',
          frame: '',
          cover_image: null,
          gender: null,
          country: '',
          phone: '',
          email: null,
          date_of_birth: '',
          wealth_xp: '0',
          charm_xp: '0',
          vip_level: 0,
          isSpeaker: true,
        };
        // Also add to participants so subsequent lookups find them
        audioStore.addParticipant(user);
      }

      storeLog.debug('updateSeat:', { seatIndex, userId, userName: user?.name });

      const currentSeat = seats.value[seatIndex];
      const newSeat: Seat = {
        index: seatIndex,
        user: user ? { ...user } : null,
        isMuted,
        isActive: user != null && audioStore.audioState.activeSpeakerIds.includes(user.id),
        isLocked: currentSeat?.isLocked ?? false,
      };

      seats.value[seatIndex] = newSeat;

      // Update participant's speaker status
      if (user) {
        const participant = audioStore.participants.get(user.id);
        if (participant) {
          participant.isSpeaker = true;
          participant.seatIndex = seatIndex;
        }
      }
    }
  }

  /**
   * Clear a seat (remove user).
   */
  function clearSeat(seatIndex: number) {
    if (seatIndex >= 0 && seatIndex < seats.value.length) {
      const seat = seats.value[seatIndex];
      const user = seat?.user;

      seats.value[seatIndex] = {
        index: seatIndex,
        user: null,
        isMuted: false,
        isActive: false,
        isLocked: seat?.isLocked ?? false,
      };

      if (user) {
        seatGiftTotals.value.delete(user.id);

        const audioStore = useRoomAudioStore();
        const participant = audioStore.participants.get(user.id);
        if (participant) {
          participant.isSpeaker = false;
          participant.seatIndex = undefined;
        }
      }
    }
  }

  function setSeatLocked(seatIndex: number, isLocked: boolean) {
    const seat = seats.value[seatIndex];
    if (seatIndex >= 0 && seatIndex < seats.value.length && seat) {
      seat.isLocked = isLocked;
    }
  }

  function addSeatGiftValue(userId: number, coinValue: number) {
    const current = seatGiftTotals.value.get(userId) ?? 0;
    seatGiftTotals.value.set(userId, current + coinValue);
  }

  // ========================================
  // Seat UI Actions
  // ========================================

  function startInviteMode(seatIndex: number) {
    inviteModeSeat.value = seatIndex;
    activeSeat.value = null;
  }

  function cancelInviteMode() {
    inviteModeSeat.value = null;
  }

  function openSeat(seatId: number) {
    activeSeat.value = null;
    nextTick(() => {
      activeSeat.value = seatId;
    });
  }

  function closeSeat() {
    activeSeat.value = null;
  }

  // ========================================
  // Cross-Store Helpers (called by roomAudio)
  // ========================================

  /** Sync seat isActive state with active speaker IDs. */
  function syncActiveSpeakers(userIds: number[]) {
    seats.value.forEach((seat) => {
      const shouldBeActive = seat.user != null && userIds.includes(seat.user.id);
      if (seat.isActive !== shouldBeActive) {
        seat.isActive = shouldBeActive;
      }
    });
  }

  /** Reset all seats and gift totals. */
  function resetSeats() {
    seatGiftTotals.value.clear();
    seats.value = createEmptySeats();
  }

  /** Clear a participant from their seat (on leave/disconnect). */
  function clearParticipantFromSeat(userId: number) {
    seatGiftTotals.value.delete(userId);
    const seat = seats.value.find((s) => s.user?.id === userId);
    if (seat) {
      seat.user = null;
      seat.isMuted = false;
      seat.isActive = false;
    }
  }

  /** Refresh a seat user's data snapshot (on profile update). */
  function refreshSeatUser(userId: number, participant: RoomParticipant) {
    const seat = seats.value.find((s) => s.user?.id === userId);
    if (seat && seat.user) {
      seat.user = { ...participant };
    }
  }

  /** Update seat mute state for a user. */
  function setSeatUserMuted(userId: number, isMuted: boolean) {
    const seat = seats.value.find((s) => s.user?.id === userId);
    if (seat) {
      seat.isMuted = isMuted;
    }
  }

  // ========================================
  // Return
  // ========================================
  return {
    // Seats
    seats,
    speakersCount,
    updateSeat,
    clearSeat,
    setSeatLocked,

    // Seat gift totals
    seatGiftTotals,
    addSeatGiftValue,

    // Seat UI
    activeSeat,
    inviteModeSeat,
    startInviteMode,
    cancelInviteMode,
    openSeat,
    closeSeat,

    // Cross-store helpers
    syncActiveSpeakers,
    resetSeats,
    clearParticipantFromSeat,
    refreshSeatUser,
    setSeatUserMuted,
  };
});
