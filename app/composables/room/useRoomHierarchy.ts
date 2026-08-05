// ========================================
// Room Hierarchy (Data composable)
// ========================================
//
// Role: Data/derived. Answers "what rank does this user hold in the current
// room, and may I act on them?" for every moderation surface — the seat
// drawer, the participant profile modal and the members tab.
//
// Rank does not come from one place, which is why this exists:
//   owner  → `rooms.user_id` (the owner holds NO room_members row at all)
//   admin  → the admin roster (`adminIds`), with the loaded members page as a
//            secondary source so a freshly listed admin counts immediately
//   member → everyone else, including participants with no membership at all
//
// The roster is only fetched for viewers who can actually moderate; plain
// members never pay for the request.
// ========================================

import { canManageRoomAdmins, canModerateRoomMember, toRoomRank, type RoomRank } from '~/utils/room-hierarchy'

export function useRoomHierarchy() {
  const roomStore = useRoomStore()
  const membershipStore = useRoomMembershipStore()
  const { isRoomOwner } = useRoomPermissions()
  const { fetchRoomAdmins } = useRoomMembers()

  /** The viewer's own rank in the room they are currently in. */
  const myRank = computed<RoomRank>(() => {
    if (isRoomOwner.value) return 'owner'
    return toRoomRank(membershipStore.myMembership?.role)
  })

  /** Owner and admins moderate; plain members do not. */
  const canModerate = computed(() => myRank.value !== 'member')

  /** Only the owner promotes or demotes admins. */
  const canManageAdmins = computed(() => canManageRoomAdmins(myRank.value))

  // Load the roster as soon as a moderator is in a room. Re-runs on room
  // change and on the viewer's own promotion; `fetchRoomAdmins` no-ops once
  // the roster for that room is in.
  watchEffect(() => {
    const roomId = roomStore.currentRoom?.id
    if (!roomId || !canModerate.value) return
    void fetchRoomAdmins(roomId)
  })

  /**
   * The room's owner id. Read from `owner_id` — a plain column that is always
   * serialized — NOT from the nested `owner` object, which the backend emits
   * with `whenLoaded('user')` and omits whenever the room was fetched without
   * that eager load. Reading the nested id would make the owner look like a
   * plain member and put the kick button back on them.
   */
  const ownerId = computed<number | null>(() => {
    const room = roomStore.currentRoom
    return room?.owner_id ?? room?.owner?.id ?? null
  })

  /** Rank of any user id — participants without a membership rank as member. */
  function rankOf(userId: number | null | undefined): RoomRank {
    if (typeof userId !== 'number') return 'member'
    if (ownerId.value !== null && userId === ownerId.value) return 'owner'
    if (membershipStore.adminIds.has(userId)) return 'admin'

    const listed = membershipStore.members.items.find(m => m.user_id === userId)

    return listed ? toRoomRank(listed.role) : 'member'
  }

  /** Whether the viewer may kick (= block) the given user. */
  function canRemove(userId: number | null | undefined): boolean {
    if (typeof userId !== 'number') return false
    if (userId === useAuthStore().user?.id) return false

    return canModerateRoomMember(myRank.value, rankOf(userId))
  }

  return { myRank, canModerate, canManageAdmins, rankOf, canRemove }
}
