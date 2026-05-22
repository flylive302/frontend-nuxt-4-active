import { defineStore } from 'pinia';
import type { RoomParticipant, Seat } from '~/types/room/audio';
import { SEAT_COUNT } from '~/constants/room';
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
  // Self-retake staleness window (F-24)
  // ========================================
  // Records when each seat was last claimed by which user. The `seat:cleared`
  // handler uses this to drop delayed grace-clear events from MSAB that arrive
  // AFTER the same user has retaken their own seat (the post-resume race that
  // triggered the rapid "Removed from seat" flicker on User B).
  const seatLastClaimedAt = new Map<number, { userId: number; at: number }>();

  // ========================================
  // Computed
  // ========================================
  const speakersCount = computed(() => seats.value.filter((s) => s.user !== null).length);

  // ========================================
  // Seat Actions
  // ========================================

  /**
   * Update a seat snapshot. Caller resolves `user` from participants / placeholder.
   */
  function updateSeat(
    seatIndex: number,
    user: RoomParticipant | null,
    isMuted: boolean,
    activeSpeakerIds: readonly number[],
  ) {
    if (seatIndex < 0 || seatIndex >= seats.value.length) return;

    const currentSeat = seats.value[seatIndex];
    const newSeat: Seat = {
      index: seatIndex,
      user: user ? { ...user } : null,
      isMuted,
      isActive: user != null && activeSpeakerIds.includes(user.id),
      isLocked: currentSeat?.isLocked ?? false,
    };

    seats.value[seatIndex] = newSeat;

    if (user) {
      seatLastClaimedAt.set(seatIndex, { userId: user.id, at: Date.now() });
    }
  }

  /**
   * Return the most recent claim recorded for `seatIndex`, if any.
   * Used by the `seat:cleared` handler to drop stale grace-clear events.
   */
  function getRecentClaim(seatIndex: number): { userId: number; at: number } | undefined {
    return seatLastClaimedAt.get(seatIndex);
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

  function openSeat(seatIndex: number) {
    activeSeat.value = null;
    nextTick(() => {
      activeSeat.value = seatIndex;
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
    seatLastClaimedAt.clear();
    seats.value = createEmptySeats();
  }

  /**
   * Reconcile seats against an authoritative join snapshot.
   *
   * Seats present in the snapshot are applied (upsert); occupied seats whose
   * occupant is ABSENT from the snapshot are cleared. Locks are preserved.
   * This is diff-based — an occupied seat that stays occupied is updated in
   * place rather than emptied-then-refilled, so there is no "seat blinks
   * empty" flicker (the §13.8 / F-24 regression that banned a blanket
   * resetSeats() on reconnect).
   */
  function reconcileSeats(
    snapshot: { seatIndex: number; user: RoomParticipant | null; isMuted: boolean }[],
    activeSpeakerIds: readonly number[],
  ) {
    const occupied = new Set(snapshot.filter((s) => s.user != null).map((s) => s.seatIndex));

    seats.value.forEach((seat, i) => {
      if (seat.user != null && !occupied.has(i)) {
        clearSeat(i);
      }
    });

    for (const s of snapshot) {
      updateSeat(s.seatIndex, s.user, s.isMuted, activeSpeakerIds);
    }
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
    getRecentClaim,

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
    reconcileSeats,
    clearParticipantFromSeat,
    refreshSeatUser,
    setSeatUserMuted,
  };
});
