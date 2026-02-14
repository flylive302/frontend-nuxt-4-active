// ========================================
// Agency Join Requests Composable
// ========================================

import type { AgencyJoinRequest, JoinAgencyRequest } from '~/types/agency/agency'

// ========================================
// Composable
// ========================================

/**
 * Composable for managing agency join requests.
 * Handles both user-sent requests and admin-received requests.
 */
export function useAgencyJoinRequests() {
  const store = useAgencyStore()
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // User Actions
  // ========================================

  /**
   * Request to join an agency.
   * @param agencyId - Target agency ID
   * @param request - Optional request body with message
   */
  async function requestToJoin(agencyId: number, request?: JoinAgencyRequest): Promise<AgencyJoinRequest | null> {
    try {
      const response = await api<{ data: AgencyJoinRequest }>(`/agencies/${agencyId}/join`, {
        method: 'POST',
        body: request,
      })

      // Add to my join requests
      store.myJoinRequests.items.unshift(response.data)

      toast.add({ title: 'Request Sent', description: 'Your join request has been submitted.', color: 'success' })
      return response.data
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[useAgencyJoinRequests] requestToJoin failed:', error)
      return null
    }
  }

  /**
   * Cancel join request.
   * @param agencyId - Agency ID to cancel request for
   */
  async function cancelJoinRequest(agencyId: number): Promise<boolean> {
    try {
      await api(`/agencies/${agencyId}/join`, { method: 'DELETE' })

      // Remove from my join requests
      store.myJoinRequests.items = store.myJoinRequests.items.filter(
        r => r.agency?.id !== agencyId
      )

      toast.add({ title: 'Cancelled', description: 'Join request cancelled.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[useAgencyJoinRequests] cancelJoinRequest failed:', error)
      return false
    }
  }

  /**
   * Fetch user's own join requests.
   * @param reset - Whether to reset pagination
   */
  async function fetchMyJoinRequests(reset = false): Promise<void> {
    if (reset) {
      store.myJoinRequests.items = []
      store.myJoinRequests.cursor = null
      store.myJoinRequests.hasMore = true
    }

    if (!store.myJoinRequests.hasMore || store.myJoinRequests.loading) return

    store.myJoinRequests.loading = true
    store.myJoinRequests.error = null

    try {
      const params = {
        cursor: store.myJoinRequests.cursor,
        per_page: 20,
      }

      const response = await api<{
        data: AgencyJoinRequest[]
        meta: { next_cursor: string | null }
      }>('/user/agency/join-requests/mine', { params })

      store.myJoinRequests.items.push(...response.data)
      store.myJoinRequests.cursor = response.meta.next_cursor
      store.myJoinRequests.hasMore = response.meta.next_cursor !== null
    } catch (error) {
      store.myJoinRequests.error = 'Failed to load join requests'
      console.error('[useAgencyJoinRequests] fetchMyJoinRequests failed:', error)
    } finally {
      store.myJoinRequests.loading = false
    }
  }

  // ========================================
  // Admin Actions
  // ========================================

  /**
   * Fetch incoming join requests (owner/admin).
   * @param reset - Whether to reset pagination
   */
  async function fetchJoinRequests(reset = false): Promise<void> {
    if (reset) {
      store.joinRequests.items = []
      store.joinRequests.cursor = null
      store.joinRequests.hasMore = true
    }

    if (!store.joinRequests.hasMore || store.joinRequests.loading) return

    store.joinRequests.loading = true
    store.joinRequests.error = null

    try {
      const params = {
        cursor: store.joinRequests.cursor,
        per_page: 20,
      }

      const response = await api<{
        data: AgencyJoinRequest[]
        meta: { next_cursor: string | null }
      }>('/user/agency/join-requests', { params })

      store.joinRequests.items.push(...response.data)
      store.joinRequests.cursor = response.meta.next_cursor
      store.joinRequests.hasMore = response.meta.next_cursor !== null
    } catch (error) {
      store.joinRequests.error = 'Failed to load join requests'
      console.error('[useAgencyJoinRequests] fetchJoinRequests failed:', error)
    } finally {
      store.joinRequests.loading = false
    }
  }

  /**
   * Approve join request (owner/admin).
   * @param requestId - Request ID to approve
   */
  async function approveJoinRequest(requestId: number): Promise<boolean> {
    try {
      await api(`/user/agency/join-requests/${requestId}/approve`, { method: 'POST' })

      // Remove from list
      store.joinRequests.items = store.joinRequests.items.filter(r => r.id !== requestId)

      toast.add({ title: 'Approved', description: 'Join request approved.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[useAgencyJoinRequests] approveJoinRequest failed:', error)
      return false
    }
  }

  /**
   * Reject join request (owner/admin).
   * @param requestId - Request ID to reject
   */
  async function rejectJoinRequest(requestId: number): Promise<boolean> {
    try {
      await api(`/user/agency/join-requests/${requestId}/reject`, { method: 'POST' })

      // Remove from list
      store.joinRequests.items = store.joinRequests.items.filter(r => r.id !== requestId)

      toast.add({ title: 'Rejected', description: 'Join request rejected.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[useAgencyJoinRequests] rejectJoinRequest failed:', error)
      return false
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    // User actions
    requestToJoin,
    cancelJoinRequest,
    fetchMyJoinRequests,
    
    // Admin actions
    fetchJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
  }
}
