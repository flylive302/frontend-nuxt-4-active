/**
 * Data composable for the CP Event page (leaderboard + viewer's pair + week clock).
 *
 * - Fetches cp/list + cp/me on mount, then polls every `cpConfig.poll_seconds`
 *   (recursive setTimeout; ticks are skipped while the tab is hidden).
 * - `loadMore()` pages ranks 4+ via cp/list/page, honouring the offset cap.
 * - The store's realtime signal counters (cp.events) trigger one debounced
 *   refetch (a combo of N gifts = one refetch).
 * - When the week countdown hits zero it refetches with jittered retries until
 *   `week_key` changes (covers a lost `cp.week.closed`, avoids a herd).
 *
 * Everything is stopped on unmount.
 */

import { useDocumentVisibility, watchDebounced } from '@vueuse/core'
import type { CpEnvelope, CpListPageResponse, CpListResponse, CpMeResponse } from '~/types/cp'
import { useApi } from '~/composables/shared/useApi'
import { CP_BOOTSTRAP_DEFAULTS } from '~/constants/bootstrap'
import {
  CP_LIST_MAX_OFFSET,
  CP_MS_PER_SECOND,
  CP_SIGNAL_DEBOUNCE_MS,
  CP_WEEK_ROLL_MAX_TRIES,
  CP_WEEK_ROLL_RETRY_MAX_MS,
  CP_WEEK_ROLL_RETRY_MIN_MS,
} from '~/constants/cp-event'
import { createLogger } from '~/utils/logger'

const log = createLogger('[CpEventData]')

