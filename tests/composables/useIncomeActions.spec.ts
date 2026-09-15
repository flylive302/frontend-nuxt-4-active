// ========================================
// useIncomeActions Composable Tests
// ========================================
// member-income-runs epic: run-centric income page. Verifies the load contract
// (one overview call, then the default run — active, else latest), the per-run
// detail cache (re-selecting a viewed run makes no request), active-run
// hand-off to the ladder/drain, and claim refetching detail + overview.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import type { IncomeOverview, OverviewRun, RunDetail } from '../../app/types/income/income'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}))

// ========================================
// Fixtures
// ========================================

function overviewRun(id: number, status: OverviewRun['status'] = 'closed'): OverviewRun {
  return {
    id,
    status,
    status_label: status,
    status_color: 'success',
    started_at: '2026-08-11T00:00:00+00:00',
    ends_at: '2026-08-21T00:00:00+00:00',
    label: 'Aug 11 – Aug 21, 2026',
    has_unclaimed: false,
  }
}

function overview(activeRunId: number | null, runIds: number[]): IncomeOverview {
  return {
    lifetime: { income: 0, earned: 0, exchanged: 0, deducted: 0, completed_runs: 0 },
    current_agency: null,
    active_run_id: activeRunId,
    unclaimed_runs_count: 0,
    agencies: runIds.length
      ? [{ id: 1, name: 'Agency', logo_url: null, runs: runIds.map((id) => overviewRun(id, id === activeRunId ? 'active' : 'closed')) }]
      : [],
  }
}

function detail(id: number): RunDetail {
  return {
    id,
    status: 'closed',
    status_label: 'Closed',
    status_color: 'success',
    accumulated_xp: 0,
    current_tier: 0,
    band_floor: null,
    band_ceiling: null,
    progress_percentage: null,
    started_at: '2026-08-11T00:00:00+00:00',
    ends_at: '2026-08-21T00:00:00+00:00',
    refunded_coins: 0,
    refunded_at: null,
    ladder: [],
    created_at: '2026-08-11T00:00:00+00:00',
    agency: { id: 1, name: 'Agency', logo_url: null },
    totals: { earned: 30, exchanged: 9, deducted: 10, income: 11 },
    milestones: [],
    exchanges: [],
    deductions: [],
  }
}

// ========================================
// Harness
// ========================================

let apiMock = vi.fn()
let toastAdd = vi.fn()

/** Routes GET/POST URLs to canned payloads. */
function routeApi(current: IncomeOverview) {
  apiMock = vi.fn(async (url: string) => {
    if (url === '/user/income/overview') return { success: true, data: current }
    const runMatch = url.match(/^\/user\/income\/runs\/(\d+)$/)
    if (runMatch) return { success: true, data: detail(Number(runMatch[1])) }
    if (url.endsWith('/claim')) return { success: true, data: { claimed_count: 1, claimed_tiers: [1], diamonds_claimed: 6 } }
    throw new Error(`unexpected ${url}`)
  })
}

async function setup() {
  const { useIncomeStore } = await import('../../app/stores/income')
  ;(globalThis as Record<string, unknown>).useIncomeStore = useIncomeStore
  const { useIncomeActions } = await import('../../app/composables/income/useIncomeActions')
  return { store: useIncomeStore(), actions: useIncomeActions() }
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
  Reflect.deleteProperty(globalThis, 'useIncomeStore')
})

// ========================================
// Tests
// ========================================

describe('useIncomeActions.loadIncomePage', () => {
  it('selects the active run by default and hands it to the ladder/drain', async () => {
    routeApi(overview(7, [7, 5]))
    const { store, actions } = await setup()

    await actions.loadIncomePage()

    expect(apiMock).toHaveBeenCalledTimes(2)
    expect(store.selectedRunId).toBe(7)
    expect(store.selectedRunDetail?.totals.income).toBe(11)
    expect(store.activeRun?.id).toBe(7)
    expect(store.isSelectedRunActive).toBe(true)
  })

  it('falls back to the latest run and clears the active run when none is active', async () => {
    routeApi(overview(null, [5, 3]))
    const { store, actions } = await setup()
    store.setActiveRun(detail(99))

    await actions.loadIncomePage()

    expect(store.selectedRunId).toBe(5)
    expect(store.activeRun).toBeNull()
  })

  it('makes only the overview call when the user has no runs', async () => {
    routeApi(overview(null, []))
    const { store, actions } = await setup()

    await actions.loadIncomePage()

    expect(apiMock).toHaveBeenCalledTimes(1)
    expect(store.selectedRunId).toBeNull()
    expect(store.hasAnyRun).toBe(false)
  })
})

