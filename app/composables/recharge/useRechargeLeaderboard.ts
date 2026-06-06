/**
 * Composable for the mission leaderboard (weekly | monthly).
 *
 * Fetches once on mount, then polls every `ranking_poll_seconds`.
 * Polling is paused when the browser tab is hidden (Page Visibility API).
 * Tab-switch pausing is handled implicitly: this composable lives inside
 * MissionRankingTab.vue, which is unmounted when the Task tab is active
 * (UTabs unmountOnHide: true), so onUnmounted stops the interval naturally.
 */

import { useDocumentVisibility } from '@vueuse/core'
import type { LeaderboardResponse } from '~/types/mission/recharge'
import { useApi } from '~/composables/shared/useApi'
import { createLogger } from '~/utils/logger'

const log = createLogger('[RechargeLeaderboard]')

interface ApiEnvelope {
  data: LeaderboardResponse
}

export function useRechargeLeaderboard(timeframe: 'weekly' | 'monthly') {
  const { api, normalizeError } = useApi()
  const store = useMissionStore()
  const visibility = useDocumentVisibility()

  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const leaderboard = computed(() => store.leaderboardFor(timeframe))

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

  // ========================================
  // Polling
  // ========================================

  let intervalId: ReturnType<typeof setInterval> | null = null

  function startPolling(): void {
    if (intervalId !== null) return
    const pollMs = (store.progressFor(timeframe)?.config?.ranking_poll_seconds ?? 30) * 1000
    intervalId = setInterval(() => {
      if (visibility.value === 'visible') {
        fetch().catch((err: unknown) => log.warn('Poll failed', err))
      }
    }, pollMs)
  }

  function stopPolling(): void {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  onMounted(() => {
    fetch()
    startPolling()
  })

  onUnmounted(stopPolling)

  return {
    leaderboard,
    isLoading: readonly(isLoading),
    error: readonly(error),
    refresh: fetch,
  }
}
