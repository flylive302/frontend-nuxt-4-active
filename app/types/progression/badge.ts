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
 * Matches Backend: BadgeService::getCategoriesWithMeta()
 */
export interface BadgeCategoryInfo {
  value: string
  label: string
  color: string
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
  level: BadgeSourceType
  sort_order: number
  rarity?: string
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
 * Matches Backend: BadgeService::getUserBadgeStats()
 */
export interface BadgeStats {
  total: number
  by_category: Partial<Record<BadgeCategory, number>>
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
}

/**
 * API response for badge categories.
 */
export interface BadgeCategoriesResponse {
  success: true
  data: BadgeCategoryInfo[]
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


