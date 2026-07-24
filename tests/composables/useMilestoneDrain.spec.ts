// ========================================
// useMilestoneDrain Composable Tests
// ========================================
// level-up-celebrations epic, ticket 05: page-gated agency-milestone modal.
// Verifies GATE (no-op below the per-run watermark) → EXECUTE (capped modal
// build with member rewards from the ladder) → REACT (watermark advances and
// old runs are pruned). A brand-new run id starts clean at seen-tier 0.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
  createMockIncomeStore,
  createMockLevelUpWatermarkStore,
} from '../helpers/nuxtMocks'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

let useMilestoneDrain: () => ReturnType<typeof import('~/composables/progression/useMilestoneDrain')['useMilestoneDrain']>

/** A run whose ladder tier T grants T * 10 member diamonds. */
function buildRun(id: number, currentTier: number, tierCount = 12) {
  return {
    id,
    current_tier: currentTier,
    ladder: Array.from({ length: tierCount }, (_, i) => ({
      tier: i + 1,
      required_xp: (i + 1) * 100,
      member_diamond_reward: (i + 1) * 10,
      owner_diamond_reward: (i + 1) * 5,
      crossed: i + 1 <= currentTier,
      is_active: i + 1 === currentTier + 1,
    })),
  }
}

describe('useMilestoneDrain', () => {
  let incomeStore: ReturnType<typeof createMockIncomeStore>
  let watermarkStore: ReturnType<typeof createMockLevelUpWatermarkStore>

  beforeEach(async () => {
    incomeStore = createMockIncomeStore()
    watermarkStore = createMockLevelUpWatermarkStore()
    setupNuxtMocks({ incomeStore, levelUpWatermarkStore: watermarkStore })

    const mod = await import('~/composables/progression/useMilestoneDrain')
    useMilestoneDrain = mod.useMilestoneDrain
  })

  afterEach(() => {
    cleanupNuxtMocks()
    vi.restoreAllMocks()
  })

  it('shows nothing when there is no active run', () => {
    incomeStore.activeRun = null

    const { drain, currentModal } = useMilestoneDrain()
    drain()

    expect(currentModal.value).toBeNull()
    expect(watermarkStore.setMilestoneSeenExclusive).not.toHaveBeenCalled()
  })

  it('shows nothing when the current tier is at or below the watermark', () => {
    incomeStore.activeRun = buildRun(42, 3)
    watermarkStore.milestoneSeen = { '42': 3 }

    const { drain, currentModal } = useMilestoneDrain()
    drain()

    expect(currentModal.value).toBeNull()
    expect(watermarkStore.setMilestoneSeenExclusive).not.toHaveBeenCalled()
  })

  it('yields one modal per crossed tier with its ladder reward when within the cap', () => {
    incomeStore.activeRun = buildRun(42, 2)
    watermarkStore.milestoneSeen = { '42': 0 }

    const { drain, currentModal, closeModal } = useMilestoneDrain()
    drain()

    expect(currentModal.value).toEqual(
      expect.objectContaining({ kind: 'single', tier: 1, previousTier: 0, memberReward: 10 }),
    )
    closeModal()
    expect(currentModal.value).toEqual(
      expect.objectContaining({ kind: 'single', tier: 2, previousTier: 1, memberReward: 20 }),
    )
    closeModal()
    expect(currentModal.value).toBeNull()
    expect(watermarkStore.setMilestoneSeenExclusive).toHaveBeenCalledWith('42', 2)
  })

  it('caps at 2 individual + 1 summary, summing the collapsed tiers reward', () => {
    // 0 -> 5 crosses tiers 1..5. Cap shows tiers 1, 2 individually, then a
    // summary for 3+4+5 with reward 30+40+50 = 120.
    incomeStore.activeRun = buildRun(7, 5)
    watermarkStore.milestoneSeen = { '7': 0 }

    const { drain, currentModal, closeModal } = useMilestoneDrain()
    drain()

    expect(currentModal.value).toEqual(expect.objectContaining({ kind: 'single', tier: 1 }))
    closeModal()
    expect(currentModal.value).toEqual(expect.objectContaining({ kind: 'single', tier: 2 }))
    closeModal()
    expect(currentModal.value).toEqual(
      expect.objectContaining({ kind: 'summary', tier: 5, previousTier: 2, crossedCount: 5, memberReward: 120 }),
    )
    closeModal()
    expect(currentModal.value).toBeNull()
    expect(watermarkStore.setMilestoneSeenExclusive).toHaveBeenCalledWith('7', 5)
  })

  it('treats a brand-new run id as seen-tier 0 and drains from the start', () => {
    // No stored entry for run 99 — normal path, no first-run summary collapse.
    incomeStore.activeRun = buildRun(99, 2)
    watermarkStore.milestoneSeen = { '11': 4 } // a different, older run

    const { drain, currentModal } = useMilestoneDrain()
    drain()

    expect(currentModal.value).toEqual(expect.objectContaining({ kind: 'single', tier: 1 }))
    // Prunes the old run's key in the same advance.
    expect(watermarkStore.setMilestoneSeenExclusive).toHaveBeenCalledWith('99', 2)
  })

  it('advances the watermark fully even when the display was capped', () => {
    incomeStore.activeRun = buildRun(5, 9)
    watermarkStore.milestoneSeen = { '5': 4 }

    const { drain } = useMilestoneDrain()
    drain()

    expect(watermarkStore.setMilestoneSeenExclusive).toHaveBeenCalledWith('5', 9)
  })
})
