// ========================================
// Room Membership Store
// ========================================
//
// State + primitive setters only. Conditional and event-routing logic lives
// in app/events/room-membership.events.ts (REACT layer).
// ========================================

import { defineStore } from 'pinia'
import type {
  RoomMember,
  RoomJoinRequest,
  RoomInvitation,
  RoomLevelProgress,
} from '~/types/room/room'
import type { PaginatedList } from '~/types/shared'
import { createPaginatedList } from '~/types/shared'

// ========================================
// Types
// ========================================

// PaginatedList<T> is imported from ~/types/shared

// ========================================
// Store Definition
// ========================================

export const useRoomMembershipStore = defineStore('roomMembership', () => {
  // ========================================
  // State
  // ========================================

  const currentRoomId = ref<number | null>(null)
  const levelProgress = ref<RoomLevelProgress | null>(null)
  const levelLoading = ref(false)
  const levelError = ref<string | null>(null)

  const members = ref<PaginatedList<RoomMember>>(createPaginatedList())

  const joinRequests = ref<PaginatedList<RoomJoinRequest>>(createPaginatedList())

  const myJoinRequests = ref<PaginatedList<RoomJoinRequest>>(createPaginatedList())

  const receivedInvitations = ref<PaginatedList<RoomInvitation>>(createPaginatedList())

  const sentInvitations = ref<PaginatedList<RoomInvitation>>(createPaginatedList())

  /**
   * Current user's room membership (null if not a member).
   */
  const myMembership = ref<RoomMember | null>(null)

  /**
   * user_ids holding `admin` in the current room — the whole roster, not a
   * page of it. Moderation UI needs a target's rank, and `members` only holds
   * the pages already scrolled, so rank cannot be read from that list.
   */
  const adminIds = ref<Set<number>>(new Set())

  /** Roster already fetched for `currentRoomId` (prevents refetch per drawer). */
  const adminsLoaded = ref(false)

  // ========================================
  // Computed
  // ========================================

  const pendingRequestCount = computed(() => 
    joinRequests.value.items.filter(r => r.status === 'pending').length
  )

  // ========================================
  // Actions
  // ========================================

  function setRoom(roomId: number): void {
    if (currentRoomId.value !== roomId) {
      currentRoomId.value = roomId
      resetLists()
    }
  }

  function resetLists(): void {
    adminIds.value = new Set()
    adminsLoaded.value = false
    members.value = createPaginatedList()
    joinRequests.value = createPaginatedList()
    myJoinRequests.value = createPaginatedList()
    receivedInvitations.value = createPaginatedList()
    sentInvitations.value = createPaginatedList()
  }

  function reset(): void {
    currentRoomId.value = null
    levelProgress.value = null
    levelLoading.value = false
    levelError.value = null
    resetLists()
  }

  // ========================================
  // Setter Methods (for composable use)
  // ========================================

  function resetMembers(): void {
    members.value.items = []
    members.value.cursor = null
    members.value.hasMore = true
  }

  function setMembersLoading(loading: boolean): void {
    members.value.loading = loading
  }

  function setMembersError(error: string | null): void {
    members.value.error = error
  }

  // ========================================
  // Primitive Setters (called by REACT layer in events/)
  // ========================================

  /** True when the given roomId matches the room currently being viewed. */
  function isCurrentRoom(roomId: number): boolean {
    return roomId === currentRoomId.value
  }

  /** Add a member to the list if not already present. */
  function addMember(member: RoomMember): void {
    const exists = members.value.items.some(m => m.user_id === member.user_id)
    if (!exists) {
      members.value.items.push(member)
    }
  }

  /** Remove a member by user id. */
  function removeMember(userId: number): void {
    members.value.items = members.value.items.filter(m => m.user_id !== userId)
  }

  /** Replace the room's admin roster wholesale (result of the roster fetch). */
  function setRoomAdmins(userIds: number[]): void {
    adminIds.value = new Set(userIds)
    adminsLoaded.value = true
  }

  /**
   * Update a member's role. Also updates myMembership when it's the current
   * user, and keeps the admin roster in step so a promotion/demotion changes
   * what the moderation UI offers without a refetch.
   */
  function updateMemberRole(userId: number, newRole: RoomMember['role']): void {
    const member = members.value.items.find(m => m.user_id === userId)
    if (member) {
      member.role = newRole
    }
    if (myMembership.value && myMembership.value.user_id === userId) {
      myMembership.value = { ...myMembership.value, role: newRole }
    }

    const nextAdmins = new Set(adminIds.value)
    if (newRole === 'admin') {
      nextAdmins.add(userId)
    } else {
      nextAdmins.delete(userId)
    }
    adminIds.value = nextAdmins
  }

  /** Replace myMembership directly. */
  function setMyMembership(member: RoomMember | null): void {
    myMembership.value = member
  }

  /** Drop a pending join request from "my requests" list by room id. */
  function clearMyJoinRequest(roomId: number): void {
    myJoinRequests.value.items = myJoinRequests.value.items.filter(r => r && r.room_id !== roomId)
  }

  /** Drop a pending join request from the owner's request list by request id. */
  function removeOwnerJoinRequest(requestId: number): void {
    joinRequests.value.items = joinRequests.value.items.filter(r => r.id !== requestId)
  }

  /** Insert a join request at the front of the owner's list (no duplicates). */
  function addOwnerJoinRequest(request: RoomJoinRequest): void {
    if (!joinRequests.value.items.some(r => r.id === request.id)) {
      joinRequests.value.items.unshift(request)
    }
  }

  /** Drop a received invitation by invitation id. */
  function removeReceivedInvitation(invitationId: number): void {
    receivedInvitations.value.items = receivedInvitations.value.items.filter(i => i.id !== invitationId)
  }

  /** Insert a received invitation at the front of the list (no duplicates). */
  function addReceivedInvitation(invitation: RoomInvitation): void {
    if (!receivedInvitations.value.items.some(i => i.id === invitation.id)) {
      receivedInvitations.value.items.unshift(invitation)
    }
  }

  /** Drop a sent invitation by invitation id (e.g. after the invitee declines it). */
  function removeSentInvitation(invitationId: number): void {
    sentInvitations.value.items = sentInvitations.value.items.filter(i => i.id !== invitationId)
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    currentRoomId,
    levelProgress,
    levelLoading,
    levelError,
    members,
    joinRequests,
    myJoinRequests,
    receivedInvitations,
    sentInvitations,
    myMembership,
    adminIds,
    adminsLoaded,

    // Computed
    pendingRequestCount,

    // Setters
    setRoom,
    resetLists,
    reset,
    resetMembers,
    setMembersLoading,
    setMembersError,
    isCurrentRoom,
    addMember,
    removeMember,
    setRoomAdmins,
    updateMemberRole,
    setMyMembership,
    clearMyJoinRequest,
    removeOwnerJoinRequest,
    addOwnerJoinRequest,
    removeReceivedInvitation,
    addReceivedInvitation,
    removeSentInvitation,
  }
})
