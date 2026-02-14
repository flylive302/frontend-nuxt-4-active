// ========================================
// Levels Store
// ========================================

import { defineStore } from 'pinia'
import { ref, computed, type Ref } from 'vue'
import type { LevelStatus } from '~/types/levels'

// ========================================
// Store Definition
// ========================================

export const useLevelsStore = defineStore('levels', () => {
  // Note: api/normalizeError kept for future use (fetchLevels restoration if needed)
  const { api: _api, normalizeError: _normalizeError } = useApi()

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
   * Generic XP recalculation for a given level category.
   * Shared logic for both wealth and charm — eliminates DRY violation.
   */
  function updateXp(
    category: 'wealth' | 'charm',
    currentXp: number,
    targetRef: Ref<LevelStatus | null>
  ): void {
    if (!targetRef.value) return

    const bootstrapStore = useBootstrapStore()
    const configKey = category === 'wealth' ? 'wealth_levels' : 'charm_levels'
    const config = bootstrapStore.config?.[configKey] ?? []
    if (config.length === 0) return

    // Sort config by level to ensure correct iteration
    const sortedConfig = [...config].sort((a, b) => a.level - b.level)

    // Find the correct level based on current XP
    let newLevel = 0
    let newLevelName = sortedConfig[0]?.name ?? 'Level 0'
    let newBadgeId: number | null = null

    for (const level of sortedConfig) {
      if (currentXp >= level.required_xp) {
        newLevel = level.level
        newLevelName = level.name
        newBadgeId = level.badge_id
      } else {
        break
      }
    }

    // Get badge from bootstrapStore if badge_id exists
    const badge = newBadgeId ? bootstrapStore.getBadgeById(newBadgeId) : null

    // Find thresholds for progress calculation
    const currentLevelConfig = sortedConfig.find(l => l.level === newLevel)
    const nextLevelConfig = sortedConfig.find(l => l.level === newLevel + 1)

    const currentThreshold = currentLevelConfig?.required_xp ?? 0
    const nextThreshold = nextLevelConfig?.required_xp ?? currentThreshold

    // Calculate progress within current level
    const xpInLevel = currentXp - currentThreshold
    const xpNeeded = nextThreshold - currentThreshold
    const progress = xpNeeded > 0 ? Math.min(100, (xpInLevel / xpNeeded) * 100) : 100
    const remaining = Math.max(0, nextThreshold - currentXp)

    // Build next_level info
    const nextLevel = nextLevelConfig ? {
      level: nextLevelConfig.level,
      name: nextLevelConfig.name,
      required_xp: nextLevelConfig.required_xp,
    } : null

    targetRef.value = {
      ...targetRef.value,
      current_level: newLevel,
      level_name: newLevelName,
      current_xp: currentXp,
      progress_percentage: progress,
      xp_remaining: remaining,
      xp_for_next_level: nextThreshold,
      badge: badge ? { id: badge.id, name: badge.name, image_url: badge.image_url ?? '' } : null,
      next_level: nextLevel,
    }
  }

  /**
   * Update wealth XP and recalculate progress.
   * Called from balance.updated event.
   */
  function updateWealthXp(currentXp: number): void {
    updateXp('wealth', currentXp, wealthLevel)
  }

  /**
   * Update charm XP and recalculate progress.
   * Called from balance.updated event.
   */
  function updateCharmXp(currentXp: number): void {
    updateXp('charm', currentXp, charmLevel)
  }

  /**
   * Update only wealth level from realtime event (level.up).
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
      // Recalculate progress
      updateWealthXp(parseFloat(currentXp))
    }
  }

  /**
   * Update only charm level from realtime event (level.up).
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
      // Recalculate progress
      updateCharmXp(parseFloat(currentXp))
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
    updateWealthXp,
    updateCharmXp,
    reset,
  }
}, {
  persist: {
    pick: ['wealthLevel', 'charmLevel', 'lastFetchedAt'],
  }
})
