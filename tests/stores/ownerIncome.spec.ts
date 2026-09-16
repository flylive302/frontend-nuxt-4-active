// ========================================
// Owner Income Store Tests
// ========================================
// Window-centric: everything keyed by a window key string (`run:N` /
// `range:FROM|TO`) instead of a cycle number. Coverage carried over from the
// cycle-based version, plus new coverage for run/range coexisting under
// different keys, `selectedCycle` collapsing to null for a range, and the
// range-aware label/in-progress/sheet-key computeds.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import type {
  OwnerIncomeCycle,
  OwnerIncomeMemberRow,
  OwnerIncomeMemberSheet,
  OwnerIncomeWindow,
  OwnerIncomeWindowSelection,
  OwnerIncomeWindowSummary,
} from '../../app/types/income/ownerIncome'
import { ownerIncomeWindowKey } from '../../app/utils/ownerIncomeWindow'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

beforeEach(() => {
  setActivePinia(createPinia())
})

// ========================================
// Fixtures
// ========================================

const RUN_SEL = (number: number): OwnerIncomeWindowSelection => ({ kind: 'run', number })
const RANGE_SEL = (from: string, to: string): OwnerIncomeWindowSelection => ({ kind: 'range', from, to })

const RUN_4 = ownerIncomeWindowKey(RUN_SEL(4))
const RUN_2 = ownerIncomeWindowKey(RUN_SEL(2))
const RANGE_A = ownerIncomeWindowKey(RANGE_SEL('2026-09-01', '2026-09-15'))

function cycle(number: number, inProgress = false): OwnerIncomeCycle {
  return {
    number,
    start: '2026-08-11T00:00:00+00:00',
    end: '2026-08-21T00:00:00+00:00',
    in_progress: inProgress,
    label: `Run ${number} · Aug 11 – Aug 20`,
  }
}

function runWindow(number: number, inProgress = false): OwnerIncomeWindow {
  return {
    kind: 'run',
    from: '2026-08-11T00:00:00+00:00',
    to: '2026-08-21T00:00:00+00:00',
    label: `Run ${number} · Aug 11 – Aug 20`,
    number,
    in_progress: inProgress,
  }
}

function rangeWindow(from: string, to: string, inProgress = false): OwnerIncomeWindow {
  return {
    kind: 'range',
    from: `${from}T00:00:00+00:00`,
    to: `${to}T00:00:00+00:00`,
    label: '1 Sep – 15 Sep',
    number: null,
    in_progress: inProgress,
  }
}

function windowSummary(window: OwnerIncomeWindow, income = 1): OwnerIncomeWindowSummary {
  return {
    window,
    members: { earned: income, exchanged: 0, deducted: 0, income, members_count: 1, left_count: 0, gift_coins: 0 },
  }
}

async function makeStore() {
  const { useOwnerIncomeStore } = await import('../../app/stores/ownerIncome')
  const store = useOwnerIncomeStore()
  store.setOverview({
    agency: { id: 1, name: 'Agency', logo_url: null },
    default_cycle: 4,
    cycles: [cycle(4, true), cycle(2)],
    ranges_enabled: true,
    range_limits: { min_day: '2026-01-01', max_day: '2026-09-16', max_span_days: 31 },
  })
  return store
}

// ========================================
// Tests
// ========================================

