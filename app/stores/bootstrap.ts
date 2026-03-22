// ========================================
// Bootstrap Store
// ========================================
// Stores = ref + computed + setters ONLY (no API, no toast, no cross-store calls)

import { defineStore } from 'pinia'
import type {
  BootstrapConfig,
  LevelBadge,
} from '~/types/user/bootstrap'
import type { Gift } from '~/types/gift/gift'

// ========================================
// Store Definition
// ========================================

export const useBootstrapStore = defineStore('bootstrap', () => {
  // ========================================
  // State
  // ========================================

  /** Bootstrap phase */
  const phase = ref<'idle' | 'loading' | 'complete' | 'error'>('idle')

  /** Error message if bootstrap failed */
  const error = ref<string | null>(null)

  /** Level and economy configuration */
  const config = ref<BootstrapConfig | null>(null)

  /** Gift catalog (accumulates as user scrolls) */
  const giftCatalog = ref<Gift[]>([])

  /** Total gift count from server */
  const giftTotal = ref<number>(0)

  /** Level badges for XP-to-badge lookup */
  const levelBadges = ref<LevelBadge[]>([])

  /** Last bootstrap timestamp */
  const lastBootstrapAt = ref<number | null>(null)

  // ========================================
  // Getters
  // ========================================

  const isReady = computed(() => phase.value === 'complete')
  const isLoading = computed(() => phase.value === 'loading')
  const hasError = computed(() => phase.value === 'error')

  /**
   * Check if config needs refresh based on TTL.
   */
  const needsRefresh = computed(() => {
    if (!lastBootstrapAt.value) return true
    const STALE_TIME = 5 * 60 * 1000 // 5 minutes
    return Date.now() - lastBootstrapAt.value > STALE_TIME
  })

  /**
   * Badge map for O(1) lookup by ID.
   */
  const badgeMap = computed(() => {
    const map = new Map<number, LevelBadge>()
    for (const badge of levelBadges.value) {
      map.set(badge.id, badge)
    }
    return map
  })

  /**
   * Pre-sorted wealth level configs (ascending by required_xp).
   */
  const sortedWealthLevels = computed(() =>
    config.value ? [...config.value.wealth_levels].sort((a, b) => a.required_xp - b.required_xp) : []
  )

  /**
   * Pre-sorted charm level configs (ascending by required_xp).
   */
  const sortedCharmLevels = computed(() =>
    config.value ? [...config.value.charm_levels].sort((a, b) => a.required_xp - b.required_xp) : []
  )

  /**
   * Persistent set of gift IDs for O(1) deduplication.
   */
  const giftIdSet = computed(() => new Set(giftCatalog.value.map(g => g.id)))

  // ========================================
  // Setters
  // ========================================

  /**
   * Set bootstrap phase.
   */
  function setPhase(newPhase: typeof phase.value): void {
    phase.value = newPhase
    if (newPhase === 'complete') {
      lastBootstrapAt.value = Date.now()
    }
  }

  /**
   * Set error message.
   */
  function setError(message: string | null): void {
    error.value = message
  }

  /**
   * Set config and level badges from bootstrap response.
   */
  function setConfig(newConfig: BootstrapConfig): void {
    config.value = newConfig
    levelBadges.value = newConfig.level_badges
  }

  /**
   * Set gift catalog and total from bootstrap response.
   */
  function setGifts(catalog: Gift[], total: number): void {
    giftCatalog.value = catalog
    giftTotal.value = total
  }

  /**
   * Append gifts to catalog (for pagination).
   */
  function appendGifts(gifts: Gift[]): void {
    const currentIds = giftIdSet.value
    const newGifts = gifts.filter(g => !currentIds.has(g.id))
    giftCatalog.value.push(...newGifts)
  }

  /**
   * Get badge by ID.
   */
  function getBadgeById(id: number): LevelBadge | null {
    return badgeMap.value.get(id) ?? null
  }

  /**
   * Invalidate config (force refresh on next boot).
   */
  function invalidateConfig(type: 'levels' | 'badges' | 'gifts' | 'all'): void {
    if (type === 'all' || type === 'levels') {
      lastBootstrapAt.value = null
    }
    if (type === 'all' || type === 'gifts') {
      giftCatalog.value = []
    }
  }

  /**
   * Reset store state.
   */
  function reset(): void {
    phase.value = 'idle'
    error.value = null
    config.value = null
    giftCatalog.value = []
    giftTotal.value = 0
    levelBadges.value = []
    lastBootstrapAt.value = null
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    phase,
    error,
    config,
    giftCatalog,
    giftTotal,
    levelBadges,
    lastBootstrapAt,

    // Getters
    isReady,
    isLoading,
    hasError,
    needsRefresh,
    badgeMap,
    sortedWealthLevels,
    sortedCharmLevels,

    // Setters
    setPhase,
    setError,
    setConfig,
    setGifts,
    appendGifts,
    getBadgeById,
    invalidateConfig,
    reset,
  }
}, {
  persist: {
    pick: ['config', 'levelBadges', 'lastBootstrapAt'],
  },
})
