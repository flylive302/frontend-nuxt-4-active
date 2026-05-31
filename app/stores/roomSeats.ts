import { defineStore } from 'pinia';
import type { Seat, SeatWithUser } from '~/types/room/audio';
import { useRoomParticipantsStore } from '~/stores/roomParticipants';
import { SEAT_COUNT } from '~/constants/room';

// ============================================
// Helpers
// ============================================
function createEmptySeats(): Seat[] {
  return Array.from({ length: SEAT_COUNT }, (_, i) => ({
    index: i,
    occupantId: null,
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
  // Participants store (for seatsWithUsers join)
  // ========================================
  const participantsStore = useRoomParticipantsStore();

  // ========================================
  // Computed
  // ========================================
  const speakersCount = computed(() => seats.value.filter((s) => s.occupantId !== null).length);

  const seatsWithUsers = computed<SeatWithUser[]>(() =>
    seats.value.map((seat) => ({
      ...seat,
      user:
        seat.occupantId !== null
          ? (participantsStore.participants.get(seat.occupantId) ?? null)
          : null,
    })),
  );

  const speakerIds = computed<Set<number>>(() => {
    const ids = new Set<number>();
    for (const seat of seats.value) {
      if (seat.occupantId !== null) ids.add(seat.occupantId);
    }
    return ids;
  });

  // ========================================
  // Seat Actions
  // ========================================

  function updateSeat(seatIndex: number, occupantId: number | null, isMuted: boolean): void {
    if (seatIndex < 0 || seatIndex >= seats.value.length) return;

    // Single-occupancy invariant: clear the same occupant from any other seat
    // before placing them here, so observers self-correct even if the
    // compensating `seat:cleared` is reordered or suppressed (F-24 guard).
    if (occupantId !== null) {
      seats.value.forEach((s, i) => {
        if (i !== seatIndex && s.occupantId === occupantId) {
          clearSeat(i);
        }
      });
    }

    const currentSeat = seats.value[seatIndex];
    seats.value[seatIndex] = {
      index: seatIndex,
      occupantId,
      isMuted,
      isActive: currentSeat?.isActive ?? false,
      isLocked: currentSeat?.isLocked ?? false,
    };

    if (occupantId !== null) {
      seatLastClaimedAt.set(seatIndex, { userId: occupantId, at: Date.now() });
    }
  }

  /**
   * Return the most recent claim recorded for `seatIndex`, if any.
   * Used by the `seat:cleared` handler to drop stale grace-clear events.
   */
  function getRecentClaim(seatIndex: number): { userId: number; at: number } | undefined {
    return seatLastClaimedAt.get(seatIndex);
  }

  function clearSeat(seatIndex: number): void {
    if (seatIndex < 0 || seatIndex >= seats.value.length) return;
    const seat = seats.value[seatIndex];

    if (seat?.occupantId !== null && seat?.occupantId !== undefined) {
      seatGiftTotals.value.delete(seat.occupantId);
    }

    seats.value[seatIndex] = {
      index: seatIndex,
      occupantId: null,
      isMuted: false,
      isActive: false,
      isLocked: seat?.isLocked ?? false,
    };
  }

  function setSeatLocked(seatIndex: number, isLocked: boolean): void {
    const seat = seats.value[seatIndex];
    if (seatIndex >= 0 && seatIndex < seats.value.length && seat) {
      seat.isLocked = isLocked;
    }
  }

  function addSeatGiftValue(userId: number, coinValue: number): void {
    const current = seatGiftTotals.value.get(userId) ?? 0;
    seatGiftTotals.value.set(userId, current + coinValue);
  }

  function setSeatMutedByUserId(userId: number, isMuted: boolean): void {
    const seat = seats.value.find((s) => s.occupantId === userId);
    if (seat) seat.isMuted = isMuted;
  }

  // ========================================
  // Seat UI Actions
  // ========================================

  function startInviteMode(seatIndex: number): void {
    inviteModeSeat.value = seatIndex;
    activeSeat.value = null;
  }

  function cancelInviteMode(): void {
    inviteModeSeat.value = null;
  }

  function openSeat(seatIndex: number): void {
    activeSeat.value = null;
    nextTick(() => {
      activeSeat.value = seatIndex;
    });
  }

  function closeSeat(): void {
    activeSeat.value = null;
  }

  // ========================================
  // Cross-Store Helpers (called by roomAudio)
  // ========================================

  /** Sync seat isActive state with active speaker IDs. */
  function syncActiveSpeakers(userIds: number[]): void {
    seats.value.forEach((seat) => {
      const shouldBeActive = seat.occupantId !== null && userIds.includes(seat.occupantId);
      if (seat.isActive !== shouldBeActive) {
        seat.isActive = shouldBeActive;
      }
    });
  }

  /** Reset all seats and gift totals. */
  function resetSeats(): void {
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
    snapshot: { seatIndex: number; occupantId: number | null; isMuted: boolean }[],
  ): void {
    const occupied = new Set(snapshot.filter((s) => s.occupantId !== null).map((s) => s.seatIndex));

    seats.value.forEach((seat, i) => {
      if (seat.occupantId !== null && !occupied.has(i)) {
        clearSeat(i);
      }
    });

    for (const s of snapshot) {
      updateSeat(s.seatIndex, s.occupantId, s.isMuted);
    }
  }

  /** Clear a participant from their seat (on leave/disconnect). */
  function clearParticipantFromSeat(userId: number): void {
    seatGiftTotals.value.delete(userId);
    const seat = seats.value.find((s) => s.occupantId === userId);
    if (seat) {
      seat.occupantId = null;
      seat.isMuted = false;
      seat.isActive = false;
    }
  }

  // ========================================
  // Return
  // ========================================
  return {
    // Seats
    seats,
    seatsWithUsers,
    speakersCount,
    speakerIds,
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
    setSeatMutedByUserId,
  };
});
