// ========================================
// Badge Types
// ========================================

// ========================================
// Enums
// ========================================

/**
 * Badge category types.
 */
export type BadgeCategory = 'wealth' | 'charm' | 'room' | 'agency' | 'special'

/**
 * Source that awards the badge.
 */
export type BadgeSourceType =
  | 'wealth_level'
  | 'charm_level'
  | 'room_level'
  | 'agency_target'
  | 'event'
  | 'achievement'
  | 'special'

// ========================================
// Badge Types
// ========================================

/**
 * Category metadata.
 */
export interface BadgeCategoryInfo {
  id: string
  name: string
  description: string
  icon: string
}

/**
 * Badge from catalog.
 */
export interface Badge {
  id: number
  name: string
  description: string
  image_url: string
  category: BadgeCategory
  source_type: BadgeSourceType
  requirements?: string
  rarity?: 'common' | 'rare' | 'epic' | 'legendary'
  sort_order: number
}

/**
 * User's earned badge.
 */
export interface UserBadge {
  id: number
  badge_id: number
  badge: Badge
  is_displayed: boolean
  earned_at: string // ISO 8601
  source_type: BadgeSourceType
  source_id?: number
}

/**
 * Badge statistics for user.
 */
export interface BadgeStats {
  total_earned: number
  total_displayed: number
  by_category: Partial<Record<BadgeCategory, number>>
  latest_earned?: UserBadge
}

// ========================================
// API Request/Response Types
// ========================================

/**
 * Parameters for fetching badges.
 */
export interface GetBadgesParams {
  category?: BadgeCategory
  per_page?: number
  cursor?: string
}

/**
 * Pagination metadata.
 */
export interface BadgePagination {
  has_more: boolean
  next_cursor?: string
}

/**
 * API response for badge catalog.
 */
export interface BadgeCatalogResponse {
  success: true
  data: {
    badges: Badge[]
    pagination: BadgePagination
  }
}

/**
 * API response for badge categories.
 */
export interface BadgeCategoriesResponse {
  success: true
  data: BadgeCategoryInfo[]
}

/**
 * API response for user badges.
 */
export interface UserBadgesResponse {
  success: true
  data: {
    badges: UserBadge[]
    pagination: BadgePagination
  }
}

/**
 * API response for badge stats.
 */
export interface BadgeStatsResponse {
  success: true
  data: BadgeStats
}

/**
 * API response for toggle display.
 */
export interface ToggleBadgeDisplayResponse {
  success: true
  data: {
    badge: UserBadge
    displayed_count: number
    max_display: number
  }
  message: string
}

// ========================================
// Display Helpers
// ========================================

/**
 * Icons for badge categories.
 */
export const BADGE_CATEGORY_ICONS: Record<BadgeCategory, string> = {
  wealth: 'i-lucide-wallet',
  charm: 'i-lucide-sparkles',
  room: 'i-lucide-mic',
  agency: 'i-lucide-building',
  special: 'i-lucide-star',
}

/**
 * Colors for badge categories.
 */
export const BADGE_CATEGORY_COLORS: Record<BadgeCategory, string> = {
  wealth: 'text-yellow-500',
  charm: 'text-pink-500',
  room: 'text-blue-500',
  agency: 'text-purple-500',
  special: 'text-amber-500',
}

/**
 * Labels for badge categories.
 */
export const BADGE_CATEGORY_LABELS: Record<BadgeCategory, string> = {
  wealth: 'Wealth',
  charm: 'Charm',
  room: 'Room',
  agency: 'Agency',
  special: 'Special',
}

/**
 * Rarity colors.
 */
export const BADGE_RARITY_COLORS: Record<string, string> = {
  common: 'text-gray-400',
  rare: 'text-blue-500',
  epic: 'text-purple-500',
  legendary: 'text-amber-500',
}
