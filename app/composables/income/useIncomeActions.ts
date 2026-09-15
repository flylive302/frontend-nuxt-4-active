// ========================================
// Income — GATE / EXECUTE / REACT
// ========================================
// Run-centric "My Agency Income" page: one overview call on load, one detail
// call per run switch (cached by run id), claim from inside the run view.

import { createLogger } from '~/utils/logger'
import type {
  AgencyRun,
  ClaimResult,
  IncomeOverview,
  RunDetail,
} from '~/types/income/income'

const log = createLogger('[useIncomeActions]')

export function useIncomeActions() {
  const store = useIncomeStore()
  const toast = useToast()
  const { api, normalizeError } = useApi()

  async function fetchOverview(): Promise<void> {
    store.setOverviewLoading(true)
    store.setError(null)

    try {
      const response = await api<{ success: true; data: IncomeOverview }>('/user/income/overview')
      store.setOverview(response.data)
    } catch (err) {
      const normalized = normalizeError(err)
      store.setError(normalized.message)
    } finally {
      store.setOverviewLoading(false)
    }
  }

  /**
   * Fetch one run's detail into the cache. The active run's detail also feeds
   * the ladder/progress components and the milestone-drain celebration, so it
   * replaces `activeRun` (it carries every AgencyRun field).
   */
  async function fetchRunDetail(runId: number): Promise<void> {
    store.setLoadingRunId(runId)

    try {
      const response = await api<{ success: true; data: RunDetail }>(`/user/income/runs/${runId}`)
      store.setRunDetail(response.data)

      if (response.data.id === store.overview?.active_run_id) {
        store.setActiveRun(response.data)
      }
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: normalized.message, color: 'error' })
    } finally {
      if (store.loadingRunId === runId) {
        store.setLoadingRunId(null)
      }
    }
  }

  async function selectRun(runId: number): Promise<void> {
    store.setSelectedRunId(runId)

    // GATE — a cached run re-selects instantly, no request.
    if (store.runDetails[runId] || store.loadingRunId === runId) return

    // EXECUTE
    await fetchRunDetail(runId)
  }

  /**
   * Page load: overview, then the default run (active, else latest). The detail
   * cache lives for one visit only, so figures are fresh each time the page
   * opens. With no active run, `activeRun` is cleared so the drain and ladder
   * stay idle.
   */
  async function loadIncomePage(): Promise<void> {
    store.clearRunDetails()
    store.setSelectedRunId(null)
    await fetchOverview()

    if (store.overview?.active_run_id == null) {
      store.setActiveRun(null)
    }

    const runId = store.defaultRunId
    if (runId !== null) {
      await selectRun(runId)
    }

    store.setLastFetchedAt(Date.now())
  }

  /**
   * Profile's "My Agency Income" link: current members always see it; anyone
   * else only when they have past runs (ex-members keep their history). Loads
   * the overview so `store.hasAnyRun` can answer. Silent on failure — no toast,
   * the link just stays hidden.
   */
  async function checkPastRuns(isAgencyMember: boolean): Promise<void> {
    // GATE — members get the link anyway; skip the call.
    if (isAgencyMember || store.isOverviewLoading) return

    // EXECUTE
    await fetchOverview()
  }

  /**
   * Realtime fallback: a socket update for a run the client hasn't loaded
   * (lazily opened) refetches the active run. When the income page's overview
   * is loaded and doesn't know that run yet, it is refreshed too so the
   * selector, banner and "no active run" note don't go stale for the visit.
   */
  async function fetchActiveRun(): Promise<void> {
    store.setRunLoading(true)

    try {
      const response = await api<{ success: true; data: AgencyRun | null }>(
        '/user/income/targets/active'
      )
      store.setActiveRun(response.data)
    } catch (err) {
      log.warn('Failed to fetch active run', err)
      store.setActiveRun(null)
    } finally {
      store.setRunLoading(false)
    }

    // REACT
    const activeRunId = store.activeRun?.id ?? null
    if (store.overview && activeRunId !== store.overview.active_run_id) {
      await fetchOverview()

      if (store.selectedRunId === null && store.defaultRunId !== null) {
        await selectRun(store.defaultRunId)
      }
    }
  }

  async function claim(runId: number): Promise<void> {
    // GATE
    if (store.isClaiming) return

    // EXECUTE
    store.setClaiming(true)

    try {
      const response = await api<{ success: true; data: ClaimResult }>(
        `/user/income/targets/${runId}/claim`,
        { method: 'POST' }
      )

      // REACT
      const { claimed_count, diamonds_claimed } = response.data

      if (claimed_count > 0) {
        toast.add({ title: `Claimed ${diamonds_claimed} 💎`, color: 'success' })
      } else {
        toast.add({ title: 'Nothing left to claim', color: 'neutral' })
      }

      // Refresh badges, banner and the run's claim states either way.
      await Promise.all([fetchRunDetail(runId), fetchOverview()])
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: normalized.message, color: 'error' })
    } finally {
      store.setClaiming(false)
    }
  }

  return {
    fetchOverview,
    fetchRunDetail,
    selectRun,
    loadIncomePage,
    checkPastRuns,
    fetchActiveRun,
    claim,
  }
}
