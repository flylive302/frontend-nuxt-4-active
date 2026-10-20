/**
 * Data composable for the CP layout hero (ferris wheel + countdown).
 * - cp/history → last ≤6 rank-1 winners; refetched on `weekClosedSignal`.
 * - If the store has no week yet (deep link to square/reward), fetches cp/me
 *   once and fills the week so the countdown works on every tab.
 */

import { watchDebounced } from '@vueuse/core'
import type { CpEnvelope, CpHistoryResponse, CpMeResponse } from '~/types/cp'
import { useApi } from '~/composables/shared/useApi'
import { CP_SIGNAL_DEBOUNCE_MS } from '~/constants/cp-event'
import { createLogger } from '~/utils/logger'

const log = createLogger('[CpHero]')

export function useCpHero() {
  const { api } = useApi()
  const store = useCpStore()

  const history = ref<CpHistoryResponse['winners']>([])

  async function fetchHistory(): Promise<void> {
    try {
      const response = await api<CpEnvelope<CpHistoryResponse>>('/cp/history')
      history.value = response.data.winners
    } catch (err) {
      log.warn('Failed to fetch cp/history', err)
    }
  }

  async function ensureWeek(): Promise<void> {
    if (store.week) return
    try {
      const response = await api<CpEnvelope<CpMeResponse>>('/cp/me')
      // The index page may have filled it while we waited.
      if (!store.week) store.setWeek(response.data.week)
    } catch (err) {
      log.warn('Failed to fetch cp/me for the week clock', err)
    }
  }

  const stopWatch = watchDebounced(
    () => store.weekClosedSignal,
    () => { void fetchHistory() },
    { debounce: CP_SIGNAL_DEBOUNCE_MS },
  )

  onMounted(() => {
    fetchHistory()
    ensureWeek()
  })
  onUnmounted(stopWatch)

  return { winners: readonly(history) }
}
