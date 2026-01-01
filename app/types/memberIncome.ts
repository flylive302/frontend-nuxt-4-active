// ========================================
// Member Income Types (for Agency Owners)
// ========================================

/**
 * Current target info for an agency member.
 */
export interface MemberIncomeTarget {
  tier: string
  required_coins: number
  earned_coins: number
  progress_percentage: number
  coins_to_complete: number
  days_remaining: number
  diamond_reward: number
}

/**
 * Individual member income info.
 */
export interface MemberIncome {
  user_id: number
  name: string
  avatar_url: string | null
  joined_at: string
  current_target: MemberIncomeTarget | null
  total_diamonds_earned: number
  total_coins_contributed: number
  completed_targets_count: number
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
