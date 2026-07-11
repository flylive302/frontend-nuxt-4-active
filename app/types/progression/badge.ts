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

/**
 * Validity status of a user's badge grant(s), aggregated per badge.
 */
export type BadgeStatus = 'active' | 'expired'

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
  /** Animated asset URL (svga/vap/video); null/undefined = static badge. */
  asset_url?: string | null
}

/**
 * User's earned badge — ONE entry per badge, aggregated across grant rows.
 * Matches Backend: UserBadgeResource ({ id, badge, source_type, source_id, earned_at,
 * status, active_count, expires_at, days_remaining }).
 */
export interface UserBadge {
  id: number
  badge: Badge
  earned_at: string // ISO 8601
  source_type: BadgeSourceType
  source_id?: number
  /** 'active' | 'expired' — expired means all grant rows for this badge have lapsed. */
  status: BadgeStatus
  /** Count of currently-active grant rows ("xN" display). */
  active_count: number
  /** ISO8601 | null — null when permanent OR expired (check `status`). */
  expires_at: string | null
  /** Days until expiry, STATIC at fetch time — null when permanent or expired. */
  days_remaining: number | null
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
  /** Animated asset URL (svga/vap/video); null/undefined = static badge. */
  asset_url?: string | null
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
  /** Number of owned grant-entries merged into this card (legacy aggregate; see activeCount for display). */
  count: number
  /** Sum of active_count across merged entries; 0 when locked. Drives the "xN" pill. */
  activeCount: number
  /** null when locked (never owned). */
  status: BadgeStatus | null
  earnedAt: string | null
  /** Soonest active expiry among merged entries; null when locked, expired, or permanent. */
  expiresAt: string | null
  /** Days remaining for the soonest-expiring active entry; null when locked, expired, or permanent. */
  daysRemaining: number | null
  isLocked: boolean
}

/**
 * Parameters for fetching badges.
 */
export interface GetBadgesParams {
  per_page?: number
}
