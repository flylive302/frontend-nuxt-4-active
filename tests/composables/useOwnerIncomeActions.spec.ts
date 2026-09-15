// ========================================
// useOwnerIncomeActions Composable Tests
// ========================================
// agency-member-income-runs epic: cycle-centric owner/admin page. Verifies the
// load contract (one overview call, then the default cycle's summary), the
// empty state (no summary request), the per-cycle summary cache (re-selecting a
// viewed cycle makes no request), failure handling, and the members list:
// load more, sort/direction/search (debounced) restarting at page 1, per-cycle
// list state, and stale responses being dropped.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import type {
  OwnerIncomeCycle,
  OwnerIncomeCycleSummary,
  OwnerIncomeMemberRow,
  OwnerIncomeMembersPage,
  OwnerIncomeOverview,
} from '../../app/types/income/ownerIncome'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

// ========================================
// Fixtures
// ========================================

const IN_PROGRESS = 4

function cycle(number: number): OwnerIncomeCycle {
  return {
    number,
    start: '2026-08-11T00:00:00+00:00',
    end: '2026-08-21T00:00:00+00:00',
    in_progress: number === IN_PROGRESS,
    label: `Run ${number} · Aug 11 – Aug 20`,
  }
}

function overview(numbers: number[]): OwnerIncomeOverview {
  return {
    agency: { id: 12, name: 'Agency', logo_url: null },
    default_cycle: numbers[0] ?? null,
    cycles: numbers.map(cycle),
  }
}

function summary(number: number, withOwner = true): OwnerIncomeCycleSummary {
  return {
    cycle: cycle(number),
    members: { earned: 100 + number, exchanged: 10, deducted: 5, income: 85 + number, members_count: 3, left_count: 1 },
    ...(withOwner
      ? { owner: { owner_cut: 20, own_hosting: 30, earned: 50, exchanged: 4, deducted: 6, income: 40 } }
      : {}),
  }
}

// ========================================
// Harness
// ========================================

let apiMock = vi.fn()
let toastAdd = vi.fn()

interface MembersQuery {
  page: number
  sort: string
  direction: string
  search?: string
}

function memberRow(userId: number): OwnerIncomeMemberRow {
  return {
    user_id: userId,
    name: `Member ${userId}`,
    avatar_url: null,
    signature: String(10000 + userId),
    left: false,
    run_id: userId,
    current_tier: 1,
    accumulated_xp: 500,
    earned: 100,
    exchanged: 10,
    deducted: 5,
    income: 85,
  }
}

/** Page N of a two-page roster: users N*10+1 and N*10+2; page 2 is the last. */
function membersPage(query: MembersQuery): OwnerIncomeMembersPage {
  return {
    members: [memberRow(query.page * 10 + 1), memberRow(query.page * 10 + 2)],
    meta: { page: query.page, per_page: 30, has_more: query.page < 2 },
  }
}

const MEMBERS_URL = /^\/user\/agency\/income\/cycles\/(\d+)\/members$/

/** Routes GET URLs to canned payloads. */
function routeApi(current: OwnerIncomeOverview, withOwner = true) {
  apiMock = vi.fn(async (url: string, options?: { query?: MembersQuery }) => {
    if (url === '/user/agency/income/overview') return { success: true, data: current }
    const cycleMatch = url.match(/^\/user\/agency\/income\/cycles\/(\d+)$/)
    if (cycleMatch) return { success: true, data: summary(Number(cycleMatch[1]), withOwner) }
    if (MEMBERS_URL.test(url) && options?.query) return { success: true, data: membersPage(options.query) }
    throw new Error(`unexpected ${url}`)
  })
}

/** The `query` of every members request for one cycle, in call order. */
function membersCalls(cycleNumber: number): MembersQuery[] {
  return apiMock.mock.calls
    .filter(([called]) => called === `/user/agency/income/cycles/${cycleNumber}/members`)
    .map(([, options]) => (options as { query: MembersQuery }).query)
}

