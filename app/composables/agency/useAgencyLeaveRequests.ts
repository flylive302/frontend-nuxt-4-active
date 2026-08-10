// ========================================
// Agency Leave Requests Composable
// ========================================
//
// Handles both the member's own leave request (submit/check status) and
// the owner/admin's incoming leave requests (list/approve/reject) —
// mirrors the split in useAgencyJoinRequests.ts.

import type { AgencyLeaveRequest, LeaveAgencyRequest } from '~/types/agency/agency'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useAgencyLeaveRequests]')

// ========================================
// Composable
// ========================================

/**
 * Composable for managing agency leave requests.
 * Handles both the member's own request and admin-received requests.
 */
export function useAgencyLeaveRequests() {
  const store = useAgencyStore()
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // User Actions
  // ========================================

  /**
   * Submit a leave request. The existing leave endpoint now creates a
   * pending request instead of leaving immediately — the owner must
   * approve it before the membership actually ends.
   */
  async function requestLeave(request?: LeaveAgencyRequest): Promise<AgencyLeaveRequest | null> {
    if (store.userAgency.membership?.can_request_leave === false) {
      toast.add({ title: 'Cannot Request Leave', description: 'You are not eligible to request leave right now.', color: 'error' })
      return null
    }

    store.myLeaveRequest.loading = true
    store.myLeaveRequest.error = null

    try {
      const response = await api<{ data: AgencyLeaveRequest }>('/user/agency/leave', {
        method: 'POST',
        body: request,
      })

      store.myLeaveRequest.item = response.data

      // Reflect the new pending state on the membership immediately so the
      // button flips to "Pending review" without waiting for a refetch.
      if (store.userAgency.membership) {
        store.userAgency.membership.can_request_leave = false
        store.userAgency.membership.leave_request_status = 'pending'
      }

      toast.add({
        title: 'Leave Request Sent',
        description: 'Your agency owner must approve this before you leave.',
        color: 'success',
      })
      return response.data
    } catch (error) {
      const err = normalizeError(error)
      store.myLeaveRequest.error = err.message
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      return null
    } finally {
      store.myLeaveRequest.loading = false
    }
  }

  /**
   * Fetch the member's own leave request status (used on mount / reload so
   * the button state survives a refresh).
   */
  async function fetchMyLeaveRequest(): Promise<void> {
    store.myLeaveRequest.loading = true
    store.myLeaveRequest.error = null

    try {
      // `mine` is a latest-first cursor-paginated collection; the member's
      // current request is the newest entry.
      const response = await api<{ data: AgencyLeaveRequest[] }>('/user/agency/leave-requests/mine')
      store.myLeaveRequest.item = response.data[0] ?? null
    } catch (error) {
      log.warn('Failed to fetch my leave request', error)
      store.myLeaveRequest.error = 'Failed to load leave request status'
    } finally {
      store.myLeaveRequest.loading = false
    }
  }

  // ========================================
  // Admin Actions
  // ========================================

  /**
   * Fetch incoming leave requests (owner/admin).
   * @param reset - Whether to reset pagination
   */
  async function fetchLeaveRequests(reset = false): Promise<void> {
    if (reset) {
      store.leaveRequests.items = []
      store.leaveRequests.cursor = null
      store.leaveRequests.hasMore = true
    }

    if (!store.leaveRequests.hasMore || store.leaveRequests.loading) return

    store.leaveRequests.loading = true
    store.leaveRequests.error = null

    try {
      const params = {
        cursor: store.leaveRequests.cursor,
        per_page: 20,
      }

      const response = await api<{
        data: AgencyLeaveRequest[]
        meta: { next_cursor: string | null }
      }>('/user/agency/leave-requests', { params })

      store.leaveRequests.items.push(...response.data)
      store.leaveRequests.cursor = response.meta.next_cursor
      store.leaveRequests.hasMore = response.meta.next_cursor !== null
    } catch (error) {
      log.warn('Failed to fetch incoming leave requests', error)
      store.leaveRequests.error = 'Failed to load leave requests'
    } finally {
      store.leaveRequests.loading = false
    }
  }

  /**
   * Approve leave request (owner/admin).
   * @param requestId - Request ID to approve
   */
  async function approveLeaveRequest(requestId: number): Promise<boolean> {
    try {
      await api(`/user/agency/leave-requests/${requestId}/approve`, { method: 'POST' })

      // Remove from list
      store.leaveRequests.items = store.leaveRequests.items.filter(r => r.id !== requestId)

      toast.add({ title: 'Approved', description: 'Leave request approved.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      return false
    }
  }

  /**
   * Reject leave request (owner/admin).
   * @param requestId - Request ID to reject
   */
  async function rejectLeaveRequest(requestId: number): Promise<boolean> {
    try {
      await api(`/user/agency/leave-requests/${requestId}/reject`, { method: 'POST' })

      // Remove from list
      store.leaveRequests.items = store.leaveRequests.items.filter(r => r.id !== requestId)

      toast.add({ title: 'Rejected', description: 'Leave request rejected.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      return false
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    // User actions
    requestLeave,
    fetchMyLeaveRequest,

    // Admin actions
    fetchLeaveRequests,
    approveLeaveRequest,
    rejectLeaveRequest,
  }
}
