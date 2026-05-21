// ========================================
// Lucky Odds Composable
// ========================================
// Role: Data/Query — fetch the Lucky Draw prize-odds tiers.
// Components call fetchOdds(); they never touch useApi directly.

import { createLogger } from '~/utils/logger'

export interface OddsTier {
  name: string
  multiplier: number
  probability: number
}

export function useLuckyOdds() {
  const { api } = useApi()
  const log = createLogger('[LuckyOdds]')

  /** Fetch the prize-odds tiers. Returns [] on failure (non-blocking). */
  async function fetchOdds(): Promise<OddsTier[]> {
    try {
      const response = await api<{ data: { tiers: OddsTier[] } }>('/lucky-draws/odds')
      return response.data?.tiers ?? []
    } catch (err) {
      log.error('Failed to fetch lucky odds:', err)
      return []
    }
  }

  return { fetchOdds }
}
