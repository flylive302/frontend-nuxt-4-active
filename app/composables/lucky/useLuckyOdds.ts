// ========================================
// Lucky Odds Composable
// ========================================
// Role: Data/Query — fetch the Lucky Draw prize-odds tiers.
//       Action/Orchestrator — manage ack persistence per user.
// Components call fetchOdds(); they never touch useApi directly.

import { LUCKY_DRAW_STORAGE_PREFIX } from '~/constants/lucky'
import { createLogger } from '~/utils/logger'

export interface OddsTier {
  name: string
  multiplier: number
  probability: number
}

export function useLuckyOdds() {
  const log = createLogger('[LuckyOdds]')

  /** Fetch the prize-odds tiers. Returns [] on failure (non-blocking). */
  async function fetchOdds(): Promise<OddsTier[]> {
    // Defer useApi to avoid instantiation side effects in tests
    const { api } = useApi()
    try {
      const response = await api<{ data: { tiers: OddsTier[] } }>('/lucky-draws/odds')
      return response.data?.tiers ?? []
    } catch (err) {
      log.warn('Failed to fetch lucky draw odds', err)
      return []
    }
  }

  /**
   * Check if the user has acknowledged the lucky odds modal.
   * Persisted once-per-user-ever (keyed by user ID), across sessions/restarts.
   */
  function hasAcknowledged(userId: number): boolean {
    if (typeof localStorage === 'undefined') return false
    const key = `${LUCKY_DRAW_STORAGE_PREFIX}${userId}`
    return localStorage.getItem(key) === '1'
  }

  /**
   * Mark that the user has acknowledged the lucky odds modal.
   * Persisted once-per-user-ever (keyed by user ID), across sessions/restarts.
   */
  function markAcknowledged(userId: number): void {
    if (typeof localStorage === 'undefined') return
    const key = `${LUCKY_DRAW_STORAGE_PREFIX}${userId}`
    localStorage.setItem(key, '1')
  }

  return { fetchOdds, hasAcknowledged, markAcknowledged }
}
