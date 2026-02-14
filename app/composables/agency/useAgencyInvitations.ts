// ========================================
// Agency Invitations Composable
// ========================================

import type { AgencyInvitation, SendInvitationRequest, UserAgencyResponse } from '~/types/agency/agency'

// ========================================
// Composable
// ========================================

/**
 * Composable for managing agency invitations.
 * Handles received invitations (for users) and sent invitations (for admins).
 */
export function useAgencyInvitations() {
  const store = useAgencyStore()
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // User Actions
  // ========================================

  /**
   * Fetch received invitations (for regular users).
   * @param reset - Whether to reset the list
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
      const params = { per_page: 20 }

      const response = await api<{ data: AgencyInvitation[] }>(
        '/user/agency/invitations',
        { params }
      )

      store.receivedInvitations.items = response.data
      store.receivedInvitations.hasMore = false // Uses offset pagination
    } catch (error) {
      store.receivedInvitations.error = 'Failed to load invitations'
      console.error('[useAgencyInvitations] fetchReceivedInvitations failed:', error)
    } finally {
      store.receivedInvitations.loading = false
    }
  }

  /**
   * Accept invitation.
   * @param invitationId - Invitation ID to accept
   */
  async function acceptInvitation(invitationId: number): Promise<boolean> {
    try {
      await api(
        `/invitations/${invitationId}/accept`,
        { method: 'POST' }
      )

      // Remove from received invitations
      store.receivedInvitations.items = store.receivedInvitations.items.filter(
        i => i.id !== invitationId
      )

      // Refresh user agency state (inlined to avoid circular dependency)
      try {
        const response = await api<{ data: UserAgencyResponse | null }>('/user/agency')
        if (response.data) {
          store.userAgency.agency = response.data.agency
          store.userAgency.membership = response.data.membership
          store.userAgency.isOwner = response.data.is_owner
        }
      } catch {
        // Silent fail - user agency refresh is secondary
      }

      toast.add({ title: 'Joined', description: 'You have joined the agency!', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[useAgencyInvitations] acceptInvitation failed:', error)
      return false
    }
  }

  /**
   * Decline invitation.
   * @param invitationId - Invitation ID to decline
   */
  async function declineInvitation(invitationId: number): Promise<boolean> {
    try {
      await api(`/invitations/${invitationId}/decline`, { method: 'POST' })

      store.receivedInvitations.items = store.receivedInvitations.items.filter(
        i => i.id !== invitationId
      )

      toast.add({ title: 'Declined', description: 'Invitation declined.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[useAgencyInvitations] declineInvitation failed:', error)
      return false
    }
  }

  // ========================================
  // Admin Actions
  // ========================================

  /**
   * Fetch sent invitations (owner/admin).
   * @param reset - Whether to reset the list
   */
  async function fetchSentInvitations(reset = false): Promise<void> {
    if (reset) {
      store.sentInvitations.items = []
      store.sentInvitations.cursor = null
      store.sentInvitations.hasMore = true
    }

    if (!store.sentInvitations.hasMore || store.sentInvitations.loading) return

    store.sentInvitations.loading = true
    store.sentInvitations.error = null

    try {
      const params = { per_page: 20 }

      const response = await api<{ data: AgencyInvitation[] }>(
        '/user/agency/invitations/sent',
        { params }
      )

      store.sentInvitations.items = response.data
      store.sentInvitations.hasMore = false
    } catch (error) {
      store.sentInvitations.error = 'Failed to load sent invitations'
      console.error('[useAgencyInvitations] fetchSentInvitations failed:', error)
    } finally {
      store.sentInvitations.loading = false
    }
  }

  /**
   * Send invitation to user (owner/admin).
   * @param request - Invitation request with user_id
   */
  async function sendInvitation(request: SendInvitationRequest): Promise<AgencyInvitation | null> {
    try {
      const response = await api<{ data: AgencyInvitation }>(
        '/user/agency/invitations',
        { method: 'POST', body: request }
      )

      store.sentInvitations.items.unshift(response.data)

      toast.add({ title: 'Invitation Sent', description: 'Invitation sent successfully.', color: 'success' })
      return response.data
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[useAgencyInvitations] sendInvitation failed:', error)
      return null
    }
  }

  /**
   * Cancel invitation (owner/admin/inviter).
   * @param invitationId - Invitation ID to cancel
   */
  async function cancelInvitation(invitationId: number): Promise<boolean> {
    try {
      await api(`/user/agency/invitations/${invitationId}`, { method: 'DELETE' })

      store.sentInvitations.items = store.sentInvitations.items.filter(
        i => i.id !== invitationId
      )

      toast.add({ title: 'Cancelled', description: 'Invitation cancelled.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[useAgencyInvitations] cancelInvitation failed:', error)
      return false
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    // User actions
    fetchReceivedInvitations,
    acceptInvitation,
    declineInvitation,
    
    // Admin actions
    fetchSentInvitations,
    sendInvitation,
    cancelInvitation,
  }
}
