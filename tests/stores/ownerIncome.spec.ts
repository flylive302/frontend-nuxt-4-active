// ========================================
// Owner Income Store Tests
// ========================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import type {
  OwnerIncomeCycle,
  OwnerIncomeCycleSummary,
  OwnerIncomeMemberRow,
} from '../../app/types/income/ownerIncome'

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

describe('useOwnerIncomeStore members lists', () => {
  function row(userId: number): OwnerIncomeMemberRow {
    return {
      user_id: userId,
      name: `Member ${userId}`,
      avatar_url: null,
      signature: null,
      left: false,
      run_id: null,
      current_tier: 0,
      accumulated_xp: 0,
      earned: 0,
      exchanged: 0,
      deducted: 0,
      income: 0,
    }
  }

  const QUERY = { sort: 'income', direction: 'desc', search: '' } as const

  it('keeps one list per cycle and exposes the selected one', async () => {
    const store = await makeStore()

    store.setMemberListQuery(4, QUERY)
    store.setMemberListQuery(2, { ...QUERY, sort: 'name' })
    store.setSelectedCycle(2)

    expect(store.selectedMemberList?.sort).toBe('name')
    expect(store.memberList(4)?.sort).toBe('income')
    expect(store.memberList(9)).toBeNull()
  })

  it('page 1 replaces rows, later pages append without repeating a member', async () => {
    const store = await makeStore()
    store.setMemberListQuery(4, QUERY)

    store.setMemberListPage(4, 1, [row(1), row(2)], true)
    store.setMemberListPage(4, 2, [row(2), row(3)], false)
    expect(store.memberList(4)?.rows.map((r) => r.user_id)).toEqual([1, 2, 3])
    expect(store.memberList(4)?.page).toBe(2)
    expect(store.memberList(4)?.hasMore).toBe(false)

    store.setMemberListPage(4, 1, [row(7)], false)
    expect(store.memberList(4)?.rows.map((r) => r.user_id)).toEqual([7])
  })

  it('a new query restarts the list at nothing loaded', async () => {
    const store = await makeStore()
    store.setMemberListQuery(4, QUERY)
    store.setMemberListRequest(4, 5, 2)
    store.setMemberListPage(4, 2, [row(1)], true)
    store.setMemberListError(4, 'boom')

    store.setMemberListQuery(4, { ...QUERY, search: 'ali' })

    expect(store.memberList(4)).toEqual({
      ...QUERY,
      search: 'ali',
      rows: [],
      page: 0,
      hasMore: false,
      loadingPage: null,
      error: null,
      requestId: 0,
    })
  })

  it('tracks the request in flight and clears it on page or error', async () => {
    const store = await makeStore()
    store.setMemberListQuery(4, QUERY)

    store.setMemberListRequest(4, 3, 1)
    expect(store.memberList(4)?.loadingPage).toBe(1)
    expect(store.memberList(4)?.requestId).toBe(3)

    store.setMemberListError(4, 'boom')
    expect(store.memberList(4)?.loadingPage).toBeNull()
    expect(store.memberList(4)?.error).toBe('boom')

    store.setMemberListRequest(4, 4, 1)
    expect(store.memberList(4)?.error).toBeNull()
    store.setMemberListPage(4, 1, [row(1)], false)
    expect(store.memberList(4)?.loadingPage).toBeNull()
  })

  it('setters on a cycle with no list do nothing, and reset clears every list', async () => {
    const store = await makeStore()

    store.setMemberListRequest(9, 1, 1)
    store.setMemberListPage(9, 1, [row(1)], false)
    store.setMemberListError(9, 'boom')
    expect(store.memberList(9)).toBeNull()

    store.setMemberListQuery(4, QUERY)
    store.setSelectedCycle(4)
    store.reset()

    expect(store.memberLists).toEqual({})
    expect(store.selectedMemberList).toBeNull()
  })
})
