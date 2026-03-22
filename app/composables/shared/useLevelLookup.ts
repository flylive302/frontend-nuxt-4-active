// ========================================
// Level Lookup Composable
// ========================================
// Role: Data/Query — pure level/badge lookup from bootstrap config.

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
    if (!bootstrapStore.config) return { level: 0, name: 'Unknown', badge: null }

    const xpNum = typeof xp === 'string' ? parseFloat(xp) : (xp ?? 0)
    const sorted = category === 'wealth'
      ? bootstrapStore.sortedWealthLevels
      : bootstrapStore.sortedCharmLevels

    // Find highest matching level via reverse scan (early exit)
    let matched: (typeof sorted)[number] | undefined
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (xpNum >= sorted[i]!.required_xp) {
        matched = sorted[i]
        break
      }
    }

    if (!matched) return { level: 0, name: 'Beginner', badge: null }

    const badge = matched.badge_id ? bootstrapStore.badgeMap.get(matched.badge_id) : null
    return {
      level: matched.level,
      name: matched.name,
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
