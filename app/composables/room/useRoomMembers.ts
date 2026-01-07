// ========================================
// Room Members Composable
// ========================================

import type { RoomMember, RoomMemberRole, GetRoomMembersParams, RoomMemberPagination } from '~/types/room'

/**
 * Composable for managing room members.
 * Handles fetching, querying, and member lookups.
 */
export function useRoomMembers() {
  const store = useRoomMembershipStore()
  const { api, normalizeError } = useApi()

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

      const response = await api<{
        success: true
        data: {
          members: RoomMember[]
          pagination: RoomMemberPagination
        }
      }>(`/rooms/${roomId}/members`, { params: queryParams })

      store.members.items.push(...response.data.members)
      store.members.hasMore = response.data.pagination.has_more
      store.members.cursor = response.data.pagination.next_cursor ?? null
    } catch (err) {
      const normalized = normalizeError(err)
      store.members.error = normalized.message
      console.error('[useRoomMembers] fetchMembers failed:', err)
    } finally {
      store.members.loading = false
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

    // Methods
    isMemberOf,
    getMember,
    membersByRole,

    // Actions
    fetchMembers,
  }
}
