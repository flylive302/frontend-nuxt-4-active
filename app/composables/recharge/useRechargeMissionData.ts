/**
 * Data composable for the Recharge Activity mission.
 *
 * GATE→EXECUTE→REACT: fetches from GET /api/v1/missions/recharge/{timeframe}
 * and writes the result into useMissionStore, keyed by timeframe.
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

  async function fetchProgress(timeframe: string): Promise<void> {
    // GATE
    if (store.isLoading) return

    store.setLoading(true)
    store.setError(null)

    try {
      // EXECUTE
      const response = await api<ApiEnvelope>(`/missions/recharge/${timeframe}`)
      store.setProgress(timeframe, response.data)
    } catch (err) {
      // REACT (error surface)
      const normalized = normalizeError(err)
      store.setError(normalized.message)
      log.warn('Failed to fetch mission progress', { timeframe, err })
    } finally {
      store.setLoading(false)
    }
  }

  function fetchDaily(): Promise<void> {
    return fetchProgress('daily')
  }

  return { fetchProgress, fetchDaily }
}
