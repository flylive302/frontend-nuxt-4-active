/**
 * Room role helpers — cross-cutting auth + room store (not inside Pinia per ARCHITECTURE.md).
 */
export function useRoomPermissions() {
  const roomStore = useRoomStore()
  const authStore = useAuthStore()
  const membershipStore = useRoomMembershipStore()

  /**
   * `owner_id` is a plain column and always serialized; the nested `owner`
   * object is `whenLoaded('user')` on the backend and absent whenever the room
   * was fetched without that eager load. Reading only the nested id silently
   * demoted the owner to a plain member on those payloads.
   */
  const isRoomOwner = computed(() => {
    const room = roomStore.currentRoom
    if (!room) return false

    const ownerId = room.owner_id ?? room.owner?.id ?? null
    const selfId = authStore.user?.id ?? null

    return ownerId !== null && selfId !== null && ownerId === selfId
  })

  /**
   * Admin of the CURRENT room. `myMembership` loads asynchronously on room
   * mount (Settings drawer `refreshOwnRole`), so this can flip true late; the
   * row is matched to the current room so a stale membership from a previous
   * room never grants it. Same rule as `useRoomMembershipState`'s admin state.
   */
  const isRoomAdmin = computed(() => {
    const membership = membershipStore.myMembership
    const roomId = roomStore.currentRoom?.id
    return membership != null && roomId != null && membership.room_id === roomId && membership.role === 'admin'
  })

  return { isRoomOwner, isRoomAdmin }
}
