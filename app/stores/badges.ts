// ========================================
// Badges Store
// ========================================

import { defineStore } from 'pinia'
import { createLogger } from '~/utils/logger'
import type {
  Badge,
  UserBadge,
  BadgeStats,
  BadgeCategory,
  BadgeCategoryInfo,
  GetBadgesParams,
} from '~/types/progression/badge'

// ========================================
// Types
// ========================================

interface BadgeListState {
  items: Badge[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}

interface UserBadgeListState {
  items: UserBadge[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}

// ========================================
// Store Definition
// ========================================

export const useBadgesStore = defineStore('badges', () => {
  const log = createLogger('[BadgesStore]')
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // State
  // ========================================

  const catalog = ref<BadgeListState>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  const userBadges = ref<UserBadgeListState>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  const categories = ref<BadgeCategoryInfo[]>([])
  const stats = ref<BadgeStats | null>(null)
  const currentCategory = ref<BadgeCategory | null>(null)
  const isTogglingDisplay = ref<number | null>(null)

  /** Timestamp of last successful data fetch */
  const lastFetchedAt = ref<number | null>(null)

  // ========================================
  // Constants
  // ========================================

  /** Data is considered stale after 5 minutes */
  const STALE_TIME = 5 * 60 * 1000

  // ========================================
  // Computed
  // ========================================

  /**
   * Displayed badges (is_displayed = true).
   */
  const displayedBadges = computed(() =>
    userBadges.value.items.filter(b => b.is_displayed)
  )

  /**
   * Whether cached data needs refreshing.
   */
  const needsRefresh = computed<boolean>(() => {
    if (!lastFetchedAt.value) return true
    return Date.now() - lastFetchedAt.value > STALE_TIME
  })

  /**
   * Hidden badges (is_displayed = false).
   */
  const hiddenBadges = computed(() =>
    userBadges.value.items.filter(b => !b.is_displayed)
  )

  /**
   * Check if user has a specific badge.
   */
  function hasUserBadge(badgeId: number): boolean {
    return userBadges.value.items.some(b => b.badge_id === badgeId)
  }

  /**
   * Get badges by category from catalog.
   */
  function badgesByCategory(category: BadgeCategory): Badge[] {
    return catalog.value.items.filter(b => b.category === category)
  }

  // ========================================
  // Actions
  // ========================================

  /**
   * Fetch badge catalog.
   */
  async function fetchCatalog(params: GetBadgesParams = {}, reset = false): Promise<void> {
    if (reset) {
      catalog.value.items = []
      catalog.value.cursor = null
      catalog.value.hasMore = true
    }

    if (!catalog.value.hasMore || catalog.value.loading) return

    catalog.value.loading = true
    catalog.value.error = null

    try {
      const queryParams: Record<string, unknown> = {}

      if (params.category) {
        queryParams.category = params.category
      }

      // Backend returns simple array format: { data: Badge[] }
      // No pagination - badge collections are small (10-50 items)
      const response = await api<{
        data: Badge[]
      }>('/badges', { params: queryParams })

      catalog.value.items = response.data
      catalog.value.hasMore = false
      lastFetchedAt.value = Date.now()
    } catch (err) {
      const normalized = normalizeError(err)
      catalog.value.error = normalized.message
      log.error('fetchCatalog failed:', err)
    } finally {
      catalog.value.loading = false
    }
  }

  /**
   * Fetch badge categories.
   */
  async function fetchCategories(): Promise<void> {
    try {
      const response = await api<{
        success: true
        data: BadgeCategoryInfo[]
      }>('/badges/categories')

      categories.value = response.data
    } catch (err) {
      log.error('fetchCategories failed:', err)
    }
  }

  /**
   * Fetch user's earned badges.
   */
  async function fetchUserBadges(_params: GetBadgesParams = {}, reset = false): Promise<void> {
    if (reset) {
      userBadges.value.items = []
      userBadges.value.cursor = null
      userBadges.value.hasMore = true
    }

    if (!userBadges.value.hasMore || userBadges.value.loading) return

    userBadges.value.loading = true
    userBadges.value.error = null

    try {
      // Backend returns simple array format: { data: UserBadge[] }
      // No pagination - user badge collections are small
      const response = await api<{
        data: UserBadge[]
      }>('/user/badges')

      userBadges.value.items = response.data
      userBadges.value.hasMore = false
    } catch (err) {
      const normalized = normalizeError(err)
      userBadges.value.error = normalized.message
      log.error('fetchUserBadges failed:', err)
    } finally {
      userBadges.value.loading = false
    }
  }

  /**
   * Fetch badge stats.
   */
  async function fetchStats(): Promise<void> {
    try {
      const response = await api<{
        success: true
        data: BadgeStats
      }>('/user/badges/stats')

      stats.value = response.data
    } catch (err) {
      log.error('fetchStats failed:', err)
    }
  }

  /**
   * Toggle badge display status.
   */
  async function toggleDisplay(userBadgeId: number): Promise<boolean> {
    if (isTogglingDisplay.value !== null) return false

    isTogglingDisplay.value = userBadgeId
    const badge = userBadges.value.items.find(b => b.id === userBadgeId)
    if (!badge) {
      isTogglingDisplay.value = null
      return false
    }

    // Optimistic update
    badge.is_displayed = !badge.is_displayed

    try {
      await api<{
        success: true
        data: { badge: UserBadge; displayed_count: number; max_display: number }
        message: string
      }>(`/user/badges/${userBadgeId}/toggle-display`, { method: 'POST' })

      toast.add({
        title: badge.is_displayed ? 'Badge Displayed' : 'Badge Hidden',
        color: 'success',
      })

      return true
    } catch (err) {
      // Rollback on error
      badge.is_displayed = !badge.is_displayed
      const normalized = normalizeError(err)
      toast.add({
        title: 'Update Failed',
        description: normalized.message,
        color: 'error',
      })
      log.error('toggleDisplay failed:', err)
      return false
    } finally {
      isTogglingDisplay.value = null
    }
  }

  /**
   * Handle badge earned event (real-time).
   */
  function onBadgeEarned(userBadge: UserBadge): void {
    // Add to user badges
    userBadges.value.items.unshift(userBadge)

    // Update stats
    if (stats.value) {
      stats.value.total_earned += 1
      stats.value.latest_earned = userBadge
    }

    // Show notification
    toast.add({
      title: 'New Badge Earned!',
      description: userBadge.badge.name,
      color: 'success',
      icon: 'i-lucide-award',
    })
  }

  /**
   * Set category filter and refetch catalog.
   */
  async function setCategory(category: BadgeCategory | null): Promise<void> {
    currentCategory.value = category
    await fetchCatalog({ category: category ?? undefined }, true)
  }

  /**
   * Reset all state.
   */
  function reset(): void {
    catalog.value = {
      items: [],
      loading: false,
      error: null,
      hasMore: true,
      cursor: null,
    }
    userBadges.value = {
      items: [],
      loading: false,
      error: null,
      hasMore: true,
      cursor: null,
    }
    categories.value = []
    stats.value = null
    currentCategory.value = null
    isTogglingDisplay.value = null
    lastFetchedAt.value = null
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    catalog,
    userBadges,
    categories,
    stats,
    currentCategory,
    isTogglingDisplay,
    lastFetchedAt,

    // Computed
    displayedBadges,
    hiddenBadges,
    needsRefresh,

    // Methods
    hasUserBadge,
    badgesByCategory,

    // Actions
    fetchCatalog,
    fetchCategories,
    fetchUserBadges,
    fetchStats,
    toggleDisplay,
    onBadgeEarned,
    setCategory,
    reset,
  }
}, {
  persist: {
    pick: ['userBadges'],
  }
})
