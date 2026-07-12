import { defineStore } from 'pinia';
import type { Seat, SeatWithUser } from '~/types/room/audio';
import { useRoomParticipantsStore } from '~/stores/roomParticipants';
import { DEFAULT_SEAT_COUNT } from '~/constants/room';

// ============================================
// Helpers
// ============================================
function createEmptySeats(count: number = DEFAULT_SEAT_COUNT): Seat[] {
  return Array.from({ length: count }, (_, i) => ({
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

  // Profile-only drawer: opens the seat drawer in view-only mode for an
  // arbitrary participant (e.g. tapping an avatar in chat), showing just the
  // profile card + visit-profile, with no seat/social actions. Mutually
  // exclusive with `activeSeat` — only one is ever non-null (see openSeat/openProfile).
  const profileUserId = ref<number | null>(null);

  // In-room chat drawer target — the userId whose DM thread is shown in
  // RoomChatDrawer. Independent of activeSeat/profileUserId (chat drawer
  // layers on top rather than replacing the seat drawer's own content).
  const chatDrawerUserId = ref<number | null>(null);

  // ========================================
  // Self-retake staleness window (F-24)
  // ========================================
  // Records when each seat was last claimed by which user. The `seat:cleared`
  // handler uses this to drop delayed grace-clear events from MSAB that arrive
  // AFTER the same user has retaken their own seat (the post-resume race that
  // triggered the rapid "Removed from seat" flicker on User B).
  const seatLastClaimedAt = new Map<number, { userId: number; at: number }>();

  // ========================================
  // Seat Reactions (ephemeral, ADR 0015)
  // ========================================
  // Keyed by userId — the sender's own broadcast (incl. sender) is the
  // source of truth for who's reacting; deep vacate-path clearing (leave,
  // removal, disconnect beyond `clearSeat`) is covered in a later slice.
  const activeReactions = ref<Map<number, { code: string; startedAt: number }>>(new Map());

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

    // Reassignment guard (04 — lifecycle hardening): if this seat is being
    // handed to a DIFFERENT occupant without an intervening `clearSeat` (e.g.
    // reconcileSeats replacing an occupant seatIndex-for-seatIndex), the
    // vacated occupant's reaction must still be cleared here — otherwise a
    // freshly-occupied seat can carry over the previous occupant's stale
    // animation under the old userId key.
    if (
      currentSeat?.occupantId !== null &&
      currentSeat?.occupantId !== undefined &&
      currentSeat.occupantId !== occupantId
    ) {
      clearReaction(currentSeat.occupantId);
    }

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
      clearReaction(seat.occupantId);
    }

    seats.value[seatIndex] = {
      index: seatIndex,
      occupantId: null,
      isMuted: false,
      isActive: false,
      isLocked: seat?.isLocked ?? false,
    };
  }

  /** Replace whatever reaction is currently playing on `userId`'s Seat (no queue). */
  function setReaction(userId: number, code: string): void {
    activeReactions.value.set(userId, { code, startedAt: Date.now() });
  }

  /** Clear `userId`'s active reaction (playback finished, or seat vacated). */
  function clearReaction(userId: number): void {
    activeReactions.value.delete(userId);
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
    profileUserId.value = null; // clear the other (mutually exclusive) mode
    activeSeat.value = null;
    nextTick(() => {
      activeSeat.value = seatIndex;
    });
  }

  function closeSeat(): void {
    activeSeat.value = null;
  }

  /** Open the drawer in view-only profile mode for `userId` (no seat actions). */
  function openProfile(userId: number): void {
    activeSeat.value = null; // clear the other (mutually exclusive) mode
    profileUserId.value = null;
    nextTick(() => {
      profileUserId.value = userId;
    });
  }

  function closeProfile(): void {
    profileUserId.value = null;
  }

  /** Open the in-room chat drawer for `userId`'s DM thread. */
  function openChat(userId: number): void {
    chatDrawerUserId.value = userId;
  }

  function closeChat(): void {
    chatDrawerUserId.value = null;
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
    activeReactions.value.clear();
    seats.value = createEmptySeats();
  }

  /**
   * Resize the seat array to the room's authoritative `max_seats` (realtime-12).
   *
   * Called by the join orchestrator (before the snapshot is reconciled) and on
   * live `room.updated`, so seats beyond the old fixed count (e.g. 16–20) exist
   * before any `updateSeat` targets them — otherwise the index-bounds guard in
   * `updateSeat` silently drops those occupancies. Growing appends empty seats;
   * shrinking slices off the tail. Existing seat state is preserved.
   */
  function setSeatCount(count: number): void {
    if (!Number.isFinite(count) || count < 1) return;
    const current = seats.value.length;
    if (count === current) return;

    if (count > current) {
      for (let i = current; i < count; i++) {
        seats.value.push({
          index: i,
          occupantId: null,
          isMuted: false,
          isActive: false,
          isLocked: false,
        });
      }
    } else {
      seats.value = seats.value.slice(0, count);
    }
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
    clearReaction(userId);
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
    profileUserId,
    chatDrawerUserId,
    startInviteMode,
    cancelInviteMode,
    openSeat,
    closeSeat,
    openProfile,
    closeProfile,
    openChat,
    closeChat,

    // Cross-store helpers
    syncActiveSpeakers,
    resetSeats,
    setSeatCount,
    reconcileSeats,
    clearParticipantFromSeat,
    setSeatMutedByUserId,

    // Seat reactions
    activeReactions,
    setReaction,
    clearReaction,
  };
});
