// ========================================
// Level Actions Composable
// ========================================
// Role: Action/Orchestrator — cross-store XP recalculation.
// Reads bootstrap config + writes to levels store.
// Pipeline: GATE → EXECUTE (callers handle UI feedback as REACT)

import type { LevelStatus } from '~/types/progression/levels'
import type { UserLevelUpPayload } from '~/types/room/socket-events'

// ========================================
// Composable
// ========================================

/**
 * Orchestrates XP-based level recalculation.
 * Reads level config from bootstrap store, computes new level/badge/progress,
 * and writes results to levels store.
 *
 * Cross-store coordination belongs here per ARCHITECTURE.md:
 * "Stores never import or call methods on other stores —
 *  cross-store coordination belongs in composables."
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

    const badge = newBadgeId ? bootstrapStore.getBadgeById(newBadgeId) : null

    const currentLevelConfig = sortedConfig.find(l => l.level === newLevel)
    const nextLevelConfig = sortedConfig.find(l => l.level === newLevel + 1)

    const currentThreshold = currentLevelConfig?.required_xp ?? 0
    const nextThreshold = nextLevelConfig?.required_xp ?? currentThreshold

    const xpInLevel = currentXp - currentThreshold
    const xpNeeded = nextThreshold - currentThreshold
    const progress = xpNeeded > 0 ? Math.min(100, (xpInLevel / xpNeeded) * 100) : 100
    const remaining = Math.max(0, nextThreshold - currentXp)

    const nextLevel = nextLevelConfig ? {
      level: nextLevelConfig.level,
      name: nextLevelConfig.name,
      required_xp: nextLevelConfig.required_xp,
    } : null

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
   * Handle a realtime level.up socket event.
   * Routes the update by type (wealth/charm) and recalculates from XP.
   * Called exclusively from progression.events.ts (events layer).
   */
  function handleLevelUp(payload: UserLevelUpPayload): void {
    recalculateXp(payload.type, parseFloat(payload.current_xp))
  }

  return {
    updateWealthXp,
    updateCharmXp,
    handleLevelUp,
  }
}
