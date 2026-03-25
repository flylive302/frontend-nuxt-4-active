// ========================================
// Agency Admin Composable
// ========================================

import type { KickMemberRequest } from '~/types/agency/agency'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useAgencyAdmin]')

// ========================================
// Composable
// ========================================

/**
 * Composable for agency admin actions.
 * Handles member management and blocking operations.
 */
export function useAgencyAdmin() {
  const store = useAgencyStore()
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // Member Management
  // ========================================

  /**
   * Kick member from agency (owner/admin).
   * @param memberId - Member ID to kick
   * @param request - Optional reason for kicking
   */
  async function kickMember(memberId: number, request?: KickMemberRequest): Promise<boolean> {
    try {
      await api(`/user/agency/members/${memberId}`, {
        method: 'DELETE',
        body: request,
      })

      store.currentAgency.members = store.currentAgency.members.filter(
        m => m.id !== memberId
      )

      toast.add({ title: 'Removed', description: 'Member removed from agency.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      log.error(' kickMember failed:', error)
      return false
    }
  }

  /**
   * Block user from agency (owner/admin).
   * Prevents user from sending join requests.
   * @param userId - User ID to block
   */
  async function blockUser(userId: number): Promise<boolean> {
    try {
      await api(`/user/agency/users/${userId}/block`, { method: 'POST' })
      toast.add({ title: 'Blocked', description: 'User blocked from agency.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      log.error(' blockUser failed:', error)
      return false
    }
  }

  /**
   * Unblock user (owner/admin).
   * @param userId - User ID to unblock
   */
  async function unblockUser(userId: number): Promise<boolean> {
    try {
      await api(`/user/agency/users/${userId}/block`, { method: 'DELETE' })
      toast.add({ title: 'Unblocked', description: 'User unblocked.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      log.error(' unblockUser failed:', error)
      return false
    }
  }

  // ========================================
  // User Agency Blocking
  // ========================================

  /**
   * Block agency (user blocks agency from sending invitations).
   * @param agencyId - Agency ID to block
   */
  async function blockAgency(agencyId: number): Promise<boolean> {
    try {
      await api(`/agencies/${agencyId}/block`, { method: 'POST' })
      toast.add({ title: 'Blocked', description: 'Agency blocked.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      log.error(' blockAgency failed:', error)
      return false
    }
  }

  /**
   * Unblock agency.
   * @param agencyId - Agency ID to unblock
   */
  async function unblockAgency(agencyId: number): Promise<boolean> {
    try {
      await api(`/agencies/${agencyId}/block`, { method: 'DELETE' })
      toast.add({ title: 'Unblocked', description: 'Agency unblocked.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      log.error(' unblockAgency failed:', error)
      return false
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    kickMember,
    blockUser,
    unblockUser,
    blockAgency,
    unblockAgency,
  }
}
