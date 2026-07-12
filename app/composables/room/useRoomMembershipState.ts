import type { MaybeRefOrGetter } from 'vue'

// ========================================
// Room Membership State (Data composable)
// ========================================
//
// Single source of truth for the current user's relationship to a room.
// Consumed by the Room Settings hub (button filtering) and the Members
// Panel (action footer). Owns the three fetches its derivation needs.
// ========================================

export type RoomMembershipState =
  | 'owner'
  | 'admin'
  | 'member'
  | 'pending_request'
  | 'has_invitation'
  | 'none'

export function useRoomMembershipState(roomId: MaybeRefOrGetter<number | null | undefined>) {
  const { isRoomOwner } = useRoomPermissions()
  const { fetchMyJoinRequests, myJoinRequests } = useRoomJoinRequests()
  const { receivedInvitations, fetchReceivedInvitations } = useRoomInvitations()
  const { myMembership, fetchMyMembership } = useRoomMembers()

  /** Membership state for the current user in the given room */
  const membershipState = computed<RoomMembershipState>(() => {
    const id = toValue(roomId)
    if (!id) return 'none'
    if (isRoomOwner.value) return 'owner'
    if (myMembership.value && myMembership.value.room_id === id) {
      return myMembership.value.role === 'admin' ? 'admin' : 'member'
    }
    const pendingRequest = myJoinRequests.value.items.find(
      (r) => r && (r.room_id === id || r.room?.id === id) && r.status === 'pending'
    )
    if (pendingRequest) return 'pending_request'
    const pendingInvite = receivedInvitations.value.items.find(
      (inv) => inv && (inv.room_id === id || inv.room?.id === id) && inv.status === 'pending'
    )
    if (pendingInvite) return 'has_invitation'
    return 'none'
  })

  /** Whether the current user can edit room settings (owner or admin) */
  const canEdit = computed(
    () => isRoomOwner.value || membershipState.value === 'admin'
  )

  /** Fetch everything the derivation depends on */
  async function refresh(): Promise<void> {
    await Promise.all([
      fetchReceivedInvitations(true),
      fetchMyMembership(),
      fetchMyJoinRequests(),
    ])
  }

  return { membershipState, canEdit, isRoomOwner, refresh }
}
