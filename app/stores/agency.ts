// ========================================
// Agency Store (Slimmed Down)
// ========================================
// 
// This store contains STATE and COMPUTED ONLY.
// All actions are in composables: app/composables/agency/
// ========================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Agency,
  AgencyMember,
  AgencyInvitation,
  AgencyJoinRequest,
  AgencyListFilters,
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
  // Reset
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

    // Reset
    $reset,
  }
})
