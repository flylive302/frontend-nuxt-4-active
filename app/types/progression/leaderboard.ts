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
export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all_time'

// ========================================
// API Types
// ========================================

/**
 * Single leaderboard entry from API.
 */
export interface LeaderboardEntry {
  rank: number
  user_id: number
  user: MinimalUser | null
  total_value: string
  gift_count: number
}

/**
 * Full API response for gift leaderboard.
 * GET /api/v1/rooms/{room}/gift-leaderboard
 */
export interface GiftLeaderboardResponse {
  success: boolean
  message: string
  data: {
    period: LeaderboardPeriod
    room_id: number
    leaderboard: LeaderboardEntry[]
  }
}
