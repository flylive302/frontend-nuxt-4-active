// ========================================
// Level Actions Composable
// ========================================
// Role: Action/Orchestrator — cross-store XP recalculation.
// Reads bootstrap config + writes to levels store.
// Pipeline: GATE → EXECUTE (no REACT — callers handle UI feedback)

import type { LevelStatus } from '~/types/progression/levels'

// ========================================
// Composable
// ========================================

/**
 * Orchestrates XP-based level recalculation.
 * Reads level config from bootstrap store, computes new level/badge/progress,
 * and writes results to levels store.
 *
 * This is the correct place for cross-store coordination
 * (ARCHITECTURE.md: "Stores never import or call methods on other stores —
 *  cross-store coordination belongs in composables").
 */
export function useLevelActions() {
  const bootstrapStore = useBootstrapStore()
  const levelsStore = useLevelsStore()

  // ========================================
  // Core Logic (EXECUTE)
  // ========================================

  /**
   * Generic XP recalculation for a given level category.
   * Reads config from bootstrap store, computes new level status,
   * and writes to levels store via setter.
   */
  function recalculateXp(
    category: 'wealth' | 'charm',
    currentXp: number,
  ): void {
    const targetRef = category === 'wealth' ? levelsStore.wealthLevel : levelsStore.charmLevel
    if (!targetRef) return

    // GATE — require config
    const configKey = category === 'wealth' ? 'wealth_levels' : 'charm_levels'
    const config = bootstrapStore.config?.[configKey] ?? []
    if (config.length === 0) return

    // EXECUTE — compute new level status
    const sortedConfig = [...config].sort((a, b) => a.level - b.level)

    // Find highest matching level via reverse scan
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

    // Get badge from bootstrap store
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

    // Build full LevelStatus and write to store
    const newStatus: LevelStatus = {
      ...targetRef,
      current_level: newLevel,
      level_name: newLevelName,
      current_xp: currentXp,
      progress_percentage: progress,
      xp_remaining: remaining,
      xp_for_next_level: nextThreshold,
      badge: badge ? { id: badge.id, name: badge.name, image_url: badge.image_url ?? '' } : null,
      next_level: nextLevel,
    }

    if (category === 'wealth') {
      levelsStore.setWealthLevel(newStatus)
    } else {
      levelsStore.setCharmLevel(newStatus)
    }
  }

  // ========================================
  // Public API
  // ========================================

  /**
   * Update wealth XP and recalculate progress.
   * Called from balance.updated event and wealth level page.
   */
  function updateWealthXp(currentXp: number): void {
    recalculateXp('wealth', currentXp)
  }

  /**
   * Update charm XP and recalculate progress.
   * Called from balance.updated event and charm level page.
   */
  function updateCharmXp(currentXp: number): void {
    recalculateXp('charm', currentXp)
  }

  /**
   * Update wealth level from realtime level.up event.
   */
  function updateWealthLevel(_newLevel: number, currentXp: string): void {
    if (levelsStore.wealthLevel) {
      // First set the raw level, then recalculate with config
      updateWealthXp(parseFloat(currentXp))
    }
  }

  /**
   * Update charm level from realtime level.up event.
   */
  function updateCharmLevel(_newLevel: number, currentXp: string): void {
    if (levelsStore.charmLevel) {
      // First set the raw level, then recalculate with config
      updateCharmXp(parseFloat(currentXp))
    }
  }

  return {
    updateWealthXp,
    updateCharmXp,
    updateWealthLevel,
    updateCharmLevel,
  }
}
