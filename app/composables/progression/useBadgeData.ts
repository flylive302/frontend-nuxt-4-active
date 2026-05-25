// ========================================
// Badge Data Composable (Data / Query Role)
// ========================================
// Handles all badge-related data fetching.
// Writes results to the badges store via setters.

import type {
  Badge,
  UserBadge,
  BadgeCategoryInfo,
  BadgeStats,
  BadgeCategory,
  GetBadgesParams,
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
  async function fetchCatalog(params: GetBadgesParams = {}, reset = false): Promise<void> {
    if (reset) {
      store.resetCatalog()
    }

    // GATE
    if (!store.catalog.hasMore || store.catalog.loading) return

    // EXECUTE
    store.setCatalogLoading(true)
    store.setCatalogError(null)

    try {
      const queryParams: Record<string, unknown> = {}
      if (params.category) {
        queryParams.category = params.category
      }

      const response = await api<{ data: Badge[] }>('/badges', { params: queryParams })

      store.setCatalog(response.data)
      store.setLastFetchedAt(Date.now())
    } catch (err) {
      // REACT — error is non-critical, log and continue
      const normalized = normalizeError(err)
      store.setCatalogError(normalized.message)
    } finally {
      store.setCatalogLoading(false)
    }
  }

  // ========================================
  // Fetch Categories
  // ========================================

  async function fetchCategories(): Promise<void> {
    try {
      const response = await api<{
        success: true
        data: BadgeCategoryInfo[]
      }>('/badges/categories')

      store.setCategories(response.data)
    } catch (err) {
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
    }
  }

  // ========================================
  // Set Category Filter
  // ========================================

  /**
   * Set category filter and re-fetch catalog.
   */
  async function setCategory(category: BadgeCategory | null): Promise<void> {
    store.setCurrentCategory(category)
    await fetchCatalog({ category: category ?? undefined }, true)
  }

  // ========================================
  // Return
  // ========================================

  return {
    fetchCatalog,
    fetchCategories,
    fetchUserBadges,
    fetchStats,
    setCategory,
  }
}
