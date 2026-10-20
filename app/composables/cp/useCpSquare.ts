/**
 * Data composable for the CP Square tab: last closed week's top 3.
 * Fetches cp/square on mount and refetches (debounced) when the store's
 * `weekClosedSignal` bumps.
 */

import { watchDebounced } from '@vueuse/core'
import type { CpEnvelope, CpSquareResponse } from '~/types/cp'
import { useApi } from '~/composables/shared/useApi'
import { CP_SIGNAL_DEBOUNCE_MS } from '~/constants/cp-event'
import { createLogger } from '~/utils/logger'
import { winnerToPairCard } from '~/utils/cp'

const log = createLogger('[CpSquare]')

export function useCpSquare() {
  const { api, normalizeError } = useApi()
  const store = useCpStore()

  const data = ref<CpSquareResponse | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // EXECUTE
  async function fetchSquare(): Promise<void> {
    isLoading.value = true
    try {
      const response = await api<CpEnvelope<CpSquareResponse>>('/cp/square')
      data.value = response.data
      error.value = null
    } catch (err) {
      error.value = normalizeError(err).message
      log.warn('Failed to fetch cp/square', err)
    } finally {
      isLoading.value = false
    }
  }

  const stopWatch = watchDebounced(
    () => store.weekClosedSignal,
    () => { void fetchSquare() },
    { debounce: CP_SIGNAL_DEBOUNCE_MS },
  )

  onMounted(fetchSquare)
  onUnmounted(stopWatch)

  return {
    weekKey: computed(() => data.value?.week_key ?? null),
    pairs: computed(() => (data.value?.winners ?? []).map(winnerToPairCard)),
    isLoading: readonly(isLoading),
    error: readonly(error),
    isEmpty: computed(() => data.value !== null && data.value.winners.length === 0),
    refetch: fetchSquare,
  }
}
