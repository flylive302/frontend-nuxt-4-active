// ========================================
// Milestone Drain Composable
// ========================================
// Role: Action/Orchestrator — GATE → EXECUTE → REACT.
//
// Page-gated agency-milestone celebration (level-up-celebrations epic,
// ticket 05). /agency/my-income owns the member-view milestone modal: on
// mount, `drain()` compares the active run's `current_tier` (already in the
// income store) against this device's per-run watermark (milestoneSeen[runId])
// and exposes the (capped) list of tiers crossed since the last visit.
//
// New-run semantics differ from the level-up drain: an agency run is a short
// ~10-day cycle, so a run with no stored mark simply starts at seen-tier 0 and
// takes the normal path — no "first-run summary" collapse. On advance, only
// the active run's mark is kept (older runs' keys are pruned).
//
// No socket, no API, no DB — purely derived from state already in memory.

import { MILESTONE_MODAL_CAP } from '~/constants/progression'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useMilestoneDrain]')

// ========================================
// Types
// ========================================

export interface MilestoneModalItem {
  /** 'summary' collapses several crossed tiers into one "reached tier N" modal. */
  kind: 'single' | 'summary'
  tier: number
  previousTier: number
  /** Member diamond reward: this tier's reward, or the sum for a summary. */
  memberReward: number
  /** Only set on the summary item: total number of tiers crossed this visit. */
  crossedCount?: number
}

// ========================================
// Composable
// ========================================

export function useMilestoneDrain() {
  const incomeStore = useIncomeStore()
  const watermarkStore = useLevelUpWatermarkStore()

  const queue = ref<MilestoneModalItem[]>([])
  const currentModal = ref<MilestoneModalItem | null>(null)

  /**
   * Drain any unseen milestone crossings for the active run and begin showing
   * them. Call once on the income page's mount.
   */
  function drain(): void {
    // GATE
    const gate = checkGate(incomeStore, watermarkStore)
    if (!gate) return

    // EXECUTE
    queue.value = buildModalQueue(gate.seenTier, gate.currentTier, gate.rewardForTier)

    // REACT — advance fully (even when display is capped) and prune old runs.
    watermarkStore.setMilestoneSeenExclusive(gate.runId, gate.currentTier)
    log.debug('drained', { runId: gate.runId, from: gate.seenTier, to: gate.currentTier, shown: queue.value.length })

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

interface MilestoneGate {
  runId: string
  seenTier: number
  currentTier: number
  rewardForTier: (tier: number) => number
}

/**
 * Pure precondition check: an active run must be loaded and its current tier
 * must be strictly ahead of the stored per-run watermark.
 */
function checkGate(
  incomeStore: ReturnType<typeof useIncomeStore>,
  watermarkStore: ReturnType<typeof useLevelUpWatermarkStore>,
): MilestoneGate | null {
  const run = incomeStore.activeRun
  if (!run) return null

  const runId = String(run.id)
  const currentTier = run.current_tier
  const seenTier = watermarkStore.milestoneSeen[runId] ?? 0

  if (currentTier <= seenTier) return null

  const rewardForTier = (tier: number): number =>
    run.ladder.find((rung) => rung.tier === tier)?.member_diamond_reward ?? 0

  return { runId, seenTier, currentTier, rewardForTier }
}

// ========================================
// EXECUTE
// ========================================

/**
 * Build the capped list of modals for the tiers crossed between `seenTier`
 * (exclusive) and `currentTier` (inclusive).
 * - crossedCount <= MILESTONE_MODAL_CAP: one 'single' modal per tier.
 * - crossedCount >  MILESTONE_MODAL_CAP: (CAP - 1) 'single' modals for the
 *   first tiers crossed, then one 'summary' modal naming currentTier whose
 *   reward is the sum of the collapsed tiers' member rewards.
 */
function buildModalQueue(
  seenTier: number,
  currentTier: number,
  rewardForTier: (tier: number) => number,
): MilestoneModalItem[] {
  const crossedCount = currentTier - seenTier

  if (crossedCount <= 0) return []

  if (crossedCount <= MILESTONE_MODAL_CAP) {
    const items: MilestoneModalItem[] = []
    for (let tier = seenTier + 1; tier <= currentTier; tier++) {
      items.push({ kind: 'single', tier, previousTier: tier - 1, memberReward: rewardForTier(tier) })
    }
    return items
  }

  const individualCount = MILESTONE_MODAL_CAP - 1
  const items: MilestoneModalItem[] = []
  for (let i = 1; i <= individualCount; i++) {
    const tier = seenTier + i
    items.push({ kind: 'single', tier, previousTier: tier - 1, memberReward: rewardForTier(tier) })
  }

  const summaryFrom = seenTier + individualCount
  let collapsedReward = 0
  for (let tier = summaryFrom + 1; tier <= currentTier; tier++) {
    collapsedReward += rewardForTier(tier)
  }

  items.push({
    kind: 'summary',
    tier: currentTier,
    previousTier: summaryFrom,
    memberReward: collapsedReward,
    crossedCount,
  })
  return items
}
