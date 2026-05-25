// ========================================
// Income — GATE / EXECUTE / REACT
// ========================================

import { createLogger } from '~/utils/logger'
import type {
  IncomeSummary,
  IncomeTarget,
  IncomeTargetHistory,
  GetIncomeHistoryParams,
} from '~/types/income/income'

const log = createLogger('[useIncomeActions]')

export function useIncomeActions() {
  const store = useIncomeStore()
  const { api, normalizeError } = useApi()

  async function fetchStats(): Promise<void> {
    store.setStatsLoading(true)
    store.setError(null)

    try {
      const response = await api<{ success: true; data: IncomeSummary }>('/user/income')
      store.setSummary(response.data)
    } catch (err) {
      const normalized = normalizeError(err)
      store.setError(normalized.message)
    } finally {
      store.setStatsLoading(false)
    }
  }

  async function fetchActiveTarget(): Promise<void> {
    store.setTargetLoading(true)

    try {
      const response = await api<{ success: true; data: IncomeTarget | null }>(
        '/user/income/targets/active'
      )
      store.setActiveTarget(response.data)
    } catch (err) {
      store.setActiveTarget(null)
    } finally {
      store.setTargetLoading(false)
    }
  }

  async function fetchHistory(params: GetIncomeHistoryParams = {}, reset = false): Promise<void> {
    if (reset) store.resetHistoryPagination()

    if (!store.history.hasMore || store.history.loading) return

    store.setHistoryLoading(true)
    store.setHistoryError(null)

    try {
      const queryParams: Record<string, unknown> = {
        per_page: params.per_page ?? 20,
      }
      if (store.history.cursor) queryParams.cursor = store.history.cursor

      const response = await api<{
        success: true
        data: {
          targets: IncomeTargetHistory[]
          pagination: { has_more: boolean; next_cursor?: string }
        }
      }>('/user/income/targets/history', { params: queryParams })

      store.appendHistoryPage(response.data.targets, response.data.pagination)
    } catch (err) {
      const normalized = normalizeError(err)
      store.setHistoryError(normalized.message)
    } finally {
      store.setHistoryLoading(false)
    }
  }

  async function fetchAll(): Promise<void> {
    await Promise.all([fetchStats(), fetchActiveTarget()])
    store.setLastFetchedAt(Date.now())
  }

  return {
    fetchStats,
    fetchActiveTarget,
    fetchHistory,
    fetchAll,
  }
}
