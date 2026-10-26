/**
 * Data composable for the CP Square tab: last closed week's top 3 + the
 * all-time top 50 (one cp/square response).
 * Fetches on mount, polls every `cpConfig.poll_seconds` (recursive setTimeout;
 * ticks are skipped while the tab is hidden) so a broken pair leaves the page
 * within one poll, and refetches (debounced) when the store's
 * `weekClosedSignal` bumps. Everything is stopped on unmount.
 */

import { useDocumentVisibility, watchDebounced } from '@vueuse/core'
import type { CpEnvelope, CpSquareResponse } from '~/types/cp'
import { useApi } from '~/composables/shared/useApi'
import { CP_BOOTSTRAP_DEFAULTS } from '~/constants/bootstrap'
import { CP_MS_PER_SECOND, CP_SIGNAL_DEBOUNCE_MS } from '~/constants/cp-event'
import { createLogger } from '~/utils/logger'
import { winnerToPairCard } from '~/utils/cp'

const log = createLogger('[CpSquare]')

export function useCpSquare() {
  const { api, normalizeError } = useApi()
  const store = useCpStore()
  const bootstrapStore = useBootstrapStore()
  const visibility = useDocumentVisibility()

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

  // ========================================
  // Polling (recursive setTimeout, paused while hidden)
  // ========================================

  let pollId: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  function pollMs(): number {
    const seconds = bootstrapStore.cpConfig.poll_seconds || CP_BOOTSTRAP_DEFAULTS.poll_seconds
    return seconds * CP_MS_PER_SECOND
  }

  function schedulePoll(): void {
    if (stopped) return
    pollId = setTimeout(async () => {
      if (visibility.value === 'visible') await fetchSquare()
      schedulePoll()
    }, pollMs())
  }

  const stopWatch = watchDebounced(
    () => store.weekClosedSignal,
    () => { void fetchSquare() },
    { debounce: CP_SIGNAL_DEBOUNCE_MS },
  )

  function stop(): void {
    stopped = true
    if (pollId !== null) clearTimeout(pollId)
    pollId = null
    stopWatch()
  }

  onMounted(() => {
    void fetchSquare()
    schedulePoll()
  })
  onUnmounted(stop)

  return {
    weekKey: computed(() => data.value?.week_key ?? null),
    pairs: computed(() => (data.value?.winners ?? []).map(winnerToPairCard)),
    allTime: computed(() => data.value?.all_time ?? []),
    hasLoaded: computed(() => data.value !== null),
    isLoading: readonly(isLoading),
    error: readonly(error),
    isEmpty: computed(() => data.value !== null && data.value.winners.length === 0),
    isAllTimeEmpty: computed(() => data.value !== null && (data.value.all_time ?? []).length === 0),
    refetch: fetchSquare,
  }
}
