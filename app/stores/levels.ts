// ========================================
// Levels Store
// ========================================

import { defineStore } from 'pinia'
import type { LevelStatus } from '~/types/progression/levels'

// ========================================
// Store Definition
// ========================================

export const useLevelsStore = defineStore('levels', () => {
  // ========================================
  // State
  // ========================================

  const wealthLevel = ref<LevelStatus | null>(null)
  const charmLevel = ref<LevelStatus | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastFetchedAt = ref<number | null>(null)

  // ========================================
  // Constants
  // ========================================

  /** Stale time in milliseconds (5 minutes) */
  const STALE_TIME = 5 * 60 * 1000

  // ========================================
  // Computed
  // ========================================

  // Badge type from LevelStatus (simpler than LevelBadge from config)
  type StatusBadge = { id: number; name: string; image_url: string }

  /**
   * Current wealth badge (or null if level 0).
   */
  const wealthBadge = computed<StatusBadge | null>(() => 
    wealthLevel.value?.badge ?? null
  )

  /**
   * Current charm badge (or null if level 0).
   */
  const charmBadge = computed<StatusBadge | null>(() => 
    charmLevel.value?.badge ?? null
  )

  /**
   * Check if data needs refresh (empty or stale).
   */
  const needsRefresh = computed<boolean>(() => {
    if (!wealthLevel.value || !charmLevel.value) return true
    if (!lastFetchedAt.value) return true
    return Date.now() - lastFetchedAt.value > STALE_TIME
  })

  /**
   * Check if data is currently loading.
   */
  const isLoading = computed(() => loading.value)

  /**
   * Set levels from bootstrap data (no API call).
   * Used by bootstrap plugin to seed store.
   */
  function setLevels(wealth: LevelStatus, charm: LevelStatus): void {
    wealthLevel.value = wealth
    charmLevel.value = charm
    lastFetchedAt.value = Date.now()
  }

  /**
   * Set wealth level status directly.
   * Used by useLevelActions composable after XP recalculation.
   */
  function setWealthLevel(status: LevelStatus): void {
    wealthLevel.value = status
  }

  /**
   * Set charm level status directly.
   * Used by useLevelActions composable after XP recalculation.
   */
  function setCharmLevel(status: LevelStatus): void {
    charmLevel.value = status
  }

  /**
   * Reset store state (e.g., on logout).
   */
  function reset(): void {
    wealthLevel.value = null
    charmLevel.value = null
    loading.value = false
    error.value = null
    lastFetchedAt.value = null
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    wealthLevel,
    charmLevel,
    loading,
    error,
    lastFetchedAt,

    // Computed
    wealthBadge,
    charmBadge,
    needsRefresh,
    isLoading,

    // Setters
    setLevels,
    setWealthLevel,
    setCharmLevel,
    reset,
  }
}, {
  persist: {
    pick: ['wealthLevel', 'charmLevel', 'lastFetchedAt'],
  }
})