describe('useOwnerIncomeStore', () => {
  it('derives the selected cycle, its status and its cached summary', async () => {
    const store = await makeStore()

    // Run 4 is the overview's in-progress cycle — before the summary lands,
    // isSelectedWindowInProgress falls back to the overview's own cycle entry.
    store.setSelectedWindow(RUN_SEL(4))
    expect(store.selectedCycle).toBe(4)
    expect(store.isSelectedWindowInProgress).toBe(true)
    expect(store.selectedSummary).toBeNull()

    store.setSummary(RUN_2, windowSummary(runWindow(2, false)))
    store.setSelectedWindow(RUN_SEL(2))
    expect(store.isSelectedWindowInProgress).toBe(false)
    expect(store.selectedSummary?.window.number).toBe(2)
  })

  it('selectedCycle is the run number for a run and null for a range', async () => {
    const store = await makeStore()

    store.setSelectedWindow(RUN_SEL(4))
    expect(store.selectedCycle).toBe(4)
    expect(store.isRangeSelected).toBe(false)

    store.setSelectedWindow(RANGE_SEL('2026-09-01', '2026-09-15'))
    expect(store.selectedCycle).toBeNull()
    expect(store.isRangeSelected).toBe(true)

    store.setSelectedWindow(null)
    expect(store.isRangeSelected).toBe(false)
  })

  it('rangesEnabled and rangeLimits default safely when overview is null', async () => {
    const { useOwnerIncomeStore } = await import('../../app/stores/ownerIncome')
    const store = useOwnerIncomeStore()

    expect(store.overview).toBeNull()
    expect(store.rangesEnabled).toBe(false)
    expect(store.rangeLimits).toBeNull()
  })

  it('tracks several windows loading at once', async () => {
    const store = await makeStore()

    store.setWindowLoading(RUN_4, true)
    store.setWindowLoading(RUN_2, true)
    store.setSelectedWindow(RUN_SEL(4))
    store.setWindowLoading(RUN_2, false)

    expect(store.isWindowLoading(RUN_2)).toBe(false)
    expect(store.isSelectedWindowLoading).toBe(true)

    store.setWindowLoading(RUN_4, false)
    expect(store.isSelectedWindowLoading).toBe(false)
  })

  it('reports no cycles and no default before an overview, and after reset', async () => {
    const store = await makeStore()
    expect(store.hasCycles).toBe(true)
    expect(store.defaultCycle).toBe(4)

    store.setSummary(RUN_4, windowSummary(runWindow(4, true)))
    store.setSelectedWindow(RUN_SEL(4))
    store.setOverviewError('boom')
    store.reset()

    expect(store.hasCycles).toBe(false)
    expect(store.defaultCycle).toBeNull()
    expect(store.selectedSummary).toBeNull()
    expect(store.summaries).toEqual({})
    expect(store.overviewError).toBeNull()
  })

  describe('run and range summaries coexisting', () => {
    it('caches a run and a range summary under distinct keys without collision', async () => {
      const store = await makeStore()

      store.setSummary(RUN_4, windowSummary(runWindow(4, true), 10))
      store.setSummary(RANGE_A, windowSummary(rangeWindow('2026-09-01', '2026-09-15'), 20))

      expect(store.summary(RUN_4)?.members.income).toBe(10)
      expect(store.summary(RANGE_A)?.members.income).toBe(20)
      expect(store.summary(RUN_4)?.window.number).toBe(4)
      expect(store.summary(RANGE_A)?.window.number).toBeNull()
    })

    it('caches a run and a range member list under distinct keys', async () => {
      const store = await makeStore()
      const query = { sort: 'income', direction: 'desc', search: '' } as const

      store.setMemberListQuery(RUN_4, query)
      store.setMemberListQuery(RANGE_A, { ...query, sort: 'name' })

      expect(store.memberList(RUN_4)?.sort).toBe('income')
      expect(store.memberList(RANGE_A)?.sort).toBe('name')
    })
  })

  describe('selectedWindowLabel', () => {
    it('is null when nothing is selected', async () => {
      const store = await makeStore()
      expect(store.selectedWindowLabel).toBeNull()
    })

    it('for a run: the overview cycle label before the summary lands, then the server label', async () => {
      const store = await makeStore()
      store.setSelectedWindow(RUN_SEL(4))

      expect(store.selectedWindowLabel).toBe('Run 4 · Aug 11 – Aug 20')

      store.setSummary(RUN_4, windowSummary({ ...runWindow(4, true), label: 'Run 4 · from server' }))
      expect(store.selectedWindowLabel).toBe('Run 4 · from server')
    })

    it('for a range: the locally built label before the summary lands, then the server label', async () => {
      const store = await makeStore()
      store.setSelectedWindow(RANGE_SEL('2026-09-01', '2026-09-15'))

      expect(store.selectedWindowLabel).toBe('1 Sep – 15 Sep')

      store.setSummary(RANGE_A, windowSummary(rangeWindow('2026-09-01', '2026-09-15')))
      expect(store.selectedWindowLabel).toBe('1 Sep – 15 Sep')
    })
  })

  describe('isSelectedWindowInProgress', () => {
    it('reads summary.window.in_progress once it lands; a range has no local fallback so it is false before that', async () => {
      const store = await makeStore()
      store.setSelectedWindow(RANGE_SEL('2026-09-01', '2026-09-15'))

      expect(store.isSelectedWindowInProgress).toBe(false)

      store.setSummary(RANGE_A, windowSummary(rangeWindow('2026-09-01', '2026-09-15', true)))
      expect(store.isSelectedWindowInProgress).toBe(true)
    })

    it('a run falls back to the overview\'s own cycle entry before the summary lands', async () => {
      const store = await makeStore()

      store.setSelectedWindow(RUN_SEL(2)) // not in progress per the overview fixture
      expect(store.isSelectedWindowInProgress).toBe(false)

      store.setSelectedWindow(RUN_SEL(4)) // in progress per the overview fixture
      expect(store.isSelectedWindowInProgress).toBe(true)

      store.setSummary(RUN_4, windowSummary(runWindow(4, false)))
      expect(store.isSelectedWindowInProgress).toBe(false)
    })
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
      gift_coins: 0,
    }
  }

  const QUERY = { sort: 'income', direction: 'desc', search: '' } as const

  it('keeps one list per window and exposes the selected one', async () => {
    const store = await makeStore()

    store.setMemberListQuery(RUN_4, QUERY)
    store.setMemberListQuery(RUN_2, { ...QUERY, sort: 'name' })
    store.setSelectedWindow(RUN_SEL(2))

    expect(store.selectedMemberList?.sort).toBe('name')
    expect(store.memberList(RUN_4)?.sort).toBe('income')
    expect(store.memberList('run:9')).toBeNull()
  })

  it('page 1 replaces rows, later pages append without repeating a member', async () => {
    const store = await makeStore()
    store.setMemberListQuery(RUN_4, QUERY)

    store.setMemberListPage(RUN_4, 1, [row(1), row(2)], true)
    store.setMemberListPage(RUN_4, 2, [row(2), row(3)], false)
    expect(store.memberList(RUN_4)?.rows.map((r) => r.user_id)).toEqual([1, 2, 3])
    expect(store.memberList(RUN_4)?.page).toBe(2)
    expect(store.memberList(RUN_4)?.hasMore).toBe(false)

    store.setMemberListPage(RUN_4, 1, [row(7)], false)
    expect(store.memberList(RUN_4)?.rows.map((r) => r.user_id)).toEqual([7])
  })

  it('a new query restarts the list at nothing loaded', async () => {
    const store = await makeStore()
    store.setMemberListQuery(RUN_4, QUERY)
    store.setMemberListRequest(RUN_4, 5, 2)
    store.setMemberListPage(RUN_4, 2, [row(1)], true)
    store.setMemberListError(RUN_4, 'boom')

    store.setMemberListQuery(RUN_4, { ...QUERY, search: 'ali' })

    expect(store.memberList(RUN_4)).toEqual({
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
    store.setMemberListQuery(RUN_4, QUERY)

    store.setMemberListRequest(RUN_4, 3, 1)
    expect(store.memberList(RUN_4)?.loadingPage).toBe(1)
    expect(store.memberList(RUN_4)?.requestId).toBe(3)

    store.setMemberListError(RUN_4, 'boom')
    expect(store.memberList(RUN_4)?.loadingPage).toBeNull()
    expect(store.memberList(RUN_4)?.error).toBe('boom')

    store.setMemberListRequest(RUN_4, 4, 1)
    expect(store.memberList(RUN_4)?.error).toBeNull()
    store.setMemberListPage(RUN_4, 1, [row(1)], false)
    expect(store.memberList(RUN_4)?.loadingPage).toBeNull()
  })

  it('setters on a window with no list do nothing, and reset clears every list', async () => {
    const store = await makeStore()

    store.setMemberListRequest('run:9', 1, 1)
    store.setMemberListPage('run:9', 1, [row(1)], false)
    store.setMemberListError('run:9', 'boom')
    expect(store.memberList('run:9')).toBeNull()

    store.setMemberListQuery(RUN_4, QUERY)
    store.setSelectedWindow(RUN_SEL(4))
    store.reset()

    expect(store.memberLists).toEqual({})
    expect(store.selectedMemberList).toBeNull()
  })
})

describe('useOwnerIncomeStore member sheets', () => {
  function sheet(userId: number, earned: number): OwnerIncomeMemberSheet {
    return {
      member: { user_id: userId, name: `Member ${userId}`, avatar_url: null, signature: null, left: false },
      run: {
        id: userId,
        status: 'closed',
        status_label: 'Closed',
        status_color: 'neutral',
        started_at: '2026-08-11T00:00:00+00:00',
        ends_at: '2026-08-21T00:00:00+00:00',
        accumulated_xp: 0,
        current_tier: 0,
      },
      totals: { earned, exchanged: 0, deducted: 0, income: earned },
      milestones: [],
      exchanges: [],
      deductions: [],
    }
  }

  const member = (userId: number) => sheet(userId, 0).member

  it('caches sheets per (window, user) and exposes the open one', async () => {
    const store = await makeStore()

    store.setMemberSheet(RUN_4, sheet(7, 40))
    store.setMemberSheet(RUN_2, sheet(7, 20))

    expect(store.memberSheet(RUN_4, 7)?.totals.earned).toBe(40)
    expect(store.memberSheet(RUN_2, 7)?.totals.earned).toBe(20)
    expect(store.memberSheet(RUN_4, 8)).toBeNull()
    expect(store.openMemberSheet).toBeNull()

    store.setOpenMember({ window: RUN_SEL(2), member: member(7) })
    expect(store.openMemberSheet?.totals.earned).toBe(20)

    store.setOpenMember({ window: RUN_SEL(4), member: member(8) })
    expect(store.openMemberSheet).toBeNull()
  })

  it('does not resolve a sheet cached for the other window for the same user', async () => {
    const store = await makeStore()

    store.setMemberSheet(RUN_4, sheet(7, 40))
    store.setMemberSheet(RANGE_A, sheet(7, 999))

    store.setOpenMember({ window: RUN_SEL(4), member: member(7) })
    expect(store.openMemberSheetKey).toBe(`${RUN_4}:7`)
    expect(store.openMemberSheet?.totals.earned).toBe(40)

    store.setOpenMember({ window: RANGE_SEL('2026-09-01', '2026-09-15'), member: member(7) })
    expect(store.openMemberSheetKey).toBe(`${RANGE_A}:7`)
    expect(store.openMemberSheet?.totals.earned).toBe(999)
  })

  it('tracks the request in flight and ends it on sheet, error or clear', async () => {
    const store = await makeStore()

    store.setMemberSheetRequest(3)
    expect(store.isMemberSheetLoading).toBe(true)
    expect(store.memberSheetRequestId).toBe(3)

    store.setMemberSheetError('boom')
    expect(store.isMemberSheetLoading).toBe(false)
    expect(store.memberSheetError).toBe('boom')

    store.setMemberSheetRequest(4)
    expect(store.memberSheetError).toBeNull()
    store.setMemberSheet(RUN_4, sheet(7, 1))
    expect(store.isMemberSheetLoading).toBe(false)

    store.setMemberSheetRequest(5)
    store.clearMemberSheetRequest()
    expect(store.isMemberSheetLoading).toBe(false)
    expect(store.memberSheetError).toBeNull()
  })

  it('reset closes the sheet and clears the cache and request state', async () => {
    const store = await makeStore()
    store.setMemberSheet(RUN_4, sheet(7, 1))
    store.setOpenMember({ window: RUN_SEL(4), member: member(7) })
    store.setMemberSheetRequest(9)

    store.reset()

    expect(store.memberSheets).toEqual({})
    expect(store.openMember).toBeNull()
    expect(store.openMemberSheet).toBeNull()
    expect(store.isMemberSheetLoading).toBe(false)
    expect(store.memberSheetError).toBeNull()
  })
})
