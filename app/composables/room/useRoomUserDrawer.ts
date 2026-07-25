// ========================================
// Open a User From Inside a Room
// ========================================
//
// Role: Action/Orchestrator (GATE → EXECUTE). In-room avatar taps used to
// minimize the room and navigate to /profile/{signature}, pulling the user out
// of the room they were watching. Live participants now open the seat drawer's
// profile mode instead — the same profile card, plus the actions that apply to
// them (follow, chat, gift/mute when seated, kick, invite to a seat).
//
// A user who is no longer in the room has no participant record for that card
// to be built from, so they keep the old navigation.
// ========================================

/** Minimal shape every in-room user list already carries. */
export interface RoomUserTarget {
  id: number
  signature?: string | null
}

export function useRoomUserDrawer() {
  const seatsStore = useRoomSeatsStore()
  const participantsStore = useRoomParticipantsStore()
  const roomStore = useRoomStore()

  /**
   * Open `user` the in-room way, falling back to their profile page.
   */
  function openUser(user: RoomUserTarget): void {
    // GATE: only live participants can be rendered in the drawer.
    if (participantsStore.participants.has(user.id)) {
      // EXECUTE
      seatsStore.openProfile(user.id)
      return
    }

    // Left the room (e.g. a leaderboard contributor) → their profile page.
    if (!user.signature) return
    roomStore.minimizeRoom()
    void navigateTo(`/profile/${user.signature}`)
  }

  return { openUser }
}
