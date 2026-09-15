// ========================================
// Owner Income Store Tests
// ========================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import type { OwnerIncomeCycle, OwnerIncomeCycleSummary } from '../../app/types/income/ownerIncome'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

beforeEach(() => {
  setActivePinia(createPinia())
})

// ========================================
// Fixtures
// ========================================

function cycle(number: number, inProgress = false): OwnerIncomeCycle {
  return {
    number,
    start: '2026-08-11T00:00:00+00:00',
    end: '2026-08-21T00:00:00+00:00',
    in_progress: inProgress,
    label: `Run ${number} · Aug 11 – Aug 20`,
  }
}

function summary(number: number): OwnerIncomeCycleSummary {
  return {
    cycle: cycle(number),
    members: { earned: 1, exchanged: 0, deducted: 0, income: 1, members_count: 1, left_count: 0 },
  }
}

async function makeStore() {
  const { useOwnerIncomeStore } = await import('../../app/stores/ownerIncome')
  const store = useOwnerIncomeStore()
  store.setOverview({
    agency: { id: 1, name: 'Agency', logo_url: null },
    default_cycle: 4,
    cycles: [cycle(4, true), cycle(2)],
  })
  return store
}

// ========================================
// Tests
// ========================================

describe('useOwnerIncomeStore', () => {
  it('derives the selected cycle, its status and its cached summary', async () => {
    const store = await makeStore()

    store.setSelectedCycle(4)
    expect(store.selectedCycleInfo?.number).toBe(4)
    expect(store.isSelectedCycleInProgress).toBe(true)
    expect(store.selectedSummary).toBeNull()

    store.setSummary(summary(2))
    store.setSelectedCycle(2)
    expect(store.isSelectedCycleInProgress).toBe(false)
    expect(store.selectedSummary?.cycle.number).toBe(2)
  })

  it('tracks several cycles loading at once', async () => {
    const store = await makeStore()

    store.setCycleLoading(4, true)
    store.setCycleLoading(2, true)
    store.setSelectedCycle(4)
    store.setCycleLoading(2, false)

    expect(store.isCycleLoading(2)).toBe(false)
    expect(store.isSelectedCycleLoading).toBe(true)

    store.setCycleLoading(4, false)
    expect(store.isSelectedCycleLoading).toBe(false)
  })

  it('reports no cycles and no default before an overview, and after reset', async () => {
    const store = await makeStore()
    expect(store.hasCycles).toBe(true)
    expect(store.defaultCycle).toBe(4)

    store.setSummary(summary(4))
    store.setSelectedCycle(4)
    store.setOverviewError('boom')
    store.reset()

    expect(store.hasCycles).toBe(false)
    expect(store.defaultCycle).toBeNull()
    expect(store.selectedSummary).toBeNull()
    expect(store.summaries).toEqual({})
    expect(store.overviewError).toBeNull()
  })
})
