// ========================================
// Badge Constants
// ========================================
// Static values and configuration for badges.
// Moved from types/progression/badge.ts (types must have no runtime code).

import type { BadgeCategory } from '~/types/progression/badge'

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

/**
 * Days-remaining threshold at/below which the expiry label switches to warning color.
 */
export const BADGE_EXPIRY_WARNING_DAYS = 3

/**
 * Intersection ratio threshold for mounting/unmounting the animated badge layer.
 */
export const BADGE_VISUAL_INTERSECTION_THRESHOLD = 0.1
