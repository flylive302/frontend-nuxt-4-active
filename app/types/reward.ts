// ========================================
// Reward Types
// ========================================

// ========================================
// Enums
// ========================================

/**
 * Types of rewards that can be earned.
 */
export type RewardType = 'diamonds' | 'coins' | 'badge' | 'gift'

/**
 * Status of a reward.
 */
export type RewardStatus = 'pending' | 'claimed' | 'expired'

/**
 * Source that triggered the reward.
 */
export type RewardSource =
  | 'agency_target'
  | 'wealth_level'
  | 'charm_level'
  | 'room_level'
  | 'daily_login'
  | 'event'
  | 'referral'
  | 'other'

// ========================================
// Reward Types
// ========================================

/**
 * Additional data for specific reward types.
 */
export interface RewardData {
  badge_id?: number
  badge_name?: string
  badge_url?: string
  gift_id?: number
  gift_name?: string
  gift_url?: string
}

/**
 * Single reward record.
 */
export interface UserReward {
  id: number
  reward_type: RewardType
  reward_value: number | null // Null for badge rewards
  status: RewardStatus
  source: RewardSource
  source_name: string // Human-readable, e.g., 'Tier 1 Target Completed'
  reward_data?: RewardData
  expires_at?: string // ISO 8601, null if no expiry
  claimed_at?: string // ISO 8601, null if pending
  created_at: string // ISO 8601
}

/**
 * Reward statistics.
 */
export interface RewardStats {
  total_pending: number
  total_claimed: number
  pending_diamonds: number
  pending_coins: number
  claimed_diamonds: number
  claimed_coins: number
  last_claimed_at?: string
}

// ========================================
// API Request/Response Types
// ========================================

/**
 * Parameters for fetching rewards.
 */
export interface GetRewardsParams {
  status?: RewardStatus
  type?: RewardType
  per_page?: number
  cursor?: string
}

/**
 * Parameters for fetching reward history.
 */
export interface GetRewardsHistoryParams {
  per_page?: number
  cursor?: string
}

/**
 * Pagination metadata.
 */
export interface RewardPagination {
  has_more: boolean
  next_cursor?: string
}

/**
 * API response for pending rewards.
 */
export interface RewardsResponse {
  success: true
  data: {
    rewards: UserReward[]
    pagination: RewardPagination
  }
}

/**
 * API response for reward stats.
 */
export interface RewardStatsResponse {
  success: true
  data: RewardStats
}

/**
 * API response for claiming a reward.
 */
export interface ClaimRewardResponse {
  success: true
  data: {
    reward: UserReward
    new_balance?: {
      coins?: string
      diamonds?: string
    }
  }
  message: string
}

// ========================================
// Display Helpers
// ========================================

/**
 * Icons for reward types.
 */
export const REWARD_TYPE_ICONS: Record<RewardType, string> = {
  diamonds: 'i-lucide-gem',
  coins: 'i-lucide-coins',
  badge: 'i-lucide-award',
  gift: 'i-lucide-gift',
}

/**
 * Colors for reward types.
 */
export const REWARD_TYPE_COLORS: Record<RewardType, string> = {
  diamonds: 'text-cyan-500',
  coins: 'text-yellow-500',
  badge: 'text-purple-500',
  gift: 'text-pink-500',
}

/**
 * Labels for reward status.
 */
export const REWARD_STATUS_LABELS: Record<RewardStatus, string> = {
  pending: 'Available',
  claimed: 'Claimed',
  expired: 'Expired',
}

/**
 * Colors for reward status.
 */
export const REWARD_STATUS_COLORS: Record<RewardStatus, string> = {
  pending: 'text-green-500',
  claimed: 'text-muted',
  expired: 'text-red-500',
}
