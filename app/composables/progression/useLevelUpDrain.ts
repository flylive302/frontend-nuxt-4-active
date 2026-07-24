// ========================================
// Level Up Drain Composable
// ========================================
// Role: Action/Orchestrator — GATE → EXECUTE → REACT.
//
// Page-gated level-up celebration (level-up-celebrations epic, ticket 04).
// Replaces the old app-wide queue: /levels/wealth and /levels/charm each own
// their track. On mount, `drain(category)` compares the level derived from
// XP already in memory (via computeLevelStatus) against this device's
// per-category watermark (levelUpWatermarkStore) and exposes the (capped)
// list of modals to show for this visit as a small local queue.
//
// No socket, no API, no DB — purely derived from state already in memory.

import type { LevelConfig } from '~/types/user/bootstrap'
import { computeLevelStatus } from '~/utils/levels'
import { LEVEL_UP_MODAL_CAP } from '~/constants/progression'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useLevelUpDrain]')

// ========================================
// Types
// ========================================

export type LevelUpCategory = 'wealth' | 'charm'

export interface LevelUpModalItem {
  /** 'summary' collapses several crossed levels into one "reached level N" modal. */
  kind: 'single' | 'summary'
  category: LevelUpCategory
  level: number
  previousLevel: number
  levelName: string
  imageUrl: string | null
  /** Only set on the summary item: total number of levels crossed this visit. */
  crossedCount?: number
}

// ========================================
// Composable
// ========================================

/**
 * First-run watermark semantics: a stored watermark of `null` means this
 * device has never drained the track, which is deliberately distinct from 0.
 * On that first run we show ONE summary modal naming the level the user is
 * already at, then set the watermark — so an existing level-12 user does not
 * get a nonsensical "Level 1!" celebration on rollout day, and a brand-new
 * level-0 user sees nothing at all while still initialising the mark.
 * Every subsequent visit uses the normal (2 individual + summary) cap rule.
 */
export function useLevelUpDrain() {
  const authStore = useAuthStore()
  const bootstrapStore = useBootstrapStore()
  const watermarkStore = useLevelUpWatermarkStore()

  const queue = ref<LevelUpModalItem[]>([])
  const currentModal = ref<LevelUpModalItem | null>(null)

  /**
   * Drain any unseen level-ups for `category` and begin showing them.
   * Call once on the owning page's mount. Own-track only — a wealth-page
   * call reads/advances only the wealth watermark, never charm's.
   */
  function drain(category: LevelUpCategory): void {
    // GATE
    const gate = checkGate(category, authStore, bootstrapStore, watermarkStore)
    if (!gate) return

    // EXECUTE
    queue.value = buildModalQueue(category, gate.seenLevel, gate.currentLevel, gate.sortedConfigs, gate.isFirstRun)

    // REACT — always advance fully, even though display is capped.
    advanceWatermark(category, gate.currentLevel, watermarkStore)
    log.debug('drained', { category, from: gate.seenLevel, to: gate.currentLevel, shown: queue.value.length })

    showNext()
  }

  /** Advance the local display queue to the next modal (or close if empty). */
  function showNext(): void {
    currentModal.value = queue.value.shift() ?? null
  }

  /** Dismiss the modal currently on screen and show the next queued one, if any. */
  function closeModal(): void {
    currentModal.value = null
    showNext()
  }

  return {
    currentModal: readonly(currentModal),
    drain,
    closeModal,
  }
}

// ========================================
// GATE
// ========================================

interface DrainGate {
  seenLevel: number
  currentLevel: number
  sortedConfigs: LevelConfig[]
  isFirstRun: boolean
}

/**
 * Pure precondition check: level definitions must be loaded, and the derived
 * current level must be strictly ahead of the stored watermark.
 *
 * On a first run (stored watermark is null) we deliberately proceed even when
 * nothing was crossed, so the watermark initialises to the user's real level
 * and every later visit takes the normal path.
 */
