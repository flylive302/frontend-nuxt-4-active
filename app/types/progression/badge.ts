// ========================================
// Badge Types
// ========================================

// ========================================
// Enums
// ========================================

/**
 * Badge category types (used in UI constants and stats).
 */
export type BadgeCategory = 'wealth' | 'charm' | 'room' | 'agency' | 'special'

/**
 * Source that awards the badge.
 */
export type BadgeSourceType =
  | 'agency_target'
  | 'event'
  | 'achievement'
  | 'special'
  | 'reward_claim'

// ========================================
// Badge Types
// ========================================

/**
 * Badge from catalog.
 * Matches Backend: BadgeResource ({ id, name, description, image_url }).
 */
export interface Badge {
  id: number
  name: string
  description: string
  image_url: string
}

/**
 * User's earned badge.
 * Matches Backend: UserBadgeResource ({ id, badge, source_type, source_id, earned_at }).
 */
export interface UserBadge {
  id: number
  badge: Badge
  earned_at: string // ISO 8601
  source_type: BadgeSourceType
  source_id?: number
}

/**
 * A single equipped badge slot for a user.
 * Matches Backend: EquippedBadgeResource ({ slot_position, badge_id, image_url }).
 * Delivered slot-ordered by the relation.
 */
export interface EquippedBadge {
  slot_position: number
  badge_id: number
  image_url: string | null
}

/**
 * Badge statistics for user.
 * Matches Backend: BadgeService::getUserBadgeStats().
 */
export interface BadgeStats {
  total: number
}

// ========================================
// API Request/Response Types
// ========================================

/**
 * A single entry in the unified catalog grid.
 * Represents one badge_id: earned (count≥1) or locked (count=0).
 * Equipped badge_ids are excluded before this is produced.
 */
export interface CatalogBadgeEntry {
  badge: Badge
  count: number
  earnedAt: string | null
  isLocked: boolean
}

/**
 * Parameters for fetching badges.
 */
export interface GetBadgesParams {
  per_page?: number
}
