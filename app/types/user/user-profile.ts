/**
 * User Profile Types
 *
 * Type definitions for the User Profile API.
 * Backend API: GET /api/v1/users/profile/{signature}
 */

import type { EquippedBadge } from '~/types/progression/badge'

// ============================================
// CORE TYPES
// ============================================

// Note: Avatar is now a single URL string (use Nuxt Image for transforms)

/**
 * Agency information (if user is a member).
 */
export interface ProfileAgency {
  id: number
  name: string
  logo: string
  country: string
  total_member_count: number
}

/**
 * Gift rarity levels.
 */
export type GiftRarity = 'common' | 'rare' | 'epic' | 'legendary'

/**
 * Gift received aggregate for profile display.
 */
export interface ProfileGiftReceived {
  label: string
  thumbnail_url: string
  rarity: GiftRarity
  total_quantity_received: number
}

/**
 * Owned prop (entry animation / frame) for public profile tabs.
 */
export interface ProfilePropItem {
  id: number
  prop_id: number
  type: string
  name: string
  thumbnail_url: string | null
  asset_url: string | null
}

/**
 * Minimal shape required by the shared prop preview modal.
 * Gifts satisfy it too (thumbnail-only preview).
 */
export interface PropPreviewItem {
  name: string
  type?: string
  asset_url?: string | null
  thumbnail_url?: string | null
  /** Catalog prop id (same id space as e.g. `user.frame_id`) — used to resolve frame geometry. */
  prop_id?: number
}

/**
 * Gender values used in the API.
 * 1=Male, 2=Female, 3=Non-binary, 4=Not specified
 */
export type ProfileGender = 1 | 2 | 3 | 4

/**
 * Gender display labels.
 */
export const GENDER_LABELS: Record<ProfileGender, string> = {
  1: 'Male',
  2: 'Female',
  3: 'Non-binary',
  4: 'Not specified',
} as const

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Main user profile data returned from API.
 * Updated 2026-01-16: avatar is now string, removed gift coin totals
 */
export interface UserProfile {
  id: number
  name: string | null
  signature: string
  avatar: string | null  // Single URL - use Nuxt Image for transforms
  cover_image: string | null
  vip_level: number
  frame_id: number | null
  chat_bubble_id: number | null
  entry_animation_id: number | null
  data_card_id: number | null
  mice_wave_id: number | null
  slides_id: number | null
  gender: ProfileGender | null
  /** ISO 8601 timestamp of this user's last activity; null if never active. */
  last_seen_at: string | null
  wealth_xp: string   // Use instead of total_gift_coins_sent
  charm_xp: string    // Use instead of total_gift_coins_received
  profile_visits: number
  agency: ProfileAgency | null
  room_id: number | null
  followers_count: number
  following_count: number
  is_follow_list_public: boolean
  gifts_received: ProfileGiftReceived[]
  gifts_next_cursor: string | null
  gifts_has_more: boolean
  equipped_badges?: EquippedBadge[]
}

/**
 * API response wrapper for user profile.
 */
export interface UserProfileResponse {
  status: 'success'
  message: string
  data: UserProfile
  meta: {
    timestamp: string
    correlation_id: string
  }
}

/**
 * API response for paginated gifts.
 */
export interface UserProfileGiftsResponse {
  status: 'success'
  data: ProfileGiftReceived[]
  meta: {
    next_cursor: string | null
    has_more: boolean
  }
}

// ============================================
// UI HELPER TYPES
// ============================================

/**
 * Rarity configuration for styling.
 */
export interface RarityConfig {
  label: string
  color: 'neutral' | 'info' | 'secondary' | 'warning'
  borderClass: string
}

/**
 * Rarity visual configuration for UI.
 */
export const GIFT_RARITY_CONFIG: Record<GiftRarity, RarityConfig> = {
  common: {
    label: 'Common',
    color: 'neutral',
    borderClass: 'border-neutral-500',
  },
  rare: {
    label: 'Rare',
    color: 'info',
    borderClass: 'border-info',
  },
  epic: {
    label: 'Epic',
    color: 'secondary',
    borderClass: 'border-secondary',
  },
  legendary: {
    label: 'Legendary',
    color: 'warning',
    borderClass: 'border-warning',
  },
} as const
