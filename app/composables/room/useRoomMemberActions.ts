// ========================================
// Room Member Actions Composable
// ========================================

import type { UpdateMemberRoleRequest } from '~/types/room/room'

/**
 * Composable for member management actions.
 * Handles role updates. Removal is handled via the block API in useRoomBlocking.
 */
export function useRoomMemberActions() {
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // Actions
  // ========================================

  /**
   * Update member role (promote/demote).
   */
  async function updateMemberRole(
    roomId: number,
    userId: number,
    request: UpdateMemberRoleRequest
  ): Promise<boolean> {
    try {
      await api(`/rooms/${roomId}/members/${userId}/role`, {
        method: 'PATCH',
        body: request,
      })

      const action = request.role === 'admin' ? 'promoted to Admin' : 'demoted to Member'
      toast.add({
        title: 'Role Updated',
        description: `User has been ${action}.`,
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
    updateMemberRole,
  }
}
