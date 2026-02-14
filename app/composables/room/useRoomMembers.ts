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

      // Laravel Resource::collection returns { data: RoomMember[] }
      const response = await api<{
        data: RoomMember[]
      }>(`/rooms/${roomId}/members`, { params: queryParams })

      const members = Array.isArray(response.data) ? response.data : []
      store.members.items = reset ? members : [...store.members.items, ...members]
      store.members.hasMore = false // No cursor pagination on this endpoint
    } catch (err) {
      const normalized = normalizeError(err)
      store.members.error = normalized.message
      console.error('[useRoomMembers] fetchMembers failed:', err)
    } finally {
      store.members.loading = false
    }
  }

  /**
   * Fetch current user's room membership.
   * Returns the membership object if user is a member, null otherwise.
   */
  async function fetchMyMembership(): Promise<RoomMember | null> {
    try {
      const response = await api<{ success: boolean; data: RoomMember | null }>('/user/room')
      store.myMembership = response.data
      return response.data
    } catch (err) {
      // 404 or error means user is not a member
      store.myMembership = null
      return null
    }
  }

  /**
   * Leave current room membership.
   */
  async function leaveRoomMembership(): Promise<boolean> {
    try {
      await api('/user/room/leave', { method: 'POST' })
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
