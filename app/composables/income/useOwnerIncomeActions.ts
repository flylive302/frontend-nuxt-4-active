// ========================================
// Owner Income — GATE / EXECUTE / REACT
// ========================================
// Cycle-centric owner/admin "Member Income" page: one overview call on load,
// then one summary call per cycle (cached by cycle number for the visit).

import type {
  OwnerIncomeCycleSummary,
  OwnerIncomeOverview,
} from '~/types/income/ownerIncome'

export function useOwnerIncomeActions() {
  const store = useOwnerIncomeStore()
  const toast = useToast()
  const { api, normalizeError } = useApi()

  async function fetchOverview(): Promise<void> {
    store.setOverviewLoading(true)
    store.setOverviewError(null)

    try {
      const response = await api<{ success: true; data: OwnerIncomeOverview }>('/user/agency/income/overview')
      store.setOverview(response.data)
    } catch (err) {
      const normalized = normalizeError(err)
      store.setOverviewError(normalized.message)
    } finally {
      store.setOverviewLoading(false)
    }
  }

  async function fetchCycleSummary(cycleNumber: number): Promise<void> {
    store.setCycleLoading(cycleNumber, true)

    try {
      const response = await api<{ success: true; data: OwnerIncomeCycleSummary }>(
        `/user/agency/income/cycles/${cycleNumber}`
      )
      store.setSummary(response.data)
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: normalized.message, color: 'error' })
    } finally {
      store.setCycleLoading(cycleNumber, false)
    }
  }

  async function selectCycle(cycleNumber: number): Promise<void> {
    store.setSelectedCycle(cycleNumber)

    // GATE — a cached cycle re-selects instantly; one in flight is not re-requested.
    if (store.summaries[cycleNumber] || store.isCycleLoading(cycleNumber)) return

    // EXECUTE
    await fetchCycleSummary(cycleNumber)
  }

  /**
   * Page load: fresh state, the overview, then the default cycle (in progress,
   * else the newest listed). An agency that never had a run has no default
   * cycle, so no summary is requested and the page shows its empty state.
   */
  async function loadOwnerIncomePage(): Promise<void> {
    store.reset()
    await fetchOverview()

    const cycleNumber = store.defaultCycle
    if (cycleNumber !== null) {
      await selectCycle(cycleNumber)
    }
  }

  return {
    fetchOverview,
    fetchCycleSummary,
    selectCycle,
    loadOwnerIncomePage,
  }
}
