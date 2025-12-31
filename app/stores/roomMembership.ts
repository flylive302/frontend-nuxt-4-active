// ========================================
// Room Membership Store
// ========================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  RoomMember,
  RoomJoinRequest,
  RoomInvitation,
  RoomLevelProgress,
  RoomMemberRole,
  GetRoomMembersParams,
  JoinRoomRequest,
  InviteToRoomRequest,
  RoomMemberPagination,
} from '~/types/room'

// ========================================
// Types
// ========================================

interface MemberListState {
  items: RoomMember[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}

interface RequestListState {
  items: RoomJoinRequest[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}

interface InvitationListState {
  items: RoomInvitation[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}

// ========================================
// Store Definition
// ========================================

export const useRoomMembershipStore = defineStore('roomMembership', () => {
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // State
  // ========================================

  const currentRoomId = ref<number | null>(null)
  const levelProgress = ref<RoomLevelProgress | null>(null)
  const levelLoading = ref(false)

  const members = ref<MemberListState>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  const joinRequests = ref<RequestListState>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  const myJoinRequests = ref<RequestListState>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  const receivedInvitations = ref<InvitationListState>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  const sentInvitations = ref<InvitationListState>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  // ========================================
  // Computed
  // ========================================

  /**
   * Check if user is member of current room.
   */
  function isMemberOf(userId: number): boolean {
    return members.value.items.some(m => m.user_id === userId)
  }

  /**
   * Get member by user ID.
   */
  function getMember(userId: number): RoomMember | undefined {
    return members.value.items.find(m => m.user_id === userId)
  }

  /**
   * Members by role.
   */
  function membersByRole(role: RoomMemberRole): RoomMember[] {
    return members.value.items.filter(m => m.role === role)
  }

  /**
   * Pending join request count.
   */
  const pendingRequestCount = computed(() => 
    joinRequests.value.items.filter(r => r.status === 'pending').length
  )

  // ========================================
  // Actions
  // ========================================

  /**
   * Set current room context.
   */
  function setRoom(roomId: number): void {
    if (currentRoomId.value !== roomId) {
      currentRoomId.value = roomId
      // Reset state when switching rooms
      resetLists()
    }
  }

  /**
   * Fetch room members.
   */
  async function fetchMembers(roomId: number, params: GetRoomMembersParams = {}, reset = false): Promise<void> {
    if (reset) {
      members.value.items = []
      members.value.cursor = null
      members.value.hasMore = true
    }

    if (!members.value.hasMore || members.value.loading) return

    members.value.loading = true
    members.value.error = null

    try {
      const queryParams: Record<string, unknown> = {
        per_page: params.per_page ?? 50,
      }

      if (params.role) queryParams.role = params.role
      if (members.value.cursor) queryParams.cursor = members.value.cursor

      const response = await api<{
        success: true
        data: {
          members: RoomMember[]
          pagination: RoomMemberPagination
        }
      }>(`/rooms/${roomId}/members`, { params: queryParams })

      members.value.items.push(...response.data.members)
      members.value.hasMore = response.data.pagination.has_more
      members.value.cursor = response.data.pagination.next_cursor ?? null
    } catch (err) {
      const normalized = normalizeError(err)
      members.value.error = normalized.message
      console.error('[RoomMembershipStore] fetchMembers failed:', err)
    } finally {
      members.value.loading = false
    }
  }

  /**
   * Fetch room level progress.
   */
  async function fetchLevelProgress(roomId: number): Promise<void> {
    levelLoading.value = true

    try {
      const response = await api<{
        success: true
        data: RoomLevelProgress
      }>(`/rooms/${roomId}/level`)

      levelProgress.value = response.data
    } catch (err) {
      console.error('[RoomMembershipStore] fetchLevelProgress failed:', err)
    } finally {
      levelLoading.value = false
    }
  }

  /**
   * Request to join a room.
   */
  async function requestToJoin(roomId: number, request?: JoinRoomRequest): Promise<RoomJoinRequest | null> {
    try {
      const response = await api<{ data: RoomJoinRequest }>(`/rooms/${roomId}/join`, {
        method: 'POST',
        body: request,
      })

      myJoinRequests.value.items.unshift(response.data)
      toast.add({ title: 'Request Sent', description: 'Your join request has been submitted.', color: 'success' })
      return response.data
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: 'Error', description: normalized.message, color: 'error' })
      console.error('[RoomMembershipStore] requestToJoin failed:', err)
      return null
    }
  }

  /**
   * Cancel join request.
   */
  async function cancelJoinRequest(roomId: number): Promise<boolean> {
    try {
      await api(`/rooms/${roomId}/join`, { method: 'DELETE' })
      myJoinRequests.value.items = myJoinRequests.value.items.filter(r => r.room_id !== roomId)
      toast.add({ title: 'Cancelled', description: 'Join request cancelled.', color: 'success' })
      return true
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: 'Error', description: normalized.message, color: 'error' })
      return false
    }
  }

