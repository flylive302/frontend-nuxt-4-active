// ========================================
// Level Lookup Composable
// ========================================
// Role: Data/Query — pure level/badge lookup from bootstrap config.

import { computeLevelStatus } from '~/utils/levels'

// ========================================
// Constants
// ========================================

export const DEFAULT_WEALTH_BADGE = 'https://assets.flyliveapp.com/badges/wealth/level_0.webp'
export const DEFAULT_CHARM_BADGE = 'https://assets.flyliveapp.com/badges/charm/level_0.webp'

// ========================================
// Types
// ========================================

export type LevelCategory = 'wealth' | 'charm'

export interface LevelInfo {
  level: number
  name: string
  badge: { id: number; name: string; image_url: string } | null
}

// ========================================
// Composable
// ========================================

/**
 * Composable for XP-to-level and XP-to-badge lookups.
 * Reads from bootstrap store config (read-only).
 */
export function useLevelLookup() {
  const bootstrapStore = useBootstrapStore()

  /**
   * Get level info from XP value.
   * O(n) search but levels array is small (~50 items max).
   */
  function getLevelFromXp(
    xp: string | number | null | undefined,
    category: LevelCategory
  ): LevelInfo {
    if (!bootstrapStore.isReady) return { level: 0, name: 'Unknown', badge: null }

    const sorted = category === 'wealth'
      ? bootstrapStore.sortedWealthLevels
      : bootstrapStore.sortedCharmLevels

    const status = computeLevelStatus(xp, sorted)

    const badge = status.badge_id ? bootstrapStore.badgeMap.get(status.badge_id) : null
    return {
      level: status.current_level,
      name: status.level_name,
      badge: badge?.image_url
        ? { id: badge.id, name: badge.name, image_url: badge.image_url }
        : null,
    }
  }

  /**
   * Get badge image URL from XP value.
   */
  function getBadgeFromXp(
    xp: string | number | null | undefined,
    category: LevelCategory,
    fallback?: string
  ): string {
    const defaultFallback = category === 'wealth' ? DEFAULT_WEALTH_BADGE : DEFAULT_CHARM_BADGE
    return getLevelFromXp(xp, category).badge?.image_url ?? fallback ?? defaultFallback
  }

  return {
    getLevelFromXp,
    getBadgeFromXp,
  }
}
