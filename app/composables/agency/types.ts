// ========================================
// Agency Composables - Shared Types
// ========================================

import type { Agency, AgencyMember } from '~/types/agency/agency'

// ========================================
// State Types
// ========================================

/**
 * Generic paginated state for lists.
 */
export interface PaginatedState<T> {
  items: T[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}

/**
 * User's agency context state.
 */
export interface UserAgencyState {
  agency: Agency | null
  membership: AgencyMember | null
  isOwner: boolean
  loading: boolean
  error: string | null
}

/**
 * Current agency detail view state.
 */
export interface CurrentAgencyState {
  agency: Agency | null
  members: AgencyMember[]
  loading: boolean
  membersLoading: boolean
  membersCursor: string | null
  membersHasMore: boolean
  error: string | null
}
