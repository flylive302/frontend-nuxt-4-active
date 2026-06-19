// ========================================
// Member Income Types (for Agency Owners)
// ========================================
// Lightweight current-tier view per member (no full ladder).

/**
 * Compact current-run view for an agency member.
 */
export interface MemberCurrentRun {
  run_id: number
  accumulated_xp: number
  current_tier: number
  band_floor: number | null
  band_ceiling: number | null
  progress_percentage: number | null
  ends_at: string
}

/**
 * Individual member income info.
 */
export interface MemberIncome {
  user_id: number
  name: string
  avatar_url: string | null
  joined_at: string
  current_run: MemberCurrentRun | null
  total_diamonds_earned: number
}

/**
 * Agency members income response.
 */
export interface MembersIncomeResponse {
  agency_id: number
  agency_name: string
  members: MemberIncome[]
}

/**
 * Pagination for member income list.
 */
export interface MemberIncomePagination {
  per_page: number
  next_cursor: string | null
  prev_cursor: string | null
  has_more: boolean
}
