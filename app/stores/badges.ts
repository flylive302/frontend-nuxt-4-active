// ========================================
// Badges Store
// ========================================
// State-only store: refs + computed + setters.
// API calls, toasts, and business logic live in composables.

import { defineStore } from 'pinia'
import type {
  Badge,
  UserBadge,
  BadgeStats,
  EquippedBadge,
} from '~/types/progression/badge'

// ========================================
// Types
// ========================================

interface BadgeListState {
  items: Badge[]
  loading: boolean
  error: string | null
  hasMore: boolean
}

interface UserBadgeListState {
  items: UserBadge[]
  loading: boolean
  error: string | null
  hasMore: boolean
}

// ========================================
// Store Definition
// ========================================

export const useBadgesStore = defineStore('badges', () => {
  // ========================================
  // State
  // ========================================

  const catalog = ref<BadgeListState>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
  })

  const userBadges = ref<UserBadgeListState>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
  })

  const equippedBadges = ref<EquippedBadge[]>([])
  const badgeSlotLimit = ref<number>(6)
  const stats = ref<BadgeStats | null>(null)

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

  const needsRefresh = computed<boolean>(() => {
    if (!lastFetchedAt.value) return true
    return Date.now() - lastFetchedAt.value > STALE_TIME
  })

  /** User badges with status === 'active' (excludes fully-expired badges). */
  const validUserBadges = computed<UserBadge[]>(() =>
    userBadges.value.items.filter(b => b.status === 'active'),
  )

  /** Sum of active_count across all valid (status === 'active') user badges. */
  const totalActiveBadgeCount = computed<number>(() =>
    validUserBadges.value.reduce((sum, b) => sum + b.active_count, 0),
  )

  // ========================================
  // Pure Lookups
  // ========================================

  function hasUserBadge(badgeId: number): boolean {
    return userBadges.value.items.some(b => b.badge.id === badgeId)
  }

  /** Owned AND currently active (not expired). Used by equip GATE. */
  function isUserBadgeValid(badgeId: number): boolean {
    return userBadges.value.items.some(b => b.badge.id === badgeId && b.status === 'active')
  }

  function getActiveCount(badgeId: number): number {
    return userBadges.value.items.find(b => b.badge.id === badgeId)?.active_count ?? 0
  }

  // ========================================
  // Catalog Setters
  // ========================================

  function setCatalog(items: Badge[]): void {
    catalog.value.items = items
    catalog.value.hasMore = false
  }

  function setCatalogLoading(loading: boolean): void {
    catalog.value.loading = loading
  }

  function setCatalogError(error: string | null): void {
    catalog.value.error = error
  }

  function resetCatalog(): void {
    catalog.value.items = []
    catalog.value.hasMore = true
    catalog.value.error = null
  }

  // ========================================
  // User Badges Setters
  // ========================================

  function setUserBadges(items: UserBadge[]): void {
    userBadges.value.items = items
    userBadges.value.hasMore = false
  }

  function setUserBadgesLoading(loading: boolean): void {
    userBadges.value.loading = loading
  }

  function setUserBadgesError(error: string | null): void {
    userBadges.value.error = error
  }

  function resetUserBadges(): void {
    userBadges.value.items = []
    userBadges.value.hasMore = true
    userBadges.value.error = null
  }

  function addUserBadge(userBadge: UserBadge): void {
    userBadges.value.items.unshift(userBadge)
  }

  // ========================================
  // Other Setters
  // ========================================

  function setEquippedBadges(items: EquippedBadge[]): void {
    equippedBadges.value = items
  }

  function setBadgeSlotLimit(limit: number): void {
    badgeSlotLimit.value = limit
  }

  function setStats(data: BadgeStats): void {
    stats.value = data
  }

  function incrementStatsTotal(): void {
    if (stats.value) {
      stats.value.total += 1
    }
  }

  function setLastFetchedAt(timestamp: number): void {
    lastFetchedAt.value = timestamp
  }

  // ========================================
  // Reset
  // ========================================

  function reset(): void {
    catalog.value = {
      items: [],
      loading: false,
      error: null,
      hasMore: true,
    }
    userBadges.value = {
      items: [],
      loading: false,
      error: null,
      hasMore: true,
    }
    equippedBadges.value = []
    badgeSlotLimit.value = 6
    stats.value = null
    lastFetchedAt.value = null
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State (read-only for components)
    catalog,
    userBadges,
    equippedBadges,
    badgeSlotLimit,
    stats,
    lastFetchedAt,

    // Computed
    needsRefresh,
    validUserBadges,
    totalActiveBadgeCount,

    // Pure lookups
    hasUserBadge,
    isUserBadgeValid,
    getActiveCount,

    // Catalog setters
    setCatalog,
    setCatalogLoading,
    setCatalogError,
    resetCatalog,

    // User badges setters
    setUserBadges,
    setUserBadgesLoading,
    setUserBadgesError,
    resetUserBadges,
    addUserBadge,

    // Other setters
    setEquippedBadges,
    setBadgeSlotLimit,
    setStats,
    incrementStatsTotal,
    setLastFetchedAt,

    // Reset
    reset,
  }
}, {
  persist: {
    pick: ['userBadges'],
  }
})
