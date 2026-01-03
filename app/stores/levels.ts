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

  /**
   * Current wealth badge (or null if level 0).
   */
  const wealthBadge = computed<LevelBadge | null>(() => 
    wealthLevel.value?.badge ?? null
  )

  /**
   * Current charm badge (or null if level 0).
   */
  const charmBadge = computed<LevelBadge | null>(() => 
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

  // ========================================
  // Actions
  // ========================================

  /**
   * Fetch user's wealth and charm level status.
   * Updates store with level data including current badges.
   */
  async function fetchLevels(): Promise<void> {
    if (loading.value) return

    loading.value = true
    error.value = null

    try {
      const response = await api<{
        status: string
        data: {
          wealth: LevelStatus
          charm: LevelStatus
        }
      }>('/profile/levels')

      wealthLevel.value = response.data.wealth
      charmLevel.value = response.data.charm
      lastFetchedAt.value = Date.now()
    } catch (err) {
      const normalized = normalizeError(err)
      error.value = normalized.message
      console.error('[LevelsStore] fetchLevels failed:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Force refresh levels data (ignores stale check).
   */
  async function refreshLevels(): Promise<void> {
    lastFetchedAt.value = null
    await fetchLevels()
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
    fetchLevels,
    refreshLevels,
    reset,
  }
}, {
  persist: {
    pick: ['wealthLevel', 'charmLevel', 'lastFetchedAt'],
  }
})
