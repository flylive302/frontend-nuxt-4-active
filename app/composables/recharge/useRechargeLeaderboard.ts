/**
 * Composable for the mission leaderboard (weekly | monthly).
 *
 * Fetches once on mount, then polls every `ranking_poll_seconds`.
 * Inside `finale_warning_seconds` of the reset, switches to the faster
 * `finale_poll_seconds` rate. On `mission.finale.ready`, fetches the
 * finalized honor-wall snapshot once and stops all polling.
 *
 * Polling pauses when the browser tab is hidden (Page Visibility API).
 * Tab-switch pausing is handled implicitly: this composable lives inside
 * MissionRankingTab.vue, unmounted when the Task tab is active
 * (UTabs unmountOnHide: true), so onUnmounted cleans up naturally.
 */

import { useDocumentVisibility } from '@vueuse/core'
import type { HonorWallData, LeaderboardResponse } from '~/types/mission/recharge'
import { useApi } from '~/composables/shared/useApi'
import { createLogger } from '~/utils/logger'

const log = createLogger('[RechargeLeaderboard]')

interface ApiEnvelope {
  data: LeaderboardResponse
}

interface HonorWallEnvelope {
  data: HonorWallData
}

interface FinaleReadyPayload {
  timeframe: string
  instance_key: string
}

export function useRechargeLeaderboard(timeframe: 'weekly' | 'monthly') {
  const { api, normalizeError } = useApi()
  const store = useMissionStore()
  const { $echo } = useNuxtApp()
  const authStore = useAuthStore()
  const visibility = useDocumentVisibility()

  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const leaderboard = computed(() => store.leaderboardFor(timeframe))
  const isFinalized = computed(() => store.isFinaleReadyFor(timeframe))

  // ========================================
  // Fetch
  // ========================================

  async function fetch(): Promise<void> {
    if (isLoading.value) return
    isLoading.value = true
    error.value = null
    try {
      const response = await api<ApiEnvelope>(`/missions/recharge/${timeframe}/leaderboard`)
      store.setLeaderboard(timeframe, response.data)
    } catch (err) {
      const normalized = normalizeError(err)
      error.value = normalized.message
      log.warn('Failed to fetch leaderboard', { timeframe, err })
    } finally {
      isLoading.value = false
    }
  }

  async function fetchFinaleSnapshot(): Promise<void> {
    try {
      const response = await api<HonorWallEnvelope>('/missions/recharge/honor-wall')
      const section = timeframe === 'weekly' ? response.data.weekly : response.data.monthly
      store.setFinaleReady(timeframe, section)
    } catch (err) {
      log.warn('Failed to fetch finale snapshot', { timeframe, err })
    }
  }

  // ========================================
  // Adaptive polling (recursive setTimeout)
  // ========================================

  function getPollMs(): number {
    const config = store.progressFor(timeframe)?.config
    if (!config) return 30_000

    const lb = store.leaderboardFor(timeframe)
    if (lb?.resets_at && config.finale_warning_seconds) {
      const msUntilReset = new Date(lb.resets_at).getTime() - Date.now()
      if (msUntilReset > 0 && msUntilReset < config.finale_warning_seconds * 1000) {
        return (config.finale_poll_seconds ?? 3) * 1000
      }
    }

    return (config.ranking_poll_seconds ?? 30) * 1000
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null

  function scheduleNextPoll(): void {
    if (store.isFinaleReadyFor(timeframe)) return
    const delay = getPollMs()
    timeoutId = setTimeout(async () => {
      if (!store.isFinaleReadyFor(timeframe) && visibility.value === 'visible') {
        await fetch().catch((err: unknown) => log.warn('Poll failed', err))
      }
      scheduleNextPoll()
    }, delay)
  }

  function stopPolling(): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  // ========================================
  // Finale echo subscription
  // ========================================

  function subscribeToFinale(): void {
    const userId = authStore.user?.id
    if (!userId) return

    $echo.private(`user.${userId}`).listen('.mission.finale.ready', (payload: FinaleReadyPayload) => {
      if (payload.timeframe !== timeframe) return
      stopPolling()
      fetchFinaleSnapshot().catch((err: unknown) => log.warn('Finale snapshot fetch failed', err))
    })
  }

  function unsubscribeFinale(): void {
    const userId = authStore.user?.id
    if (!userId) return
    $echo.private(`user.${userId}`).stopListening('.mission.finale.ready')
  }

  // ========================================
  // Lifecycle
  // ========================================

  onMounted(() => {
    fetch()
    scheduleNextPoll()
    subscribeToFinale()
  })

  onUnmounted(() => {
    stopPolling()
    unsubscribeFinale()
  })

  return {
    leaderboard,
    isLoading: readonly(isLoading),
    error: readonly(error),
    isFinalized,
    refresh: fetch,
  }
}
