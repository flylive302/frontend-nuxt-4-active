// ========================================
// Cache TTL Constants
// ========================================

/**
 * Cache time-to-live values in milliseconds.
 * Used for staleness checks on persisted data.
 */
export const CACHE_TTL = {
  /** Level configuration (wealth, charm, room levels) */
  LEVEL_CONFIG: 24 * 60 * 60 * 1000, // 24 hours

  /** Gift catalog */
  GIFT_CATALOG: 24 * 60 * 60 * 1000, // 24 hours

  /** Badge catalog */
  BADGE_CATALOG: 24 * 60 * 60 * 1000, // 24 hours

  /** Countries data (static, rarely changes) */
  COUNTRIES: 7 * 24 * 60 * 60 * 1000, // 7 days

  /** Gift animation assets */
  GIFT_ASSETS: 30 * 24 * 60 * 60 * 1000, // 30 days

  /**
   * Home rooms page-1 payload (home-room-feed/15). Under this age the mount-time
   * silent refresh is skipped — participant counts this fresh aren't worth a
   * second hit on the app's most-hit endpoint (60 req/min shared budget).
   */
  HOME_ROOMS_PAYLOAD: 15 * 1000, // 15 seconds
} as const

/**
 * Check if cached data is stale.
 * @param lastFetchedAt - Timestamp of last fetch
 * @param ttl - Time-to-live in milliseconds
 * @returns true if data is stale and should be refreshed
 */
export function isStale(lastFetchedAt: number | null, ttl: number): boolean {
  if (!lastFetchedAt) return true
  return Date.now() - lastFetchedAt > ttl
}
