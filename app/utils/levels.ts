// ========================================
// Level Utility Functions
// ========================================
// Pure helper functions for XP-to-level calculations.
// No Vue reactivity, no store imports (per Architecture.md: utils/).

import type { LevelConfig } from '~/types/user/bootstrap'

// ========================================
// Types
// ========================================

export interface LevelComputedStatus {
  current_level: number
  level_name: string
  current_xp: number
  xp_for_next_level: number
  xp_remaining: number
  progress_percentage: number
  image_url: string | null
  next_level: {
    level: number
    name: string
    required_xp: number
  } | null
}

// ========================================
// Functions
// ========================================

/**
 * Compute level status from XP and sorted level configs.
 * Expects `sortedConfigs` sorted ascending by `level`.
 * Returns computed level, progress, and next-level info.
 */
export function computeLevelStatus(
  xp: string | number | null | undefined,
  sortedConfigs: LevelConfig[],
): LevelComputedStatus {
  const xpNum = typeof xp === 'string' ? parseFloat(xp) : (xp ?? 0)

  if (sortedConfigs.length === 0) {
    return {
      current_level: 0,
      level_name: 'Unknown',
      current_xp: xpNum,
      xp_for_next_level: 0,
      xp_remaining: 0,
      progress_percentage: 0,
      image_url: null,
      next_level: null,
    }
  }

  // Reverse scan — find highest level where user qualifies
  let matchedIndex = -1
  for (let i = sortedConfigs.length - 1; i >= 0; i--) {
    if (xpNum >= sortedConfigs[i]!.required_xp) {
      matchedIndex = i
      break
    }
  }

  // User hasn't reached first level
  if (matchedIndex === -1) {
    const first = sortedConfigs[0]!
    return {
      current_level: 0,
      level_name: 'Beginner',
      current_xp: xpNum,
      xp_for_next_level: first.required_xp,
      xp_remaining: Math.max(0, first.required_xp - xpNum),
      progress_percentage: first.required_xp > 0
        ? Math.min(100, (xpNum / first.required_xp) * 100)
        : 0,
      image_url: null,
      next_level: { level: first.level, name: first.name, required_xp: first.required_xp },
    }
  }

  const current = sortedConfigs[matchedIndex]!
  const next = sortedConfigs[matchedIndex + 1] ?? null

  const currentThreshold = current.required_xp
  const nextThreshold = next?.required_xp ?? currentThreshold

  const xpInLevel = xpNum - currentThreshold
  const xpNeeded = nextThreshold - currentThreshold
  const progress = xpNeeded > 0 ? Math.min(100, (xpInLevel / xpNeeded) * 100) : 100
  const remaining = next ? Math.max(0, nextThreshold - xpNum) : 0

  return {
    current_level: current.level,
    level_name: current.name,
    current_xp: xpNum,
    xp_for_next_level: nextThreshold,
    xp_remaining: remaining,
    progress_percentage: progress,
    image_url: current.image_url,
    next_level: next
      ? { level: next.level, name: next.name, required_xp: next.required_xp }
      : null,
  }
}