describe('useIncomeActions.checkPastRuns', () => {
  it('makes no request for a current agency member', async () => {
    routeApi(overview(7, [7]))
    const { store, actions } = await setup()

    await actions.checkPastRuns(true)

    expect(apiMock).not.toHaveBeenCalled()
    expect(store.overview).toBeNull()
  })

  it('loads the overview for a non-member so an ex-member with runs gets the link', async () => {
    routeApi(overview(null, [5]))
    const { store, actions } = await setup()

    await actions.checkPastRuns(false)

    expect(callsTo('/user/income/overview')).toBe(1)
    expect(apiMock).toHaveBeenCalledTimes(1)
    expect(store.hasAnyRun).toBe(true)
  })

  it('reports no runs for a user who was never in an agency', async () => {
    routeApi(overview(null, []))
    const { store, actions } = await setup()

    await actions.checkPastRuns(false)

    expect(store.hasAnyRun).toBe(false)
  })

  it('fails silently — no toast, link stays hidden', async () => {
    routeApi(overview(null, [5]))
    const { store, actions } = await setup()
    apiMock.mockRejectedValueOnce(new Error('boom'))

    await expect(actions.checkPastRuns(false)).resolves.toBeUndefined()

    expect(store.hasAnyRun).toBe(false)
    expect(store.isOverviewLoading).toBe(false)
    expect(toastAdd).not.toHaveBeenCalled()
  })
})

describe('useIncomeActions.selectRun', () => {
  it('re-selects a previously viewed run without a request', async () => {
    routeApi(overview(null, [5, 3]))
    const { store, actions } = await setup()
    await actions.loadIncomePage()

    await actions.selectRun(3)
    await actions.selectRun(5)
    await actions.selectRun(3)

    expect(callsTo('/user/income/runs/5')).toBe(1)
    expect(callsTo('/user/income/runs/3')).toBe(1)
    expect(store.selectedRunDetail?.id).toBe(3)
  })

  it('toasts and leaves no cached detail when the fetch fails', async () => {
    routeApi(overview(null, [5]))
    const { store, actions } = await setup()
    await actions.fetchOverview()
    apiMock.mockRejectedValueOnce(new Error('boom'))

    await actions.selectRun(5)

    expect(store.selectedRunDetail).toBeNull()
    expect(store.isSelectedRunLoading).toBe(false)
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
  })
})

describe('useIncomeActions.fetchActiveRun', () => {
  it('refreshes a loaded overview when the realtime fallback finds a newly opened run', async () => {
    routeApi(overview(null, []))
    const { store, actions } = await setup()
    await actions.loadIncomePage()
    const refreshed = overview(9, [9])
    apiMock.mockImplementation(async (url: string) => {
      if (url === '/user/income/targets/active') return { success: true, data: detail(9) }
      if (url === '/user/income/overview') return { success: true, data: refreshed }
      if (url === '/user/income/runs/9') return { success: true, data: detail(9) }
      throw new Error(`unexpected ${url}`)
    })

    await actions.fetchActiveRun()

    expect(store.activeRun?.id).toBe(9)
    expect(store.overview?.active_run_id).toBe(9)
    expect(store.hasAnyRun).toBe(true)
    expect(store.selectedRunDetail?.id).toBe(9)
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('does not fetch the overview when the income page was never opened', async () => {
    routeApi(overview(null, []))
    const { actions } = await setup()
    apiMock.mockImplementation(async () => ({ success: true, data: detail(9) }))

    await actions.fetchActiveRun()

    expect(callsTo('/user/income/overview')).toBe(0)
  })
})

describe('useIncomeActions.claim', () => {
  it('refetches the run detail and the overview after claiming', async () => {
    routeApi(overview(null, [5]))
    const { actions } = await setup()
    await actions.loadIncomePage()
    apiMock.mockClear()

    await actions.claim(5)

    expect(apiMock).toHaveBeenCalledWith('/user/income/targets/5/claim', { method: 'POST' })
    expect(callsTo('/user/income/runs/5')).toBe(1)
    expect(callsTo('/user/income/overview')).toBe(1)
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'success' }))
  })
})
