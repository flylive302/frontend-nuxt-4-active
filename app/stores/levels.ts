// ========================================
// Levels Store
// ========================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LevelStatus, LevelBadge } from '~/types/levels'

// ========================================
// Store Definition
// ========================================

export const useLevelsStore = defineStore('levels', () => {
  const { api, normalizeError } = useApi()

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
   * Update only wealth level from realtime event.
   * @param newLevel - New level number
   * @param currentXp - Current XP as string
   */
  function updateWealthLevel(newLevel: number, currentXp: string): void {
    if (wealthLevel.value) {
      wealthLevel.value = {
        ...wealthLevel.value,
        current_level: newLevel,
        current_xp: parseFloat(currentXp),
      }
    }
  }

  /**
   * Update only charm level from realtime event.
   * @param newLevel - New level number
   * @param currentXp - Current XP as string
   */
  function updateCharmLevel(newLevel: number, currentXp: string): void {
    if (charmLevel.value) {
      charmLevel.value = {
        ...charmLevel.value,
        current_level: newLevel,
        current_xp: parseFloat(currentXp),
      }
    }
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

    // Actions
    setLevels,
    updateWealthLevel,
    updateCharmLevel,
    reset,
  }
}, {
  persist: {
    pick: ['wealthLevel', 'charmLevel', 'lastFetchedAt'],
  }
})
