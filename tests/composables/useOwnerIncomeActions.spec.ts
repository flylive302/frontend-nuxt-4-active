// ========================================
// useOwnerIncomeActions Composable Tests
// ========================================
// agency-member-income-runs epic: cycle-centric owner/admin page. Verifies the
// load contract (one overview call, then the default cycle's summary), the
// empty state (no summary request), the per-cycle summary cache (re-selecting a
// viewed cycle makes no request) and failure handling.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import type {
  OwnerIncomeCycle,
  OwnerIncomeCycleSummary,
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

/** Routes GET URLs to canned payloads. */
function routeApi(current: OwnerIncomeOverview, withOwner = true) {
  apiMock = vi.fn(async (url: string) => {
    if (url === '/user/agency/income/overview') return { success: true, data: current }
    const cycleMatch = url.match(/^\/user\/agency\/income\/cycles\/(\d+)$/)
    if (cycleMatch) return { success: true, data: summary(Number(cycleMatch[1]), withOwner) }
    throw new Error(`unexpected ${url}`)
  })
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
  it('loads the overview, then the default cycle summary', async () => {
    routeApi(overview([IN_PROGRESS, 2]))
    const { store, actions } = await setup()

    await actions.loadOwnerIncomePage()

    expect(apiMock).toHaveBeenCalledTimes(2)
    expect(callsTo('/user/agency/income/overview')).toBe(1)
    expect(callsTo(`/user/agency/income/cycles/${IN_PROGRESS}`)).toBe(1)
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
