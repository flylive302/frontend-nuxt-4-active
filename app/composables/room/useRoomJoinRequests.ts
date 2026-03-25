// ========================================
// Room Join Requests Composable
// ========================================

import type { RoomJoinRequest, JoinRoomRequest } from '~/types/room/room'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useRoomJoinRequests]')

/**
 * Composable for managing room join requests.
 * Handles user requests and admin approval/rejection.
 */
export function useRoomJoinRequests() {
  const store = useRoomMembershipStore()
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // State (from store)
  // ========================================

  const joinRequests = computed(() => store.joinRequests)
  const myJoinRequests = computed(() => store.myJoinRequests)
  const pendingRequestCount = computed(() => store.pendingRequestCount)

  // ========================================
  // User Actions
  // ========================================

  /**
   * Request to join a room.
   */
  async function requestToJoin(roomId: number, request?: JoinRoomRequest): Promise<RoomJoinRequest | null> {
    try {
      const response = await api<{ data: RoomJoinRequest }>(`/rooms/${roomId}/join-request`, {
        method: 'POST',
        body: request,
      })

      store.myJoinRequests.items.unshift(response.data)
      toast.add({ title: 'Request Sent', description: 'Your join request has been submitted.', color: 'success' })
      return response.data
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: 'Error', description: normalized.message, color: 'error' })
      log.error('requestToJoin failed:', err)
      return null
    }
  }

  /**
   * Cancel join request.
   */
  async function cancelJoinRequest(roomId: number): Promise<boolean> {
    try {
      await api(`/rooms/${roomId}/join-request`, { method: 'DELETE' })
      store.myJoinRequests.items = store.myJoinRequests.items.filter(r => r.room_id !== roomId)
      toast.add({ title: 'Cancelled', description: 'Join request cancelled.', color: 'success' })
      return true
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: 'Error', description: normalized.message, color: 'error' })
      return false
    }
  }

  /**
   * Fetch user's own pending join requests from backend.
   * Hydrates myJoinRequests so state persists across page refreshes.
   */
  async function fetchMyJoinRequests(): Promise<void> {
    try {
      const response = await api<{ success: true; data: RoomJoinRequest[] }>('/user/room/join-requests/mine')
      store.myJoinRequests.items = response.data
      store.myJoinRequests.hasMore = false
    } catch (err) {
      log.error('fetchMyJoinRequests failed:', err)
    }
  }

  // ========================================
  // Admin Actions
  // ========================================

  /**
   * Fetch incoming join requests (room owner/admin).
   * Uses /user/room/join-requests - gets pending requests for user's room.
   */
  async function fetchJoinRequests(roomId: number, reset = false): Promise<void> {
    if (reset) {
      store.joinRequests.items = []
      store.joinRequests.cursor = null
      store.joinRequests.hasMore = true
    }

    if (!store.joinRequests.hasMore || store.joinRequests.loading) return

    store.joinRequests.loading = true
    store.joinRequests.error = null

    try {
      // Pass room_id so admins (not just owners) can access join requests
      const response = await api<{
        success: true
        data: RoomJoinRequest[]
      }>('/user/room/join-requests', {
        params: { room_id: roomId },
      })

      store.joinRequests.items = response.data
      store.joinRequests.hasMore = false // No pagination for this endpoint
    } catch (err) {
      const normalized = normalizeError(err)
      store.joinRequests.error = normalized.message
      log.error('fetchJoinRequests failed:', err)
    } finally {
      store.joinRequests.loading = false
    }
  }

  /**
   * Approve join request.
   */
  async function approveJoinRequest(requestId: number): Promise<boolean> {
    try {
      await api(`/user/room/join-requests/${requestId}/approve`, { method: 'POST' })
      store.joinRequests.items = store.joinRequests.items.filter(r => r.id !== requestId)
      toast.add({ title: 'Approved', description: 'Join request approved.', color: 'success' })
      return true
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: 'Error', description: normalized.message, color: 'error' })
      return false
    }
  }

  /**
   * Reject join request.
   */
  async function rejectJoinRequest(requestId: number): Promise<boolean> {
    try {
      await api(`/user/room/join-requests/${requestId}/reject`, { method: 'POST' })
      store.joinRequests.items = store.joinRequests.items.filter(r => r.id !== requestId)
      toast.add({ title: 'Rejected', description: 'Join request rejected.', color: 'warning' })
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
    joinRequests,
    myJoinRequests,
    pendingRequestCount,

    // User Actions
    requestToJoin,
    cancelJoinRequest,
    fetchMyJoinRequests,

    // Admin Actions
    fetchJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
  }
}
