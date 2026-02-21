// ========================================
// Bootstrap Response Types
// ========================================

import type { Gift } from '../gift/gift'

// ========================================
// User Types
// ========================================

/**
 * Minimal user for nested references (room owner, members, etc.)
 * Used in: Room.owner, RoomMember.user, AgencyMember.user, etc.
 */
export interface MinimalUser {
  id: number
  name: string
  signature: string
  phone: string
  country: string
  wealth_xp: string
  charm_xp: string
  frame: string | null
  avatar: string | null
  email: string | null
  gender: string | null
  date_of_birth: string | null
}

/**
 * Bootstrap user - authenticated user from bootstrap.
 * Returned by: GET /bootstrap, POST /auth/login, POST /auth/register, GET /auth/user
 */
export interface BootstrapUser {
  // Identity
  id: number
  name: string
  signature: string
  avatar: string | null
  frame: string | null

  // Contact & Location
  phone: string | null          // E.164 format
  country: string | null        // ISO 2-letter code

  // Demographics
  gender: string | null
  date_of_birth: string | null  // YYYY-MM-DD

  // Economy
  coins: string                 // Integer as string
  diamonds: string              // Integer as string
  wealth_xp: string             // Integer as string
  charm_xp: string              // Integer as string

  // VIP
  vip_level: number             // 0 = no VIP, 1-8 = VIP level
  vip_level_id: number | null   // FK to vip_levels table
  vip_expires_at: string | null // ISO 8601

  // Profile
  is_profile_complete: boolean

  // Block status (auth-time checks)
  is_blocked: boolean
  blocked_at: string | null     // ISO 8601
  blocked_reason: string | null
  locked_until: string | null   // ISO 8601
}

// ========================================
// Level Types
// ========================================

/**
 * Level status for a user (wealth or charm).
 */
export interface LevelStatus {
  current_level: number
  level_name: string
  current_xp: number
  xp_for_next_level: number
  xp_remaining: number
  progress_percentage: number
  badge: {
    id: number
    name: string
    image_url: string
  } | null
  next_level: {
    level: number
    name: string
    required_xp: number
  } | null
}

/**
 * Level configuration item (wealth, charm, or room levels).
 */
export interface LevelConfig {
  level: number
  name: string
  required_xp: number
  badge_id: number | null
}

/**
 * Badge for levels.
 */
export interface LevelBadge {
  id: number
  name: string
  image_url: string | null
  category: 'wealth' | 'charm' | 'room' | 'level' | 'special'
}

// ========================================
// Income Target Types
// ========================================

/**
 * Income target from bootstrap.
 */
export interface BootstrapIncomeTarget {
  id: number
  tier: string // e.g., 'T1', 'T2'
  name: string
  required_coins: string
  earned_coins: string
  coins_to_complete: string
  start_date: string // ISO 8601
  end_date: string // ISO 8601
  member_diamond_reward: string
  owner_diamond_reward: string
  is_completed: boolean
}

// ========================================
// Room Types
// ========================================

/**
 * Room from bootstrap (with MinimalUser owner).
 */
export interface BootstrapRoom {
  id: number
  name: string
  description: string | null
  logo: string | null
  topic: string | null
  room_xp: string
  current_level: number
  sort_order: number
  is_live: boolean
  participant_count: number
  max_seats: number
  owner: MinimalUser
}

// ========================================
// User Badges
// ========================================

/**
 * User's earned/displayed badge.
 */
export interface UserBadge {
  id: number
  badge_id: number
  badge: LevelBadge
  earned_at: string
  is_displayed: boolean
}

// ========================================
// Agency Types
// ========================================

/**
 * User's agency membership context.
 */
export interface BootstrapAgency {
  agency_id: number
  agency_name: string
  agency_logo: string | null
  member_count: number
  role: 'owner' | 'admin' | 'member'
  is_owner: boolean
  joined_at: string // ISO 8601
}

// ========================================
// Bootstrap Config
// ========================================

/**
 * Economy configuration.
 */
export interface EconomyConfig {
  room_owner_percentage: number
  receiver_percentage: number
}

/**
 * Full config from bootstrap.
 */
export interface BootstrapConfig {
  api_version: string
  economy: EconomyConfig
  wealth_levels: LevelConfig[]
  charm_levels: LevelConfig[]
  room_levels: LevelConfig[]
  level_badges: LevelBadge[]
  vapid_public_key: string | null
}

// ========================================
// Bootstrap Response
// ========================================

/**
 * User data section of bootstrap.
 */
export interface BootstrapUserData {
  levels: {
    wealth: LevelStatus
    charm: LevelStatus
  }
  active_income_target: BootstrapIncomeTarget | null
  room: BootstrapRoom | null
  badges: UserBadge[]
  agency: BootstrapAgency | null
}

/**
 * Gifts section of bootstrap.
 */
export interface BootstrapGifts {
  catalog: Gift[]
  total: number
}

/**
 * Full bootstrap API response.
 * GET /api/v1/bootstrap
 */
export interface BootstrapResponse {
  user: BootstrapUser
  user_data: BootstrapUserData
  gifts: BootstrapGifts
  config: BootstrapConfig
}
