// ========================================
// Badges Store
// ========================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Badge,
  UserBadge,
  BadgeStats,
  BadgeCategory,
  BadgeCategoryInfo,
  GetBadgesParams,
  BadgePagination,
} from '~/types/badge'

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
      const queryParams: Record<string, unknown> = {
        per_page: params.per_page ?? 50,
      }

      if (params.category) {
        queryParams.category = params.category
      }
      if (catalog.value.cursor) {
        queryParams.cursor = catalog.value.cursor
      }

      const response = await api<{
        success: true
        data: {
          badges: Badge[]
          pagination: BadgePagination
        }
      }>('/badges', { params: queryParams })

      catalog.value.items.push(...response.data.badges)
      catalog.value.hasMore = response.data.pagination.has_more
      catalog.value.cursor = response.data.pagination.next_cursor ?? null
    } catch (err) {
      const normalized = normalizeError(err)
      catalog.value.error = normalized.message
      console.error('[BadgesStore] fetchCatalog failed:', err)
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
      console.error('[BadgesStore] fetchCategories failed:', err)
    }
  }

  /**
   * Fetch user's earned badges.
   */
  async function fetchUserBadges(params: GetBadgesParams = {}, reset = false): Promise<void> {
    if (reset) {
      userBadges.value.items = []
      userBadges.value.cursor = null
      userBadges.value.hasMore = true
    }

    if (!userBadges.value.hasMore || userBadges.value.loading) return

    userBadges.value.loading = true
    userBadges.value.error = null

    try {
      const queryParams: Record<string, unknown> = {
        per_page: params.per_page ?? 50,
      }

      if (userBadges.value.cursor) {
        queryParams.cursor = userBadges.value.cursor
      }

      const response = await api<{
        success: true
        data: {
          badges: UserBadge[]
          pagination: BadgePagination
        }
      }>('/user/badges', { params: queryParams })

      userBadges.value.items.push(...response.data.badges)
      userBadges.value.hasMore = response.data.pagination.has_more
      userBadges.value.cursor = response.data.pagination.next_cursor ?? null
    } catch (err) {
      const normalized = normalizeError(err)
      userBadges.value.error = normalized.message
      console.error('[BadgesStore] fetchUserBadges failed:', err)
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
      console.error('[BadgesStore] fetchStats failed:', err)
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
      console.error('[BadgesStore] toggleDisplay failed:', err)
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

    // Computed
    displayedBadges,
    hiddenBadges,

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
})