  /**
   * Fetch incoming join requests (room owner/admin).
   */
  async function fetchJoinRequests(roomId: number, reset = false): Promise<void> {
    if (reset) {
      joinRequests.value.items = []
      joinRequests.value.cursor = null
      joinRequests.value.hasMore = true
    }

    if (!joinRequests.value.hasMore || joinRequests.value.loading) return

    joinRequests.value.loading = true
    joinRequests.value.error = null

    try {
      const response = await api<{
        success: true
        data: {
          requests: RoomJoinRequest[]
          pagination: RoomMemberPagination
        }
      }>(`/rooms/${roomId}/join-requests`)

      joinRequests.value.items.push(...response.data.requests)
      joinRequests.value.hasMore = response.data.pagination.has_more
      joinRequests.value.cursor = response.data.pagination.next_cursor ?? null
    } catch (err) {
      const normalized = normalizeError(err)
      joinRequests.value.error = normalized.message
      console.error('[RoomMembershipStore] fetchJoinRequests failed:', err)
    } finally {
      joinRequests.value.loading = false
    }
  }

  /**
   * Approve join request.
   */
  async function approveJoinRequest(roomId: number, requestId: number): Promise<boolean> {
    try {
      await api(`/rooms/${roomId}/join-requests/${requestId}/approve`, { method: 'POST' })
      joinRequests.value.items = joinRequests.value.items.filter(r => r.id !== requestId)
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
  async function rejectJoinRequest(roomId: number, requestId: number): Promise<boolean> {
    try {
      await api(`/rooms/${roomId}/join-requests/${requestId}/reject`, { method: 'POST' })
      joinRequests.value.items = joinRequests.value.items.filter(r => r.id !== requestId)
      toast.add({ title: 'Rejected', description: 'Join request rejected.', color: 'success' })
      return true
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: 'Error', description: normalized.message, color: 'error' })
      return false
    }
  }

  /**
   * Send invitation to user.
   */
  async function sendInvitation(roomId: number, request: InviteToRoomRequest): Promise<RoomInvitation | null> {
    try {
      const response = await api<{ data: RoomInvitation }>(`/rooms/${roomId}/invitations`, {
        method: 'POST',
        body: request,
      })

      sentInvitations.value.items.unshift(response.data)
      toast.add({ title: 'Invitation Sent', description: 'Invitation sent successfully.', color: 'success' })
      return response.data
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: 'Error', description: normalized.message, color: 'error' })
      console.error('[RoomMembershipStore] sendInvitation failed:', err)
      return null
    }
  }

  /**
   * Accept room invitation.
   */
  async function acceptInvitation(invitationId: number): Promise<boolean> {
    try {
      await api(`/room-invitations/${invitationId}/accept`, { method: 'POST' })
      receivedInvitations.value.items = receivedInvitations.value.items.filter(i => i.id !== invitationId)
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
      receivedInvitations.value.items = receivedInvitations.value.items.filter(i => i.id !== invitationId)
      toast.add({ title: 'Declined', description: 'Invitation declined.', color: 'success' })
      return true
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: 'Error', description: normalized.message, color: 'error' })
      return false
    }
  }

  /**
   * Handle room level up event (real-time).
   */
  function onRoomLevelUp(newProgress: RoomLevelProgress): void {
    const oldLevel = levelProgress.value?.current_level ?? 0
    levelProgress.value = newProgress
    
    toast.add({
      title: 'Room Level Up!',
      description: `Room reached level ${newProgress.current_level}!`,
      color: 'success',
      icon: 'i-lucide-trophy',
    })
  }

  /**
   * Reset all lists.
   */
  function resetLists(): void {
    members.value = { items: [], loading: false, error: null, hasMore: true, cursor: null }
    joinRequests.value = { items: [], loading: false, error: null, hasMore: true, cursor: null }
    myJoinRequests.value = { items: [], loading: false, error: null, hasMore: true, cursor: null }
    receivedInvitations.value = { items: [], loading: false, error: null, hasMore: true, cursor: null }
    sentInvitations.value = { items: [], loading: false, error: null, hasMore: true, cursor: null }
  }

  /**
   * Reset all state.
   */
  function reset(): void {
    currentRoomId.value = null
    levelProgress.value = null
    levelLoading.value = false
    resetLists()
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    currentRoomId,
    levelProgress,
    levelLoading,
    members,
    joinRequests,
    myJoinRequests,
    receivedInvitations,
    sentInvitations,

    // Computed
    pendingRequestCount,

    // Methods
    isMemberOf,
    getMember,
    membersByRole,

    // Actions
    setRoom,
    fetchMembers,
    fetchLevelProgress,
    requestToJoin,
    cancelJoinRequest,
    fetchJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    sendInvitation,
    acceptInvitation,
    declineInvitation,
    onRoomLevelUp,
    resetLists,
    reset,
  }
})
