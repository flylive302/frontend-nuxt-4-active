import type { CpEnvelope, CpRewardsResponse } from '~/types/cp'
import { useApi } from '~/composables/shared/useApi'
import { createLogger } from '~/utils/logger'

const log = createLogger('[CpRewards]')

export function useCpRewards() {
  const { api, normalizeError } = useApi()

  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const data = ref<CpRewardsResponse | null>(null)

  async function fetchRewards(): Promise<void> {
    if (isLoading.value) return
    isLoading.value = true
    error.value = null
    try {
      const response = await api<CpEnvelope<CpRewardsResponse>>('/cp/rewards')
      data.value = response.data
    } catch (err) {
      const normalized = normalizeError(err)
      error.value = normalized.message
      log.warn('Failed to fetch CP rewards', err)
    } finally {
      isLoading.value = false
    }
  }

  return {
    data: readonly(data),
    isLoading: readonly(isLoading),
    error: readonly(error),
    fetchRewards,
  }
}
