// ========================================
// Level Badge Utilities
// ========================================

import type { LevelConfigItem } from '~/types/levels'

// ========================================
// Types
// ========================================

export type LevelCategory = 'wealth' | 'charm'

export interface LevelInfo {
  level: number
  name: string
  badge: {
    id: number
    name: string
    image_url: string
  } | null
}

// ========================================
// Module Cache
// ========================================

type LevelConfigCache = {
  wealth_levels: LevelConfigItem[]
  charm_levels: LevelConfigItem[]
} | null

let _levelConfigCache: LevelConfigCache = null

let _fetchPromise: Promise<LevelConfigCache> | null = null

// ========================================
// Internal Helpers
// ========================================

/**
 * Fetch level config from API and cache it.
 * Uses a promise lock to prevent duplicate requests.
 */
async function fetchLevelConfig(): Promise<LevelConfigCache> {
  // Return cached data if available
  if (_levelConfigCache) {
    return _levelConfigCache
  }

  // If a fetch is in progress, wait for it
  if (_fetchPromise) {
    return _fetchPromise
  }

  // Start new fetch
  _fetchPromise = (async (): Promise<LevelConfigCache> => {
    try {
      const { api } = useApi()
      const response = await api<{
        status: string
        data: {
          wealth_levels: LevelConfigItem[]
          charm_levels: LevelConfigItem[]
        }
      }>('/levels/config')

      _levelConfigCache = response.data
      return _levelConfigCache
    } catch (err) {
      console.error('[levelBadge] Failed to fetch level config:', err)
      return null
    } finally {
      _fetchPromise = null
    }
  })()

  return _fetchPromise
}

/**
 * Find the level info for a given XP value from a config array.
 * Levels are sorted by required_xp ascending; find the highest level where xp >= required.
 */
function findLevelFromXp(
  xp: number,
  levels: LevelConfigItem[]
): LevelInfo {
  // Sort by required_xp ascending (should already be sorted but safety first)
  const sorted = [...levels].sort((a, b) => a.required_xp - b.required_xp)

  // Find the highest level where user's XP meets the requirement
  let matchedLevel: LevelConfigItem | null = null

  for (const level of sorted) {
    if (xp >= level.required_xp) {
      matchedLevel = level
    } else {
      break
    }
  }

  // If no level matched, user is at level 0 (before first level)
  if (!matchedLevel) {
    return {
      level: 0,
      name: 'Beginner',
      badge: null,
    }
  }

  return {
    level: matchedLevel.level,
    name: matchedLevel.name,
    badge: matchedLevel.badge ? {
      id: matchedLevel.badge.id,
      name: matchedLevel.badge.name,
      image_url: matchedLevel.badge.image_url,
    } : null,
  }
}

// ========================================
// Exported Functions
// ========================================

/**
 * Get level info (level number, name, badge) from XP value.
 * Fetches and caches level config on first call.
 *
 * @param xp - XP value (string or number)
 * @param category - 'wealth' or 'charm'
 * @returns LevelInfo with level, name, and badge (or null values if error)
 *
 * @example
 * ```ts
 * const wealthInfo = await getLevelFromXp('15000.000', 'wealth')
 * console.log(wealthInfo.badge?.image_url) // '/badges/wealth/level_5.webp'
 * ```
 */
export async function getLevelFromXp(
  xp: string | number | undefined | null,
  category: LevelCategory
): Promise<LevelInfo> {
  const xpNum = typeof xp === 'string' ? parseFloat(xp) : (xp ?? 0)

  const config = await fetchLevelConfig()
  if (!config) {
    return { level: 0, name: 'Unknown', badge: null }
  }

  const levels = category === 'wealth' ? config.wealth_levels : config.charm_levels
  return findLevelFromXp(xpNum, levels)
}

/**
 * Get badge image URL from XP value.
 * Convenience wrapper around getLevelFromXp.
 *
 * @param xp - XP value (string or number)
 * @param category - 'wealth' or 'charm'
 * @param fallback - Fallback URL if no badge found
 * @returns Badge image URL or fallback
 *
 * @example
 * ```ts
 * const badgeSrc = await getBadgeFromXp(user.wealth_xp, 'wealth')
 * ```
 */
export async function getBadgeFromXp(
  xp: string | number | undefined | null,
  category: LevelCategory,
  fallback = '/badges/wealth/level_0.webp'
): Promise<string> {
  const info = await getLevelFromXp(xp, category)
  return info.badge?.image_url ?? fallback
}

/**
 * Synchronous version using pre-loaded config.
 * Must call preloadLevelConfig() first.
 *
 * @param xp - XP value
 * @param category - 'wealth' or 'charm'
 * @returns LevelInfo or null if config not loaded
 */
export function getLevelFromXpSync(
  xp: string | number | undefined | null,
  category: LevelCategory
): LevelInfo | null {
  if (!_levelConfigCache) {
    return null
  }

  const xpNum = typeof xp === 'string' ? parseFloat(xp) : (xp ?? 0)
  const levels = category === 'wealth'
    ? _levelConfigCache.wealth_levels
    : _levelConfigCache.charm_levels

  return findLevelFromXp(xpNum, levels)
}

/**
 * Preload level config into cache.
 * Call this early (e.g., in app.vue or a plugin) to enable sync access later.
 */
export async function preloadLevelConfig(): Promise<void> {
  await fetchLevelConfig()
}

/**
 * Clear the level config cache.
 * Useful for testing or when user logs out.
 */
export function clearLevelConfigCache(): void {
  _levelConfigCache = null
  _fetchPromise = null
}

/**
 * Check if level config is cached.
 */
export function isLevelConfigCached(): boolean {
  return _levelConfigCache !== null
}

// ========================================
// Default Badge Paths
// ========================================

export const DEFAULT_WEALTH_BADGE = '/badges/wealth/level_0.webp'
export const DEFAULT_CHARM_BADGE = '/badges/charm/level_0.webp'
