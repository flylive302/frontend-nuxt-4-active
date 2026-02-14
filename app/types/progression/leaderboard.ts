// ========================================
// Room Gift Leaderboard Types
// ========================================

import type { MinimalUser } from '~/types/user/bootstrap'

// ========================================
// Constants
// ========================================

/**
 * Available leaderboard time periods.
 */
export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all'

// ========================================
// API Types
// ========================================

/**
 * Single leaderboard entry from API.
 */
export interface LeaderboardEntry {
  rank: number
  user: MinimalUser
  total_spent: number
  gift_count: number
}

/**
 * Pagination metadata from API response.
 */
export interface LeaderboardPagination {
  path: string
  per_page: number
  next_cursor: string | null
  prev_cursor: string | null
}

/**
 * Full API response for gift leaderboard.
 */
export interface GiftLeaderboardResponse {
  status: 'success' | 'error'
  message: string
  data: LeaderboardEntry[]
  meta: {
    pagination: LeaderboardPagination
    room_id: number
    period: LeaderboardPeriod
    period_start: string | null
    period_end: string
    timestamp: string
    correlation_id: string
  }
}
