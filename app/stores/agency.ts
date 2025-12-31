// ========================================
// Agency Store
// ========================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Agency,
  AgencyMember,
  AgencyInvitation,
  AgencyJoinRequest,
  UserAgencyResponse,
  AgencyListFilters,
  CreateAgencyRequest,
  JoinAgencyRequest,
  LeaveAgencyRequest,
  KickMemberRequest,
  SendInvitationRequest,
  ChangeCoinResellerRequest,
} from '~/types/agency'

// ========================================
// Types
// ========================================

interface PaginatedState<T> {
  items: T[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}

interface UserAgencyState {
  agency: Agency | null
  membership: AgencyMember | null
  isOwner: boolean
  loading: boolean
  error: string | null
}

// ========================================
// Store Definition
// ========================================

export const useAgencyStore = defineStore('agency', () => {
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // State
  // ========================================

  // User's agency context
  const userAgency = ref<UserAgencyState>({
    agency: null,
    membership: null,
    isOwner: false,
    loading: false,
    error: null,
  })

  // Browsing agencies list
  const agencies = ref<PaginatedState<Agency> & { filters: AgencyListFilters }>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
    filters: { search: '', country: '' },
  })

  // Current viewed agency (detail page)
  const currentAgency = ref<{
    agency: Agency | null
    members: AgencyMember[]
    loading: boolean
    membersLoading: boolean
    membersCursor: string | null
    membersHasMore: boolean
    error: string | null
  }>({
    agency: null,
    members: [],
    loading: false,
    membersLoading: false,
    membersCursor: null,
    membersHasMore: true,
    error: null,
  })

  // Received invitations (for regular users)
  const receivedInvitations = ref<PaginatedState<AgencyInvitation>>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  // Sent invitations (for owners/admins)
  const sentInvitations = ref<PaginatedState<AgencyInvitation>>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  // Incoming join requests (for owners/admins)
  const joinRequests = ref<PaginatedState<AgencyJoinRequest>>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  // User's own join requests
  const myJoinRequests = ref<PaginatedState<AgencyJoinRequest>>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  // ========================================
  // Computed
  // ========================================

  const isAgencyMember = computed(() => userAgency.value.agency !== null)
  const isAgencyOwner = computed(() => userAgency.value.isOwner)
  const isAgencyAdmin = computed(() => 
    userAgency.value.membership?.role === 'admin' || userAgency.value.isOwner
  )
  const canManageMembers = computed(() => isAgencyAdmin.value)
  const canLeaveAgency = computed(() => 
    isAgencyMember.value && !userAgency.value.isOwner
  )

  // ========================================
  // User Agency Actions
  // ========================================

  /**
   * Fetch user's agency context.
   * Should be called on app init for authenticated users.
   */
  async function fetchUserAgency(): Promise<void> {
    userAgency.value.loading = true
    userAgency.value.error = null

    try {
      const response = await api<{ data: UserAgencyResponse | null }>('/user/agency')
      
      if (response.data) {
        userAgency.value.agency = response.data.agency
        userAgency.value.membership = response.data.membership
        userAgency.value.isOwner = response.data.is_owner
      } else {
        userAgency.value.agency = null
        userAgency.value.membership = null
        userAgency.value.isOwner = false
      }
    } catch (error) {
      const err = normalizeError(error)
      userAgency.value.error = err.message
      console.error('[AgencyStore] fetchUserAgency failed:', error)
    } finally {
      userAgency.value.loading = false
    }
  }