export function useCpEventData() {
  const { api, normalizeError } = useApi()
  const store = useCpStore()
  const bootstrapStore = useBootstrapStore()
  const visibility = useDocumentVisibility()

  const isLoading = ref(false)
  const isLoadingMore = ref(false)
  /** Initial / refetch failure of page 1 (drives the full retry UI). */
  const error = ref<string | null>(null)
  /** Failure of page 2+ — kept apart so it never replaces the list with the page-1 error UI. */
  const loadMoreError = ref<string | null>(null)

  const hasMorePages = computed(() =>
    store.nextOffset !== null && store.nextOffset <= CP_LIST_MAX_OFFSET,
  )
  // Infinite scroll pauses after a failure; the inline retry calls loadMore() directly.
  const canLoadMore = computed(() => hasMorePages.value && loadMoreError.value === null)

  // ========================================
  // EXECUTE — fetches
  // ========================================

  let inflight: Promise<void> | null = null
  let trailing: Promise<void> | null = null

  async function runFetch(): Promise<void> {
    isLoading.value = true
    try {
      const [list, me] = await Promise.allSettled([
        api<CpEnvelope<CpListResponse>>('/cp/list'),
        api<CpEnvelope<CpMeResponse>>('/cp/me'),
      ])
      if (list.status === 'fulfilled') {
        const { top, page, next_offset, week } = list.value.data
        if (store.hasLoaded) store.mergeHead(top, page, next_offset, week)
        else store.setList(top, page, next_offset, week)
        error.value = null
      } else {
        error.value = normalizeError(list.reason).message
        log.warn('Failed to fetch cp/list', list.reason)
      }
      if (me.status === 'fulfilled') {
        store.setMyPair(me.value.data.pair)
      } else {
        log.warn('Failed to fetch cp/me', me.reason)
      }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetches page 1 + podium + week, and the viewer's pair, in parallel.
   * A request made while one is in flight never reuses it (it may predate the
   * server-side change): N requests during a flight coalesce into exactly one
   * trailing fetch that starts after the in-flight one settles.
   */
  function fetchAll(): Promise<void> {
    if (!inflight) {
      const run = runFetch().finally(() => { if (inflight === run) inflight = null })
      inflight = run
      return run
    }
    if (trailing) return trailing
    const next = inflight
      .catch(() => {})
      .then(() => {
        trailing = null
        return fetchAll()
      })
    trailing = next
    return next
  }

  async function loadMore(): Promise<void> {
    // GATE
    if (isLoadingMore.value || !hasMorePages.value) return
    const offset = store.nextOffset as number
    isLoadingMore.value = true
    loadMoreError.value = null
    try {
      const response = await api<CpEnvelope<CpListPageResponse>>('/cp/list/page', { query: { offset } })
      store.appendRows(response.data.page, response.data.next_offset)
    } catch (err) {
      loadMoreError.value = normalizeError(err).message
      log.warn('Failed to fetch cp/list/page', { offset, err })
    } finally {
      isLoadingMore.value = false
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
      if (visibility.value === 'visible') {
        await fetchAll().catch((err: unknown) => log.warn('Poll failed', err))
      }
      schedulePoll()
    }, pollMs())
  }

  // ========================================
  // Week roll (countdown zero → jittered refetch until week_key changes)
  // ========================================

  let rollTimerId: ReturnType<typeof setTimeout> | null = null
  let retryId: ReturnType<typeof setTimeout> | null = null
  let isRetrying = false
  let armedClosesAt: string | null = null

  function clearRollTimers(): void {
    if (rollTimerId !== null) clearTimeout(rollTimerId)
    if (retryId !== null) clearTimeout(retryId)
    rollTimerId = null
    retryId = null
    isRetrying = false
  }

  function jitterMs(): number {
    return CP_WEEK_ROLL_RETRY_MIN_MS
      + Math.random() * (CP_WEEK_ROLL_RETRY_MAX_MS - CP_WEEK_ROLL_RETRY_MIN_MS)
  }

  function retryUntilWeekChanges(staleKey: string, triesLeft: number): void {
    if (stopped || triesLeft <= 0) return
    retryId = setTimeout(async () => {
      retryId = null
      await fetchAll().catch((err: unknown) => log.warn('Week-roll refetch failed', err))
      // Week changed → the week watcher re-armed (and cleared this loop) already.
      if (isRetrying && store.weekKey === staleKey) retryUntilWeekChanges(staleKey, triesLeft - 1)
    }, jitterMs())
  }

  function armWeekRoll(): void {
    const week = store.week
    if (!week || stopped) return
    // Mid-retry responses for the same (stale) week must not restart the loop.
    if (isRetrying && week.closes_at === armedClosesAt) return
    clearRollTimers()
    armedClosesAt = week.closes_at
    // Server-time skew captured per response, like useMissionCountdown.
    const skewMs = Date.now() - new Date(week.server_time).getTime()
    const msLeft = new Date(week.closes_at).getTime() - (Date.now() - skewMs)
    const staleKey = week.week_key
    rollTimerId = setTimeout(() => {
      rollTimerId = null
      isRetrying = true
      retryUntilWeekChanges(staleKey, CP_WEEK_ROLL_MAX_TRIES)
    }, Math.max(0, msLeft))
  }

  const stopWeekWatch = watch(
    () => store.week,
    () => armWeekRoll(),
  )

  // Realtime hints (cp.events → store counters): any pair change or week close
  // = one debounced refetch. A refetched week_key re-arms the roll via the watcher above.
  const stopSignalWatch = watchDebounced(
    () => [store.pairSignal, store.weekClosedSignal],
    () => {
      if (stopped) return
      fetchAll().catch((err: unknown) => log.warn('Refresh failed', err))
    },
    { debounce: CP_SIGNAL_DEBOUNCE_MS },
  )

  // ========================================
  // Lifecycle
  // ========================================

  function stop(): void {
    stopped = true
    if (pollId !== null) clearTimeout(pollId)
    pollId = null
    clearRollTimers()
    stopWeekWatch()
    stopSignalWatch()
  }

  onMounted(() => {
    fetchAll().catch((err: unknown) => log.warn('Initial fetch failed', err))
    schedulePoll()
  })

  onUnmounted(stop)

  return {
    podium: computed(() => store.podium),
    rows: computed(() => store.rows),
    myPair: computed(() => store.myPair),
    isLoading: readonly(isLoading),
    isLoadingMore: readonly(isLoadingMore),
    error: readonly(error),
    loadMoreError: readonly(loadMoreError),
    canLoadMore,
    isEmpty: computed(() => store.isEmpty),
    loadMore,
    refetch: fetchAll,
  }
}