/** A promise whose resolution the test controls. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function setup() {
  const { useOwnerIncomeStore } = await import('../../app/stores/ownerIncome')
  ;(globalThis as Record<string, unknown>).useOwnerIncomeStore = useOwnerIncomeStore
  const { useOwnerIncomeActions } = await import('../../app/composables/income/useOwnerIncomeActions')
  return { store: useOwnerIncomeStore(), actions: useOwnerIncomeActions() }
}

function callsTo(url: string): number {
  return apiMock.mock.calls.filter(([called]) => called === url).length
}

beforeEach(() => {
  vi.resetModules()
  setActivePinia(createPinia())
  toastAdd = vi.fn()
  ;(globalThis as Record<string, unknown>).useApi = () => ({
    api: (...args: unknown[]) => apiMock(...args),
    normalizeError: (e: unknown) => ({ message: String(e) }),
  })
  ;(globalThis as Record<string, unknown>).useToast = () => ({ add: toastAdd })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'useApi')
  Reflect.deleteProperty(globalThis, 'useToast')
  Reflect.deleteProperty(globalThis, 'useOwnerIncomeStore')
})

// ========================================
// Tests
// ========================================

describe('useOwnerIncomeActions.loadOwnerIncomePage', () => {
  it('loads the overview, then the default cycle summary and members page 1', async () => {
    routeApi(overview([IN_PROGRESS, 2]))
    const { store, actions } = await setup()

    await actions.loadOwnerIncomePage()

    expect(apiMock).toHaveBeenCalledTimes(3)
    expect(callsTo('/user/agency/income/overview')).toBe(1)
    expect(callsTo(`/user/agency/income/cycles/${IN_PROGRESS}`)).toBe(1)
    expect(membersCalls(IN_PROGRESS)).toEqual([{ page: 1, sort: 'income', direction: 'desc' }])
    expect(store.selectedMemberList?.rows.map((row) => row.user_id)).toEqual([11, 12])
    expect(store.selectedMemberList?.hasMore).toBe(true)
    expect(store.selectedMemberList?.loadingPage).toBeNull()
    expect(store.selectedCycle).toBe(IN_PROGRESS)
    expect(store.isSelectedCycleInProgress).toBe(true)
    expect(store.selectedSummary?.members.income).toBe(89)
    expect(store.isSelectedCycleLoading).toBe(false)
  })

  it('makes only the overview call when the agency never had a run', async () => {
    routeApi(overview([]))
    const { store, actions } = await setup()

    await actions.loadOwnerIncomePage()

    expect(apiMock).toHaveBeenCalledTimes(1)
    expect(store.hasCycles).toBe(false)
    expect(store.selectedCycle).toBeNull()
    expect(store.selectedSummary).toBeNull()
  })

  it('keeps an admin summary without an owner block', async () => {
    routeApi(overview([IN_PROGRESS]), false)
    const { store, actions } = await setup()

    await actions.loadOwnerIncomePage()

    expect(store.selectedSummary?.members.members_count).toBe(3)
    expect(store.selectedSummary && 'owner' in store.selectedSummary).toBe(false)
  })

  it('records the overview error and requests no summary', async () => {
    routeApi(overview([IN_PROGRESS]))
    const { store, actions } = await setup()
    apiMock.mockRejectedValueOnce(new Error('forbidden'))

    await actions.loadOwnerIncomePage()

    expect(apiMock).toHaveBeenCalledTimes(1)
    expect(store.overviewError).toBe('Error: forbidden')
    expect(store.isOverviewLoading).toBe(false)
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('starts each visit fresh — a reload refetches the summary', async () => {
    routeApi(overview([IN_PROGRESS]))
    const { actions } = await setup()

    await actions.loadOwnerIncomePage()
    await actions.loadOwnerIncomePage()

    expect(callsTo(`/user/agency/income/cycles/${IN_PROGRESS}`)).toBe(2)
  })
})

describe('useOwnerIncomeActions.selectCycle', () => {
  it('re-selects a previously viewed cycle without a request', async () => {
    routeApi(overview([IN_PROGRESS, 2, 1]))
    const { store, actions } = await setup()
    await actions.loadOwnerIncomePage()

    await actions.selectCycle(2)
    await actions.selectCycle(IN_PROGRESS)
    await actions.selectCycle(2)

    expect(callsTo(`/user/agency/income/cycles/${IN_PROGRESS}`)).toBe(1)
    expect(callsTo('/user/agency/income/cycles/2')).toBe(1)
    expect(membersCalls(IN_PROGRESS)).toHaveLength(1)
    expect(membersCalls(2)).toHaveLength(1)
    expect(store.selectedCycle).toBe(2)
    expect(store.isSelectedCycleInProgress).toBe(false)
    expect(store.selectedSummary?.cycle.number).toBe(2)
  })

  it('does not request a cycle that is already in flight', async () => {
    routeApi(overview([IN_PROGRESS, 2]))
    const { actions } = await setup()
    await actions.fetchOverview()

    await Promise.all([actions.selectCycle(2), actions.selectCycle(2)])

    expect(callsTo('/user/agency/income/cycles/2')).toBe(1)
  })

  it('toasts, caches nothing and allows a retry when the fetch fails', async () => {
    routeApi(overview([IN_PROGRESS, 2]))
    const { store, actions } = await setup()
    await actions.fetchOverview()
    apiMock.mockRejectedValueOnce(new Error('boom'))

    await actions.selectCycle(2)

    expect(store.selectedSummary).toBeNull()
    expect(store.isSelectedCycleLoading).toBe(false)
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))

    await actions.selectCycle(2)

    expect(callsTo('/user/agency/income/cycles/2')).toBe(2)
    expect(store.selectedSummary?.cycle.number).toBe(2)
  })
})

describe('useOwnerIncomeActions members list', () => {
  async function loaded(numbers = [IN_PROGRESS, 2]) {
    routeApi(overview(numbers))
    const ctx = await setup()
    await ctx.actions.loadOwnerIncomePage()
    return ctx
  }

  it('load more appends the next page and stops when has_more is false', async () => {
    const { store, actions } = await loaded()

    await actions.loadMoreMembers()

    expect(membersCalls(IN_PROGRESS).map((query) => query.page)).toEqual([1, 2])
    expect(store.selectedMemberList?.rows.map((row) => row.user_id)).toEqual([11, 12, 21, 22])
    expect(store.selectedMemberList?.page).toBe(2)
    expect(store.selectedMemberList?.hasMore).toBe(false)

    await actions.loadMoreMembers()

    expect(membersCalls(IN_PROGRESS)).toHaveLength(2)
  })

  it('does not request the next page twice while it is in flight', async () => {
    const { actions } = await loaded()

    await Promise.all([actions.loadMoreMembers(), actions.loadMoreMembers()])

    expect(membersCalls(IN_PROGRESS).map((query) => query.page)).toEqual([1, 2])
  })

  it('skips a member already shown when a later page repeats them', async () => {
    const { store, actions } = await loaded()
    apiMock.mockResolvedValueOnce({
      success: true,
      data: { members: [memberRow(12), memberRow(21)], meta: { page: 2, per_page: 30, has_more: false } },
    })

    await actions.loadMoreMembers()

    expect(store.selectedMemberList?.rows.map((row) => row.user_id)).toEqual([11, 12, 21])
  })

  it('changing sort or direction reloads page 1 and keeps the other query parts', async () => {
    const { store, actions } = await loaded()
    await actions.loadMoreMembers()

    await actions.setMembersSort('name')
    await actions.setMembersDirection('asc')

    expect(membersCalls(IN_PROGRESS).slice(2)).toEqual([
      { page: 1, sort: 'name', direction: 'desc' },
      { page: 1, sort: 'name', direction: 'asc' },
    ])
    expect(store.selectedMemberList?.rows.map((row) => row.user_id)).toEqual([11, 12])
    expect(store.selectedMemberList?.page).toBe(1)

    await actions.setMembersSort('name')
    await actions.setMembersDirection('asc')

    expect(membersCalls(IN_PROGRESS)).toHaveLength(4)
  })

  it('keeps each cycle\'s own sort and list across cycle switches', async () => {
    const { store, actions } = await loaded()
    await actions.setMembersSort('xp')

    await actions.selectCycle(2)
    expect(store.selectedMemberList?.sort).toBe('income')

    await actions.selectCycle(IN_PROGRESS)
    expect(store.selectedMemberList?.sort).toBe('xp')
    expect(membersCalls(IN_PROGRESS)).toHaveLength(2)
    expect(membersCalls(2)).toHaveLength(1)
  })

  describe('search', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('debounces keystrokes into one trimmed page 1 request', async () => {
      const { store, actions } = await loaded()

      actions.setMembersSearch('a')
      actions.setMembersSearch('al')
      actions.setMembersSearch(' ali ')
      await vi.advanceTimersByTimeAsync(299)
      expect(membersCalls(IN_PROGRESS)).toHaveLength(1)

      await vi.advanceTimersByTimeAsync(1)

      expect(membersCalls(IN_PROGRESS)).toEqual([
        { page: 1, sort: 'income', direction: 'desc' },
        { page: 1, sort: 'income', direction: 'desc', search: 'ali' },
      ])
      expect(store.selectedMemberList?.search).toBe('ali')
    })

    it('makes no request when the committed term is unchanged', async () => {
      const { actions } = await loaded()

      actions.setMembersSearch('   ')
      await vi.advanceTimersByTimeAsync(300)

      expect(membersCalls(IN_PROGRESS)).toHaveLength(1)
    })

    it('lands on the cycle it was typed for, even after a cycle switch', async () => {
      const { store, actions } = await loaded()

      actions.setMembersSearch('bob')
      await actions.selectCycle(2)
      await vi.advanceTimersByTimeAsync(300)

      expect(store.memberList(IN_PROGRESS)?.search).toBe('bob')
      expect(store.memberList(2)?.search).toBe('')
      expect(membersCalls(IN_PROGRESS).at(-1)).toEqual({ page: 1, sort: 'income', direction: 'desc', search: 'bob' })
    })

    it('a page load cancels a pending search', async () => {
      const { actions } = await loaded()

      actions.setMembersSearch('bob')
      await actions.loadOwnerIncomePage()
      await vi.advanceTimersByTimeAsync(300)

      expect(membersCalls(IN_PROGRESS).some((query) => query.search === 'bob')).toBe(false)
    })
  })

  it('drops a response superseded by a newer query', async () => {
    const { store, actions } = await loaded()
    const slow = deferred<unknown>()
    apiMock.mockImplementationOnce(() => slow.promise)

    const staleSort = actions.setMembersSort('earned')
    await actions.setMembersSort('name')
    slow.resolve({
      success: true,
      data: { members: [memberRow(99)], meta: { page: 1, per_page: 30, has_more: false } },
    })
    await staleSort

    expect(store.selectedMemberList?.sort).toBe('name')
    expect(store.selectedMemberList?.rows.map((row) => row.user_id)).toEqual([11, 12])
    expect(store.selectedMemberList?.loadingPage).toBeNull()
  })

  it('drops a failure superseded by a newer query', async () => {
    const { store, actions } = await loaded()
    const slow = deferred<unknown>()
    apiMock.mockImplementationOnce(() => slow.promise)

    const staleSort = actions.setMembersSort('earned')
    await actions.setMembersSort('name')
    slow.reject(new Error('late'))
    await staleSort

    expect(store.selectedMemberList?.error).toBeNull()
    expect(store.selectedMemberList?.rows).toHaveLength(2)
  })

  it('records a page 1 failure and retries page 1', async () => {
    routeApi(overview([IN_PROGRESS]))
    const { store, actions } = await setup()
    await actions.fetchOverview()
    store.setSummary(summary(IN_PROGRESS))
    apiMock.mockRejectedValueOnce(new Error('down'))

    await actions.selectCycle(IN_PROGRESS)

    expect(store.selectedMemberList?.error).toBe('Error: down')
    expect(store.selectedMemberList?.rows).toEqual([])
    expect(store.selectedMemberList?.loadingPage).toBeNull()
    expect(toastAdd).not.toHaveBeenCalled()

    await actions.retryMembers()

    expect(membersCalls(IN_PROGRESS).map((query) => query.page)).toEqual([1, 1])
    expect(store.selectedMemberList?.error).toBeNull()
    expect(store.selectedMemberList?.rows).toHaveLength(2)
  })

  it('keeps loaded rows when load more fails and retries that page', async () => {
    const { store, actions } = await loaded()
    apiMock.mockRejectedValueOnce(new Error('flaky'))

    await actions.loadMoreMembers()

    expect(store.selectedMemberList?.rows).toHaveLength(2)
    expect(store.selectedMemberList?.error).toBe('Error: flaky')
    expect(store.selectedMemberList?.hasMore).toBe(true)

    await actions.retryMembers()

    expect(membersCalls(IN_PROGRESS).map((query) => query.page)).toEqual([1, 2, 2])
    expect(store.selectedMemberList?.rows).toHaveLength(4)
  })

  it('re-selecting a cycle whose page 1 failed tries again', async () => {
    const { store, actions } = await loaded()
    apiMock.mockImplementation(async (url: string, options?: { query?: MembersQuery }) => {
      if (url === '/user/agency/income/cycles/2/members') throw new Error('down')
      if (url === '/user/agency/income/cycles/2') return { success: true, data: summary(2) }
      if (MEMBERS_URL.test(url) && options?.query) return { success: true, data: membersPage(options.query) }
      throw new Error(`unexpected ${url}`)
    })

    await actions.selectCycle(2)
    expect(store.memberList(2)?.error).toBe('Error: down')

    routeApi(overview([IN_PROGRESS, 2]))
    await actions.selectCycle(IN_PROGRESS)
    await actions.selectCycle(2)

    expect(membersCalls(2)).toHaveLength(1)
    expect(store.memberList(2)?.rows).toHaveLength(2)
  })
})