  /**
   * Leave current agency (for members, not owners).
   */
  async function leaveAgency(request?: LeaveAgencyRequest): Promise<boolean> {
    if (!canLeaveAgency.value) {
      toast.add({ title: 'Cannot Leave', description: 'Owners cannot leave. Dissolve the agency instead.', color: 'error' })
      return false
    }

    try {
      await api('/user/agency/leave', {
        method: 'POST',
        body: request,
      })

      // Clear user agency state
      userAgency.value.agency = null
      userAgency.value.membership = null
      userAgency.value.isOwner = false

      toast.add({ title: 'Left Agency', description: 'You have left the agency.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[AgencyStore] leaveAgency failed:', error)
      return false
    }
  }

  /**
   * Dissolve agency (owner only).
   */
  async function dissolveAgency(): Promise<boolean> {
    if (!isAgencyOwner.value) {
      toast.add({ title: 'Unauthorized', description: 'Only the owner can dissolve the agency.', color: 'error' })
      return false
    }

    try {
      await api('/user/agency', { method: 'DELETE' })

      // Clear user agency state
      userAgency.value.agency = null
      userAgency.value.membership = null
      userAgency.value.isOwner = false

      toast.add({ title: 'Agency Dissolved', description: 'Your agency has been dissolved.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[AgencyStore] dissolveAgency failed:', error)
      return false
    }
  }

  /**
   * Change coin reseller (owner only).
   */
  async function changeCoinReseller(request: ChangeCoinResellerRequest): Promise<boolean> {
    if (!isAgencyOwner.value) {
      toast.add({ title: 'Unauthorized', description: 'Only the owner can change the coin reseller.', color: 'error' })
      return false
    }

    try {
      const response = await api<{ data: Agency }>('/user/agency/coin-reseller', {
        method: 'PUT',
        body: request,
      })

      if (userAgency.value.agency) {
        userAgency.value.agency = response.data
      }

      toast.add({ title: 'Updated', description: 'Coin reseller updated successfully.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[AgencyStore] changeCoinReseller failed:', error)
      return false
    }
  }

  // ========================================
  // Agency Browsing Actions
  // ========================================

  /**
   * Fetch list of approved agencies.
   */
  async function fetchAgencies(filters?: AgencyListFilters, reset = false): Promise<void> {
    if (reset) {
      agencies.value.items = []
      agencies.value.cursor = null
      agencies.value.hasMore = true
    }

    if (!agencies.value.hasMore || agencies.value.loading) return

    agencies.value.loading = true
    agencies.value.error = null

    try {
      // Merge filters with stored filters
      const mergedFilters = { ...agencies.value.filters, ...filters }
      
      // Build params, only including non-empty values
      // Backend throws error if search is null/empty string
      const params: Record<string, unknown> = {
        per_page: 20,
      }
      
      // Only add cursor if it exists
      if (agencies.value.cursor) {
        params.cursor = agencies.value.cursor
      }
      
      // Only add search if it has a value
      if (mergedFilters.search && mergedFilters.search.trim()) {
        params.search = mergedFilters.search.trim()
      }
      
      // Only add country if it has a value
      if (mergedFilters.country && mergedFilters.country.trim()) {
        params.country = mergedFilters.country.trim()
      }

      const response = await api<{
        data: Agency[]
        meta: { next_cursor: string | null }
      }>('/agencies', { params })

      agencies.value.items.push(...response.data)
      agencies.value.cursor = response.meta.next_cursor
      agencies.value.hasMore = response.meta.next_cursor !== null
    } catch (error) {
      const err = normalizeError(error)
      agencies.value.error = err.message
      console.error('[AgencyStore] fetchAgencies failed:', error)
    } finally {
      agencies.value.loading = false
    }
  }

  /**
   * Fetch single agency by ID.
   */
  async function fetchAgencyById(id: number): Promise<void> {
    currentAgency.value.loading = true
    currentAgency.value.error = null
    currentAgency.value.members = []
    currentAgency.value.membersCursor = null
    currentAgency.value.membersHasMore = true

    try {
      const response = await api<{ data: Agency }>(`/agencies/${id}`)
      currentAgency.value.agency = response.data
    } catch (error) {
      const err = normalizeError(error)
      currentAgency.value.error = err.message
      console.error('[AgencyStore] fetchAgencyById failed:', error)
    } finally {
      currentAgency.value.loading = false
    }
  }

  /**
   * Fetch members of an agency.
   */
  async function fetchAgencyMembers(agencyId: number, reset = false): Promise<void> {
    if (reset) {
      currentAgency.value.members = []
      currentAgency.value.membersCursor = null
      currentAgency.value.membersHasMore = true
    }

    if (!currentAgency.value.membersHasMore || currentAgency.value.membersLoading) return

    currentAgency.value.membersLoading = true

    try {
      const params = {
        cursor: currentAgency.value.membersCursor,
        per_page: 20,
      }

      const response = await api<{
        data: AgencyMember[]
        meta: { next_cursor: string | null }
      }>(`/agencies/${agencyId}/members`, { params })

      currentAgency.value.members.push(...response.data)
      currentAgency.value.membersCursor = response.meta.next_cursor
      currentAgency.value.membersHasMore = response.meta.next_cursor !== null
    } catch (error) {
      console.error('[AgencyStore] fetchAgencyMembers failed:', error)
    } finally {
      currentAgency.value.membersLoading = false
    }
  }

  // ========================================
  // Agency Creation
  // ========================================

  /**
   * Create new agency application.
   */
  async function createAgency(request: CreateAgencyRequest): Promise<Agency | null> {
    try {
      const formData = new FormData()
      formData.append('name', request.name)
      formData.append('country', request.country)
      formData.append('address', request.address)
      
      if (request.logo) {
        formData.append('logo', request.logo)
      }
      
      if (request.national_id_images) {
        request.national_id_images.forEach((file, index) => {
          formData.append(`national_id_images[${index}]`, file)
        })
      }
      
      if (request.coin_reseller_id) {
        formData.append('coin_reseller_id', String(request.coin_reseller_id))
      }

      const response = await api<{ data: Agency }>('/agencies', {
        method: 'POST',
        body: formData,
      })

      // Update user agency state
      userAgency.value.agency = response.data
      userAgency.value.isOwner = true
      userAgency.value.membership = null

      toast.add({ title: 'Success', description: 'Agency application submitted for review.', color: 'success' })
      return response.data
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[AgencyStore] createAgency failed:', error)
      return null
    }
  }

  // ========================================
  // Join Request Actions
  // ========================================

  /**
   * Request to join an agency.
   */
  async function requestToJoin(agencyId: number, request?: JoinAgencyRequest): Promise<AgencyJoinRequest | null> {
    try {
      const response = await api<{ data: AgencyJoinRequest }>(`/agencies/${agencyId}/join`, {
        method: 'POST',
        body: request,
      })

      // Add to my join requests
      myJoinRequests.value.items.unshift(response.data)

      toast.add({ title: 'Request Sent', description: 'Your join request has been submitted.', color: 'success' })
      return response.data
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[AgencyStore] requestToJoin failed:', error)
      return null
    }
  }

  /**
   * Cancel join request.
   */
  async function cancelJoinRequest(agencyId: number): Promise<boolean> {
    try {
      await api(`/agencies/${agencyId}/join`, { method: 'DELETE' })

      // Remove from my join requests
      myJoinRequests.value.items = myJoinRequests.value.items.filter(
        r => r.agency?.id !== agencyId
      )

      toast.add({ title: 'Cancelled', description: 'Join request cancelled.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[AgencyStore] cancelJoinRequest failed:', error)
      return false
    }
  }

  /**
   * Fetch user's own join requests.
   */
  async function fetchMyJoinRequests(reset = false): Promise<void> {
    if (reset) {
      myJoinRequests.value.items = []
      myJoinRequests.value.cursor = null
      myJoinRequests.value.hasMore = true
    }

    if (!myJoinRequests.value.hasMore || myJoinRequests.value.loading) return

    myJoinRequests.value.loading = true
    myJoinRequests.value.error = null

    try {
      const params = {
        cursor: myJoinRequests.value.cursor,
        per_page: 20,
      }

      const response = await api<{
        data: AgencyJoinRequest[]
        meta: { next_cursor: string | null }
      }>('/user/agency/join-requests/mine', { params })

      myJoinRequests.value.items.push(...response.data)
      myJoinRequests.value.cursor = response.meta.next_cursor
      myJoinRequests.value.hasMore = response.meta.next_cursor !== null
    } catch (error) {
      const err = normalizeError(error)
      myJoinRequests.value.error = err.message
      console.error('[AgencyStore] fetchMyJoinRequests failed:', error)
    } finally {
      myJoinRequests.value.loading = false
    }
  }

  /**
   * Fetch incoming join requests (owner/admin).
   */
  async function fetchJoinRequests(reset = false): Promise<void> {
    if (reset) {
      joinRequests.value.items = []
      joinRequests.value.cursor = null
      joinRequests.value.hasMore = true
    }

    if (!joinRequests.value.hasMore || joinRequests.value.loading) return

    joinRequests.value.loading = true
    joinRequests.value.error = null

    try {
      const params = {
        cursor: joinRequests.value.cursor,
        per_page: 20,
      }

      const response = await api<{
        data: AgencyJoinRequest[]
        meta: { next_cursor: string | null }
      }>('/user/agency/join-requests', { params })

      joinRequests.value.items.push(...response.data)
      joinRequests.value.cursor = response.meta.next_cursor
      joinRequests.value.hasMore = response.meta.next_cursor !== null
    } catch (error) {
      const err = normalizeError(error)
      joinRequests.value.error = err.message
      console.error('[AgencyStore] fetchJoinRequests failed:', error)
    } finally {
      joinRequests.value.loading = false
    }
  }

  /**
   * Approve join request (owner/admin).
   */
  async function approveJoinRequest(requestId: number): Promise<boolean> {
    try {
      await api(`/user/agency/join-requests/${requestId}/approve`, { method: 'POST' })

      // Remove from list
      joinRequests.value.items = joinRequests.value.items.filter(r => r.id !== requestId)

      toast.add({ title: 'Approved', description: 'Join request approved.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[AgencyStore] approveJoinRequest failed:', error)
      return false
    }
  }

  /**
   * Reject join request (owner/admin).
   */
  async function rejectJoinRequest(requestId: number): Promise<boolean> {
    try {
      await api(`/user/agency/join-requests/${requestId}/reject`, { method: 'POST' })

      // Remove from list
      joinRequests.value.items = joinRequests.value.items.filter(r => r.id !== requestId)

      toast.add({ title: 'Rejected', description: 'Join request rejected.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[AgencyStore] rejectJoinRequest failed:', error)
      return false
    }
  }

  // ========================================
  // Invitation Actions
  // ========================================

  /**
   * Fetch received invitations (for regular users).
   */
  async function fetchReceivedInvitations(reset = false): Promise<void> {
    if (reset) {
      receivedInvitations.value.items = []
      receivedInvitations.value.cursor = null
      receivedInvitations.value.hasMore = true
    }

    if (!receivedInvitations.value.hasMore || receivedInvitations.value.loading) return

    receivedInvitations.value.loading = true
    receivedInvitations.value.error = null

    try {
      const params = { per_page: 20 }

      const response = await api<{ data: AgencyInvitation[] }>(
        '/user/agency/invitations',
        { params }
      )

      receivedInvitations.value.items = response.data
      receivedInvitations.value.hasMore = false // Uses offset pagination
    } catch (error) {
      const err = normalizeError(error)
      receivedInvitations.value.error = err.message
      console.error('[AgencyStore] fetchReceivedInvitations failed:', error)
    } finally {
      receivedInvitations.value.loading = false
    }
  }

  /**
   * Fetch sent invitations (owner/admin).
   */
  async function fetchSentInvitations(reset = false): Promise<void> {
    if (reset) {
      sentInvitations.value.items = []
      sentInvitations.value.cursor = null
      sentInvitations.value.hasMore = true
    }

    if (!sentInvitations.value.hasMore || sentInvitations.value.loading) return

    sentInvitations.value.loading = true
    sentInvitations.value.error = null

    try {
      const params = { per_page: 20 }

      const response = await api<{ data: AgencyInvitation[] }>(
        '/user/agency/invitations/sent',
        { params }
      )

      sentInvitations.value.items = response.data
      sentInvitations.value.hasMore = false
    } catch (error) {
      const err = normalizeError(error)
      sentInvitations.value.error = err.message
      console.error('[AgencyStore] fetchSentInvitations failed:', error)
    } finally {
      sentInvitations.value.loading = false
    }
  }

  /**
   * Send invitation to user (owner/admin).
   */
  async function sendInvitation(request: SendInvitationRequest): Promise<AgencyInvitation | null> {
    try {
      const response = await api<{ data: AgencyInvitation }>(
        '/user/agency/invitations',
        { method: 'POST', body: request }
      )

      sentInvitations.value.items.unshift(response.data)

      toast.add({ title: 'Invitation Sent', description: 'Invitation sent successfully.', color: 'success' })
      return response.data
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[AgencyStore] sendInvitation failed:', error)
      return null
    }
  }

  /**
   * Cancel invitation (owner/admin/inviter).
   */
  async function cancelInvitation(invitationId: number): Promise<boolean> {
    try {
      await api(`/user/agency/invitations/${invitationId}`, { method: 'DELETE' })

      sentInvitations.value.items = sentInvitations.value.items.filter(
        i => i.id !== invitationId
      )

      toast.add({ title: 'Cancelled', description: 'Invitation cancelled.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[AgencyStore] cancelInvitation failed:', error)
      return false
    }
  }

  /**
   * Accept invitation.
   */
  async function acceptInvitation(invitationId: number): Promise<boolean> {
    try {
      const response = await api<{ data: AgencyMember }>(
        `/invitations/${invitationId}/accept`,
        { method: 'POST' }
      )

      // Remove from received invitations
      receivedInvitations.value.items = receivedInvitations.value.items.filter(
        i => i.id !== invitationId
      )

      // Refresh user agency
      await fetchUserAgency()

      toast.add({ title: 'Joined', description: 'You have joined the agency!', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[AgencyStore] acceptInvitation failed:', error)
      return false
    }
  }

  /**
   * Decline invitation.
   */
  async function declineInvitation(invitationId: number): Promise<boolean> {
    try {
      await api(`/invitations/${invitationId}/decline`, { method: 'POST' })

      receivedInvitations.value.items = receivedInvitations.value.items.filter(
        i => i.id !== invitationId
      )

      toast.add({ title: 'Declined', description: 'Invitation declined.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[AgencyStore] declineInvitation failed:', error)
      return false
    }
  }

  // ========================================
  // Member Management Actions
  // ========================================

  /**
   * Kick member from agency (owner/admin).
   */
  async function kickMember(memberId: number, request?: KickMemberRequest): Promise<boolean> {
    try {
      await api(`/user/agency/members/${memberId}`, {
        method: 'DELETE',
        body: request,
      })

      currentAgency.value.members = currentAgency.value.members.filter(
        m => m.id !== memberId
      )

      toast.add({ title: 'Removed', description: 'Member removed from agency.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[AgencyStore] kickMember failed:', error)
      return false
    }
  }

  /**
   * Block user from agency (owner/admin).
   */
  async function blockUser(userId: number): Promise<boolean> {
    try {
      await api(`/user/agency/users/${userId}/block`, { method: 'POST' })
      toast.add({ title: 'Blocked', description: 'User blocked from agency.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[AgencyStore] blockUser failed:', error)
      return false
    }
  }

  /**
   * Unblock user (owner/admin).
   */
  async function unblockUser(userId: number): Promise<boolean> {
    try {
      await api(`/user/agency/users/${userId}/block`, { method: 'DELETE' })
      toast.add({ title: 'Unblocked', description: 'User unblocked.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[AgencyStore] unblockUser failed:', error)
      return false
    }
  }

  /**
   * Block agency (user blocks agency from sending invitations).
   */
  async function blockAgency(agencyId: number): Promise<boolean> {
    try {
      await api(`/agencies/${agencyId}/block`, { method: 'POST' })
      toast.add({ title: 'Blocked', description: 'Agency blocked.', color: 'success' })
      return true
    } catch (error) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
      console.error('[AgencyStore] blockAgency failed:', error)
      return false
    }
  }

  /**
   * Unblock agency.
   */
  async function unblockAgency(agencyId: number): Promise<boolean> {
    try {
      await api(`/agencies/${agencyId}/block`, { method: 'DELETE' })
      toast.add({ title: 'Unblocked', description: 'Agency unblocked.', color: 'success' })
      return true
    } catch (error) {
      toast.add({ title: 'Error', description: 'Failed to unblock agency.', color: 'error' })
      console.error('[AgencyStore] unblockAgency failed:', error)
      return false
    }
  }

  // ========================================
  // Reset State
  // ========================================

  function $reset(): void {
    userAgency.value = {
      agency: null,
      membership: null,
      isOwner: false,
      loading: false,
      error: null,
    }
    agencies.value = {
      items: [],
      loading: false,
      error: null,
      hasMore: true,
      cursor: null,
      filters: { search: '', country: '' },
    }
    currentAgency.value = {
      agency: null,
      members: [],
      loading: false,
      membersLoading: false,
      membersCursor: null,
      membersHasMore: true,
      error: null,
    }
    receivedInvitations.value = {
      items: [],
      loading: false,
      error: null,
      hasMore: true,
      cursor: null,
    }
    sentInvitations.value = {
      items: [],
      loading: false,
      error: null,
      hasMore: true,
      cursor: null,
    }
    joinRequests.value = {
      items: [],
      loading: false,
      error: null,
      hasMore: true,
      cursor: null,
    }
    myJoinRequests.value = {
      items: [],
      loading: false,
      error: null,
      hasMore: true,
      cursor: null,
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    userAgency,
    agencies,
    currentAgency,
    receivedInvitations,
    sentInvitations,
    joinRequests,
    myJoinRequests,

    // Computed
    isAgencyMember,
    isAgencyOwner,
    isAgencyAdmin,
    canManageMembers,
    canLeaveAgency,

    // User Agency Actions
    fetchUserAgency,
    leaveAgency,
    dissolveAgency,
    changeCoinReseller,

    // Agency Browsing
    fetchAgencies,
    fetchAgencyById,
    fetchAgencyMembers,
    createAgency,

    // Join Requests
    requestToJoin,
    cancelJoinRequest,
    fetchMyJoinRequests,
    fetchJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,

    // Invitations
    fetchReceivedInvitations,
    fetchSentInvitations,
    sendInvitation,
    cancelInvitation,
    acceptInvitation,
    declineInvitation,

    // Member Management
    kickMember,
    blockUser,
    unblockUser,
    blockAgency,
    unblockAgency,

    // Reset
    $reset,
  }
})