function checkGate(
  category: LevelUpCategory,
  authStore: ReturnType<typeof useAuthStore>,
  bootstrapStore: ReturnType<typeof useBootstrapStore>,
  watermarkStore: ReturnType<typeof useLevelUpWatermarkStore>,
): DrainGate | null {
  const sortedConfigs = category === 'wealth' ? bootstrapStore.sortedWealthLevels : bootstrapStore.sortedCharmLevels
  if (!sortedConfigs || sortedConfigs.length === 0) return null

  const xp = category === 'wealth' ? authStore.user?.wealth_xp : authStore.user?.charm_xp
  const currentLevel = computeLevelStatus(xp, sortedConfigs).current_level

  const storedSeen = category === 'wealth' ? watermarkStore.wealthLevelSeen : watermarkStore.charmLevelSeen
  const isFirstRun = storedSeen === null || storedSeen === undefined
  const seenLevel = isFirstRun ? 0 : storedSeen

  if (!isFirstRun && currentLevel <= seenLevel) return null

  return { seenLevel, currentLevel, sortedConfigs, isFirstRun }
}

// ========================================
// EXECUTE
// ========================================

function findLevelConfig(level: number, configs: LevelConfig[]): LevelConfig | undefined {
  return configs.find((config) => config.level === level)
}

function toModalItem(
  kind: LevelUpModalItem['kind'],
  category: LevelUpCategory,
  level: number,
  previousLevel: number,
  configs: LevelConfig[],
  crossedCount?: number,
): LevelUpModalItem {
  const config = findLevelConfig(level, configs)
  return {
    kind,
    category,
    level,
    previousLevel,
    levelName: config?.name ?? `Level ${level}`,
    imageUrl: config?.image_url ?? null,
    ...(crossedCount !== undefined ? { crossedCount } : {}),
  }
}

/**
 * Build the capped list of modals for the levels crossed between
 * `seenLevel` (exclusive) and `currentLevel` (inclusive).
 * - first run: a single 'summary' modal naming the level they're already at,
 *   so an existing user is never shown a bogus "Level 1!" party on rollout.
 * - crossedCount <= LEVEL_UP_MODAL_CAP: one 'single' modal per level.
 * - crossedCount >  LEVEL_UP_MODAL_CAP: (CAP - 1) 'single' modals for the
 *   first levels crossed, then one 'summary' modal naming currentLevel.
 */
function buildModalQueue(
  category: LevelUpCategory,
  seenLevel: number,
  currentLevel: number,
  sortedConfigs: LevelConfig[],
  isFirstRun: boolean,
): LevelUpModalItem[] {
  const crossedCount = currentLevel - seenLevel

  if (crossedCount <= 0) return []

  if (isFirstRun) {
    return [toModalItem('summary', category, currentLevel, seenLevel, sortedConfigs, crossedCount)]
  }

  if (crossedCount <= LEVEL_UP_MODAL_CAP) {
    const items: LevelUpModalItem[] = []
    for (let level = seenLevel + 1; level <= currentLevel; level++) {
      items.push(toModalItem('single', category, level, level - 1, sortedConfigs))
    }
    return items
  }

  const individualCount = LEVEL_UP_MODAL_CAP - 1
  const items: LevelUpModalItem[] = []
  for (let i = 1; i <= individualCount; i++) {
    const level = seenLevel + i
    items.push(toModalItem('single', category, level, level - 1, sortedConfigs))
  }
  items.push(
    toModalItem('summary', category, currentLevel, seenLevel + individualCount, sortedConfigs, crossedCount),
  )
  return items
}

// ========================================
// REACT
// ========================================

/** Advance the device watermark to the fully-derived current level. */
function advanceWatermark(
  category: LevelUpCategory,
  currentLevel: number,
  watermarkStore: ReturnType<typeof useLevelUpWatermarkStore>,
): void {
  if (category === 'wealth') {
    watermarkStore.setWealthLevelSeen(currentLevel)
  } else {
    watermarkStore.setCharmLevelSeen(currentLevel)
  }
}
