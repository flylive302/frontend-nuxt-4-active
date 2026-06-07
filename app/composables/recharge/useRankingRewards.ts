import type { RankingRewardsData } from '~/types/mission/recharge'
import { useApi } from '~/composables/shared/useApi'
import { createLogger } from '~/utils/logger'

const log = createLogger('[RankingRewards]')

interface ApiEnvelope {
  data: RankingRewardsData
}

export function useRankingRewards() {
  const { api, normalizeError } = useApi()

  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const data = ref<RankingRewardsData | null>(null)

  async function fetch(): Promise<void> {
    if (isLoading.value) return
    isLoading.value = true
    error.value = null
    try {
      const response = await api<ApiEnvelope>('/missions/recharge/ranking-rewards')
      data.value = response.data
    } catch (err) {
      const normalized = normalizeError(err)
      error.value = normalized.message
      log.warn('Failed to fetch ranking rewards', err)
    } finally {
      isLoading.value = false
    }
  }

  return {
    data: readonly(data),
    isLoading: readonly(isLoading),
    error: readonly(error),
    fetch,
  }
}
