// ========================================
// Room Members Composable
// ========================================

import type { RoomMember, RoomMemberRole, GetRoomMembersParams } from '~/types/room/room'


/**
 * Composable for managing room members.
 * Handles fetching, querying, and member lookups.
 */
export function useRoomMembers() {
  const store = useRoomMembershipStore()
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // State (from store)
  // ========================================

  const members = computed(() => store.members)
  const loading = computed(() => store.members.loading)
  const error = computed(() => store.members.error)
  const hasMore = computed(() => store.members.hasMore)

  // ========================================
  // Methods
  // ========================================

  /**
   * Check if user is member of current room.
   */
  function isMemberOf(userId: number): boolean {
    return store.members.items.some(m => m.user_id === userId)
  }

  /**
   * Get member by user ID.
   */
  function getMember(userId: number): RoomMember | undefined {
    return store.members.items.find(m => m.user_id === userId)
  }

  /**
   * Get members filtered by role.
   */
  function membersByRole(role: RoomMemberRole): RoomMember[] {
    return store.members.items.filter(m => m.role === role)
  }

  // ========================================
  // Actions
  // ========================================

  /**
   * Fetch room members with pagination.
   */
  async function fetchMembers(roomId: number, params: GetRoomMembersParams = {}, reset = false): Promise<void> {
    // Set current room context so socket event handlers can match room_id
    store.setRoom(roomId)

    if (reset) {
      store.members.items = []
      store.members.cursor = null
      store.members.hasMore = true
    }

    if (!store.members.hasMore || store.members.loading) return

    store.members.loading = true
    store.members.error = null

    try {
      const queryParams: Record<string, unknown> = {
        per_page: params.per_page ?? 50,
      }

      if (params.role) queryParams.role = params.role
      if (store.members.cursor) queryParams.cursor = store.members.cursor

      const response = await api<{
        data: RoomMember[]
        meta: { next_cursor: string | null, has_more: boolean }
      }>(`/rooms/${roomId}/members`, { params: queryParams })

      const members = Array.isArray(response.data) ? response.data : []
      store.members.items = reset ? members : [...store.members.items, ...members]
      store.members.cursor = response.meta?.next_cursor ?? null
      store.members.hasMore = response.meta?.has_more ?? false
    } catch (err) {
      const normalized = normalizeError(err)
      store.members.error = normalized.message
    } finally {
      store.members.loading = false
    }
  }

  /**
   * Fetch current user's room memberships and resolve the one for the current room.
   * The API returns a collection; we find the membership matching the current room.
   */
  async function fetchMyMembership(): Promise<RoomMember | null> {
    try {
      const response = await api<{ success: boolean; data: RoomMember[] | RoomMember | null }>('/user/room')
      const data = response.data

      // Handle array response (collection of memberships)
      if (Array.isArray(data)) {
        if (data.length === 0) {
          store.myMembership = null
          return null
        }
        // Find membership for the current room
        const roomStore = useRoomStore()
        const currentRoomId = roomStore.currentRoom?.id
        const match = currentRoomId
          ? data.find(m => m.room_id === currentRoomId)
          : data[0]
        store.myMembership = match ?? null
        return store.myMembership
      }

      // Handle single object response (backward compat)
      store.myMembership = data
      return data
    } catch {
      // 404 or error means user is not a member
      store.myMembership = null
      return null
    }
  }

  /**
   * Leave room membership.
   * @param roomId - Optional room ID to leave. If omitted, leaves first active membership.
   */
  async function leaveRoomMembership(roomId: number): Promise<boolean> {
    try {
      await api(`/rooms/${roomId}/membership`, {
        method: 'DELETE',
      })
      store.myMembership = null
      toast.add({
        title: 'Left Room',
        description: 'You have left the room membership.',
        color: 'success',
      })
      return true
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: 'Error', description: normalized.message, color: 'error' })
      return false
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    members,
    loading,
    error,
    hasMore,
    myMembership: computed(() => store.myMembership),

    // Methods
    isMemberOf,
    getMember,
    membersByRole,

    // Actions
    fetchMembers,
    fetchMyMembership,
    leaveRoomMembership,
  }
}
