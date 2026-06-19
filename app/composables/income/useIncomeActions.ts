// ========================================
// Income — GATE / EXECUTE / REACT
// ========================================

import { createLogger } from '~/utils/logger'
import type {
  AgencyRun,
  ClaimResult,
  IncomeStats,
  RunOption,
  RunSnapshot,
} from '~/types/income/income'

const log = createLogger('[useIncomeActions]')

export function useIncomeActions() {
  const store = useIncomeStore()
  const toast = useToast()
  const { api, normalizeError } = useApi()

  async function fetchStats(): Promise<void> {
    store.setStatsLoading(true)
    store.setError(null)

    try {
      const response = await api<{ success: true; data: IncomeStats }>('/user/income')
      store.setStats(response.data)
    } catch (err) {
      const normalized = normalizeError(err)
      store.setError(normalized.message)
    } finally {
      store.setStatsLoading(false)
    }
  }

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
  }

  async function fetchHistory(): Promise<void> {
    store.setHistoryLoading(true)

    try {
      const response = await api<{ success: true; data: RunOption[] }>(
        '/user/income/targets/history'
      )
      store.setRunOptions(response.data)
    } catch (err) {
      log.warn('Failed to fetch run history', err)
      store.setRunOptions([])
    } finally {
      store.setHistoryLoading(false)
    }
  }

  async function fetchSnapshot(runId: number): Promise<void> {
    store.setSnapshotLoading(true)
    store.setSelectedSnapshot(null)

    try {
      const response = await api<{ success: true; data: RunSnapshot }>(
        `/user/income/targets/${runId}`
      )
      store.setSelectedSnapshot(response.data)
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: normalized.message, color: 'error' })
    } finally {
      store.setSnapshotLoading(false)
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
      store.markSnapshotClaimed(runId)

      if (claimed_count > 0) {
        toast.add({ title: `Claimed ${diamonds_claimed} 💎`, color: 'success' })
        await fetchStats()
      } else {
        toast.add({ title: 'Nothing left to claim', color: 'neutral' })
      }
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: normalized.message, color: 'error' })
    } finally {
      store.setClaiming(false)
    }
  }

  async function fetchAll(): Promise<void> {
    await Promise.all([fetchStats(), fetchActiveRun()])
    store.setLastFetchedAt(Date.now())
  }

  return {
    fetchStats,
    fetchActiveRun,
    fetchHistory,
    fetchSnapshot,
    claim,
    fetchAll,
  }
}
