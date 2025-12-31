// ========================================
// Income Types
// ========================================

// ========================================
// Income Target Types
// ========================================

/**
 * Status of an income target period.
 */
export type IncomeTargetStatus = 'active' | 'completed' | 'missed' | 'not_started'

/**
 * Single income target with progress tracking.
 */
export interface IncomeTarget {
  id: number
  tier: string // e.g., 'T1', 'T2', 'T3'
  name: string // e.g., 'Tier 1', 'Tier 2'
  status: IncomeTargetStatus
  required_coins: string
  earned_coins: string
  member_diamond_reward: number
  start_date: string // ISO 8601
  end_date: string // ISO 8601
  progress_percentage: number // 0-100
  days_remaining: number
  coins_to_complete: string
}

/**
 * Historical income target record.
 */
export interface IncomeTargetHistory {
  id: number
  tier: string
  name: string
  status: 'completed' | 'missed'
  required_coins: string
  earned_coins: string
  member_diamond_reward: number
  diamonds_earned: number | null // null if missed
  start_date: string
  end_date: string
  completed_at?: string // Only if status is 'completed'
}

// ========================================
// Income Summary Types
// ========================================

/**
 * Single earning record.
 */
export interface RecentEarning {
  date: string // YYYY-MM-DD
  date_formatted: string // e.g., "29 December, 2025"
  amount: string
  source: 'gift' | 'room_commission' | 'other'
  count: number // Number of transactions
}

/**
 * Income summary statistics.
 */
export interface IncomeSummary {
  total_earned: string
  total_this_month: string
  total_this_week: string
  total_today: string
  average_daily: string
  recent_earnings: RecentEarning[]
}

// ========================================
// API Request/Response Types
// ========================================

/**
 * Parameters for fetching income targets.
 */
export interface GetIncomeTargetsParams {
  status?: IncomeTargetStatus
  per_page?: number
  cursor?: string
}

/**
 * Parameters for fetching income history.
 */
export interface GetIncomeHistoryParams {
  per_page?: number
  cursor?: string
}

/**
 * API response for income stats.
 */
export interface IncomeStatsResponse {
  success: true
  data: IncomeSummary
}

/**
 * API response for active target.
 */
export interface ActiveTargetResponse {
  success: true
  data: IncomeTarget | null
}

/**
 * API response for target history.
 */
export interface IncomeHistoryResponse {
  success: true
  data: {
    targets: IncomeTargetHistory[]
    pagination: {
      has_more: boolean
      next_cursor?: string
    }
  }
}

// ========================================
// Display Helpers
// ========================================

/**
 * Colors for income target status.
 */
export const INCOME_STATUS_COLORS: Record<IncomeTargetStatus, string> = {
  active: 'text-blue-500',
  completed: 'text-green-500',
  missed: 'text-red-500',
  not_started: 'text-gray-500',
}

/**
 * Labels for income target status.
 */
export const INCOME_STATUS_LABELS: Record<IncomeTargetStatus, string> = {
  active: 'In Progress',
  completed: 'Completed',
  missed: 'Missed',
  not_started: 'Not Started',
}
