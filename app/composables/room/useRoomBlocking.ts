// ========================================
// Room Blocking Composable
// ========================================

import type { RoomBlock, BlockUserRequest } from '~/types/room/room'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useRoomBlocking]')

/**
 * Composable for managing room blocking.
 * Handles blocking, unblocking, and listing blocked users.
 */
export function useRoomBlocking() {
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // State
  // ========================================

  const blockedUsers = ref<RoomBlock[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ========================================
  // Actions
  // ========================================

  /**
   * Fetch blocked users for a room.
   */
  async function fetchBlockedUsers(roomId: number): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await api<{
        success: true
        data: RoomBlock[]
      }>(`/rooms/${roomId}/blocks`)

      blockedUsers.value = response.data
    } catch (err) {
      const normalized = normalizeError(err)
      error.value = normalized.message
      log.error('fetchBlockedUsers failed:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Block a user from room.
   */
  async function blockUser(roomId: number, request: BlockUserRequest): Promise<boolean> {
    try {
      await api(`/rooms/${roomId}/blocks`, {
        method: 'POST',
        body: request,
      })

      const durationLabel = request.duration === 'permanent' || !request.duration
        ? 'permanently'
        : `for ${request.duration}`

      toast.add({
        title: 'User Blocked',
        description: `User has been blocked ${durationLabel}.`,
        color: 'warning',
      })

      return true
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: 'Error', description: normalized.message, color: 'error' })
      return false
    }
  }

  /**
   * Unblock a user from room.
   */
  async function unblockUser(roomId: number, userId: number): Promise<boolean> {
    try {
      await api(`/rooms/${roomId}/blocks/${userId}`, { method: 'DELETE' })

      blockedUsers.value = blockedUsers.value.filter(b => b.user.id !== userId)
      toast.add({ title: 'User Unblocked', description: 'User has been unblocked.', color: 'success' })
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
    blockedUsers,
    loading,
    error,

    // Actions
    fetchBlockedUsers,
    blockUser,
    unblockUser,
  }
}
