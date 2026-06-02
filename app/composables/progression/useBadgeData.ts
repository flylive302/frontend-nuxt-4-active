// ========================================
// Badge Data Composable (Data / Query Role)
// ========================================
// Handles all badge-related data fetching.
// Writes results to the badges store via setters.

import type {
  Badge,
  UserBadge,
  BadgeStats,
} from '~/types/progression/badge'
import { createLogger } from '~/utils/logger'

const log = createLogger('[BadgeData]')

/**
 * Composable for fetching badge data.
 *
 * Responsibilities (ARCHITECTURE.md - Data/Query role):
 * - Calls API endpoints
 * - Writes to store via setters
 * - Handles loading/error state
 */
export function useBadgeData() {
  const { api, normalizeError } = useApi()
  const store = useBadgesStore()

  // ========================================
  // Fetch Catalog
  // ========================================

  /**
   * Fetch the badge catalog (all active badges).
   *
   * GATE: skip if already loading or no more data
   * EXECUTE: call API, write to store
   * REACT: log errors (fire-and-forget)
   */
  async function fetchCatalog(reset = false): Promise<void> {
    if (reset) {
      store.resetCatalog()
    }

    // GATE
    if (!store.catalog.hasMore || store.catalog.loading) return

    // EXECUTE
    store.setCatalogLoading(true)
    store.setCatalogError(null)

    try {
      const response = await api<{ data: Badge[] }>('/badges')

      store.setCatalog(response.data)
      store.setLastFetchedAt(Date.now())
    } catch (err) {
      log.warn('Failed to fetch badge catalog', err)
      const normalized = normalizeError(err)
      store.setCatalogError(normalized.message)
    } finally {
      store.setCatalogLoading(false)
    }
  }

  // ========================================
  // Fetch User Badges
  // ========================================

  async function fetchUserBadges(reset = false): Promise<void> {
    if (reset) {
      store.resetUserBadges()
    }

    // GATE
    if (!store.userBadges.hasMore || store.userBadges.loading) return

    // EXECUTE
    store.setUserBadgesLoading(true)
    store.setUserBadgesError(null)

    try {
      const response = await api<{ data: UserBadge[] }>('/user/badges')

      store.setUserBadges(response.data)
    } catch (err) {
      log.warn('Failed to fetch user badges', err)
      const normalized = normalizeError(err)
      store.setUserBadgesError(normalized.message)
    } finally {
      store.setUserBadgesLoading(false)
    }
  }

  // ========================================
  // Fetch Stats
  // ========================================

  async function fetchStats(): Promise<void> {
    try {
      const response = await api<{
        success: true
        data: BadgeStats
      }>('/user/badges/stats')

      store.setStats(response.data)
    } catch (err) {
      log.warn('Failed to fetch badge stats', err)
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    fetchCatalog,
    fetchUserBadges,
    fetchStats,
  }
}
