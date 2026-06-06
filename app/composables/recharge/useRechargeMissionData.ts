/**
 * Data composable for the Recharge Activity mission.
 *
 * GATE→EXECUTE→REACT: fetches from GET /api/v1/missions/recharge/{timeframe}
 * and writes the result into useMissionStore.
 *
 * Re-derived from the ledger on every call — no stale-while-revalidate,
 * so progress is always authoritative.
 */

import type { MissionProgressResponse } from '~/types/mission/recharge'
import { useApi } from '~/composables/shared/useApi'
import { useMissionStore } from '~/stores/mission'
import { createLogger } from '~/utils/logger'

const log = createLogger('[RechargeMissionData]')

interface ApiEnvelope {
  data: MissionProgressResponse
}

export function useRechargeMissionData() {
  const { api, normalizeError } = useApi()
  const store = useMissionStore()

  // ========================================
  // EXECUTE
  // ========================================

  /**
   * Fetch daily progress for the current user and write it to the store.
   * Safe to call repeatedly — always fetches fresh data.
   */
  async function fetchDaily(): Promise<void> {
    // GATE
    if (store.isLoading) return

    store.setLoading(true)
    store.setError(null)

    try {
      // EXECUTE
      const response = await api<ApiEnvelope>('/missions/recharge/daily')
      store.setDailyProgress(response.data)
    } catch (err) {
      // REACT (error surface)
      const normalized = normalizeError(err)
      store.setError(normalized.message)
      log.warn('Failed to fetch daily mission progress', err)
    } finally {
      store.setLoading(false)
    }
  }

  return { fetchDaily }
}
