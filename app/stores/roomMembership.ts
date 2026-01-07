// ========================================
// Room Membership Store (Slimmed Down)
// ========================================
//
// This store contains STATE and COMPUTED ONLY.
// All actions are in composables: app/composables/room/
// ========================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  RoomMember,
  RoomJoinRequest,
  RoomInvitation,
  RoomLevelProgress,
} from '~/types/room'

// ========================================
// Types
// ========================================

/**
 * Generic paginated state for cursor-based pagination.
 */
interface PaginatedState<T> {
  items: T[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}

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

  const members = ref<PaginatedState<RoomMember>>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  const joinRequests = ref<PaginatedState<RoomJoinRequest>>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  const myJoinRequests = ref<PaginatedState<RoomJoinRequest>>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  const receivedInvitations = ref<PaginatedState<RoomInvitation>>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  const sentInvitations = ref<PaginatedState<RoomInvitation>>({
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
    levelError.value = null
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
    levelError,
    members,
    joinRequests,
    myJoinRequests,
    receivedInvitations,
    sentInvitations,

    // Computed
    pendingRequestCount,

    // Actions
    setRoom,
    resetLists,
    reset,
  }
})
