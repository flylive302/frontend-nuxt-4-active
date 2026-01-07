// ========================================
// Room Invitations Composable
// ========================================

import type { RoomInvitation, InviteToRoomRequest, RoomMemberPagination } from '~/types/room'

/**
 * Composable for managing room invitations.
 * Handles sending, receiving, accepting, declining, and cancelling invitations.
 */
export function useRoomInvitations() {
  const store = useRoomMembershipStore()
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // State (from store)
  // ========================================

  const receivedInvitations = computed(() => store.receivedInvitations)
  const sentInvitations = computed(() => store.sentInvitations)

  // ========================================
  // Fetch Actions
  // ========================================

  /**
   * Fetch received invitations (for current user).
   */
  async function fetchReceivedInvitations(reset = false): Promise<void> {
    if (reset) {
      store.receivedInvitations.items = []
      store.receivedInvitations.cursor = null
      store.receivedInvitations.hasMore = true
    }

    if (!store.receivedInvitations.hasMore || store.receivedInvitations.loading) return

    store.receivedInvitations.loading = true
    store.receivedInvitations.error = null

    try {
      const queryParams: Record<string, unknown> = { per_page: 50 }
      if (store.receivedInvitations.cursor) queryParams.cursor = store.receivedInvitations.cursor

      const response = await api<{
        success: true
        data: {
          invitations: RoomInvitation[]
          pagination: RoomMemberPagination
        }
      }>('/room-invitations/received', { params: queryParams })

      store.receivedInvitations.items.push(...response.data.invitations)
      store.receivedInvitations.hasMore = response.data.pagination.has_more
      store.receivedInvitations.cursor = response.data.pagination.next_cursor ?? null
    } catch (err) {
      const normalized = normalizeError(err)
      store.receivedInvitations.error = normalized.message
      console.error('[useRoomInvitations] fetchReceivedInvitations failed:', err)
    } finally {
      store.receivedInvitations.loading = false
    }
  }

  /**
   * Fetch sent invitations (for room owner/admin).
   */
  async function fetchSentInvitations(roomId: number, reset = false): Promise<void> {
    if (reset) {
      store.sentInvitations.items = []
      store.sentInvitations.cursor = null
      store.sentInvitations.hasMore = true
    }

    if (!store.sentInvitations.hasMore || store.sentInvitations.loading) return

    store.sentInvitations.loading = true
    store.sentInvitations.error = null

    try {
      const queryParams: Record<string, unknown> = { per_page: 50 }
      if (store.sentInvitations.cursor) queryParams.cursor = store.sentInvitations.cursor

      const response = await api<{
        success: true
        data: {
          invitations: RoomInvitation[]
          pagination: RoomMemberPagination
        }
      }>(`/rooms/${roomId}/invitations`, { params: queryParams })

      store.sentInvitations.items.push(...response.data.invitations)
      store.sentInvitations.hasMore = response.data.pagination.has_more
      store.sentInvitations.cursor = response.data.pagination.next_cursor ?? null
    } catch (err) {
      const normalized = normalizeError(err)
      store.sentInvitations.error = normalized.message
      console.error('[useRoomInvitations] fetchSentInvitations failed:', err)
    } finally {
      store.sentInvitations.loading = false
    }
  }

  // ========================================
  // Admin Actions
  // ========================================

  /**
   * Send invitation to user.
   */
  async function sendInvitation(roomId: number, request: InviteToRoomRequest): Promise<RoomInvitation | null> {
    try {
      const response = await api<{ data: RoomInvitation }>(`/rooms/${roomId}/invitations`, {
        method: 'POST',
        body: request,
      })

      store.sentInvitations.items.unshift(response.data)
      toast.add({ title: 'Invitation Sent', description: 'Invitation sent successfully.', color: 'success' })
      return response.data
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: 'Error', description: normalized.message, color: 'error' })
      console.error('[useRoomInvitations] sendInvitation failed:', err)
      return null
    }
  }

  /**
   * Cancel sent invitation.
   */
  async function cancelInvitation(roomId: number, invitationId: number): Promise<boolean> {
    try {
      await api(`/rooms/${roomId}/invitations/${invitationId}`, { method: 'DELETE' })
      store.sentInvitations.items = store.sentInvitations.items.filter(i => i.id !== invitationId)
      toast.add({ title: 'Cancelled', description: 'Invitation cancelled.', color: 'success' })
      return true
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: 'Error', description: normalized.message, color: 'error' })
      return false
    }
  }

  // ========================================
  // User Actions
  // ========================================

  /**
   * Accept room invitation.
   */
  async function acceptInvitation(invitationId: number): Promise<boolean> {
    try {
      await api(`/room-invitations/${invitationId}/accept`, { method: 'POST' })
      store.receivedInvitations.items = store.receivedInvitations.items.filter(i => i.id !== invitationId)
      toast.add({ title: 'Joined', description: 'You have joined the room!', color: 'success' })
      return true
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: 'Error', description: normalized.message, color: 'error' })
      return false
    }
  }

  /**
   * Decline room invitation.
   */
  async function declineInvitation(invitationId: number): Promise<boolean> {
    try {
      await api(`/room-invitations/${invitationId}/decline`, { method: 'POST' })
      store.receivedInvitations.items = store.receivedInvitations.items.filter(i => i.id !== invitationId)
      toast.add({ title: 'Declined', description: 'Invitation declined.', color: 'neutral' })
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
    receivedInvitations,
    sentInvitations,

    // Fetch Actions
    fetchReceivedInvitations,
    fetchSentInvitations,

    // Admin Actions
    sendInvitation,
    cancelInvitation,

    // User Actions
    acceptInvitation,
    declineInvitation,
  }
}
