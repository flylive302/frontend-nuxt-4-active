// ========================================
// Room Membership Store (Slimmed Down)
// ========================================
//
// This store contains STATE and COMPUTED ONLY.
// All actions are in composables: app/composables/room/
// ========================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createLogger } from '~/utils/logger'
import type {
  RoomMember,
  RoomJoinRequest,
  RoomInvitation,
  RoomLevelProgress,
} from '~/types/room'
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
  const log = createLogger('[RoomMembershipStore]')

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

  // ========================================
  // Computed
  // ========================================

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
      resetLists()
    }
  }

  /**
   * Reset all lists.
   */
  function resetLists(): void {
    members.value = createPaginatedList()
    joinRequests.value = createPaginatedList()
    myJoinRequests.value = createPaginatedList()
    receivedInvitations.value = createPaginatedList()
    sentInvitations.value = createPaginatedList()
  }

  /**
   * Reset all state.
   */
  function reset(): void {
    currentRoomId.value = null
    levelProgress.value = null
    levelLoading.value = false
    levelError.value = null
    resetLists()
  }

  // ========================================
  // Socket Event Handlers
  // ========================================

  /**
   * Handle member.joined event - add new member to list.
   */
  function onMemberJoined(data: { room_id: number; member: RoomMember }): void {
    if (data.room_id !== currentRoomId.value) return
    
    // Add member if not already in list
    const exists = members.value.items.some(m => m.user_id === data.member.user_id)
    if (!exists) {
      members.value.items.push(data.member)
    }
  }

  /**
   * Handle member.left event - remove member from list.
   */
  function onMemberLeft(data: { room_id: number; user_id: number }): void {
    if (data.room_id !== currentRoomId.value) return
    
    members.value.items = members.value.items.filter(m => m.user_id !== data.user_id)
  }

  /**
   * Handle member.kicked event - remove member from list.
   */
  function onMemberKicked(data: { room_id: number; user_id: number }): void {
    if (data.room_id !== currentRoomId.value) return
    
    members.value.items = members.value.items.filter(m => m.user_id !== data.user_id)
  }

  /**
   * Handle member.blocked event - remove member from list.
   */
  function onMemberBlocked(data: { room_id: number; user_id: number }): void {
    if (data.room_id !== currentRoomId.value) return
    
    members.value.items = members.value.items.filter(m => m.user_id !== data.user_id)
  }

  /**
   * Handle member.role_changed event - update member's role.
   */
  function onMemberRoleChanged(data: { room_id: number; user_id: number; new_role: string }): void {
    if (data.room_id !== currentRoomId.value) return
    
    const member = members.value.items.find(m => m.user_id === data.user_id)
    if (member) {
      member.role = data.new_role as RoomMember['role']
    }
    
    // Also update myMembership if this is the current user
    if (myMembership.value && myMembership.value.user_id === data.user_id) {
      myMembership.value = {
        ...myMembership.value,
        role: data.new_role as RoomMember['role'],
      }
    }
  }

  /**
   * Handle join_request_approved event - set current user as member.
   * @param currentViewedRoomId - The room ID the user is currently viewing (from roomStore)
   */
  function onJoinRequestApproved(data: { room_id: number; user_id: number }, currentViewedRoomId?: number | null): void {
    log.debug('onJoinRequestApproved called with:', data, 'currentViewedRoomId:', currentViewedRoomId)
    
    // Clear pending request (with null check)
    myJoinRequests.value.items = myJoinRequests.value.items.filter(r => r && r.room_id !== data.room_id)
    
    // Set myMembership if it's for the current room
    const isCurrentRoom = data.room_id === currentViewedRoomId || data.room_id === currentRoomId.value
    if (isCurrentRoom) {
      log.debug('Setting myMembership for current room')
      myMembership.value = {
        id: 0,
        room_id: data.room_id,
        user_id: data.user_id,
        role: 'member',
        status: 'active',
        created_at: new Date().toISOString(),
        joined_at: new Date().toISOString(),
        user: null as any, // Will be refetched from API
      } as RoomMember
      log.debug('myMembership set to:', myMembership.value)
    } else {
      log.debug('Room ID mismatch, not setting myMembership. data.room_id:', data.room_id, 'currentRoomId:', currentRoomId.value)
    }
  }

  /**
   * Handle join_request_rejected event - clear pending request.
   */
  function onJoinRequestRejected(data: { room_id: number }): void {
    log.debug('onJoinRequestRejected called with:', data)
    myJoinRequests.value.items = myJoinRequests.value.items.filter(r => r && r.room_id !== data.room_id)
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

    // Computed
    pendingRequestCount,

    // Actions
    setRoom,
    resetLists,
    reset,

    // Socket Event Handlers
    onMemberJoined,
    onMemberLeft,
    onMemberKicked,
    onMemberBlocked,
    onMemberRoleChanged,
    onJoinRequestApproved,
    onJoinRequestRejected,
  }
})
