// ========================================
// Room Gift Leaderboard Composable
// ========================================

import { ref, onUnmounted } from 'vue'
import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  GiftLeaderboardResponse,
} from '~/types/progression/leaderboard'

// ========================================
// Module-Level State
// ========================================

/**
 * Shared active-tab period total for the Room Activity drawer. Module-level
 * (mirrors useRoomGifts's giftQueue pattern) rather than per-instance: the
 * drawer's leaderboard composable seeds it on fetch/refresh, while gift
 * send/receive bumps (useRoomGifts / useRoomEventHandlers) land on it via
 * `bumpPeriodTotalXp` regardless of which composable instance is mounted.
 * Single active room drawer at a time, so one shared value is correct —
 * mirrors the room store's single-`currentRoom` shape.
 */
const periodTotalXp = ref<string>('0')

// ========================================
// Composable
// ========================================

/**
 * Composable for fetching and managing room gift leaderboard data.
 * Supports period filtering and request cancellation.
 *
 * @param roomId - The room ID to fetch leaderboard for
 * @returns Reactive state and actions for leaderboard management
 */
export function useRoomGiftLeaderboard(roomId: number | (() => number)) {
  const { api, normalizeError } = useApi()

  // ========================================
  // State
  // ========================================

  const entries = ref<LeaderboardEntry[]>([])
  const period = ref<LeaderboardPeriod>('all_time')
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref<string | null>(null)
  const hasFetched = ref(false)

  // AbortController for request cancellation
  let abortController: AbortController | null = null
  // Monotonic counter — ensures only the last-issued fetch updates state
  let currentRequestId = 0

  // ========================================
  // Helpers
  // ========================================

  /**
   * Get the current room ID (supports reactive getter).
   */
  const getRoomId = () => (typeof roomId === 'function' ? roomId() : roomId)

  // ========================================
  // Actions
  // ========================================

  /**
   * Fetch leaderboard entries from API.
   * @param reset - If true, clears existing entries before fetching
   */
  async function fetch(reset = false): Promise<void> {
    const currentRoomId = getRoomId()
    if (!currentRoomId) {
      error.value = 'No room ID provided'
      return
    }

    // Cancel any in-flight request and claim this slot
    if (abortController) {
      abortController.abort()
    }
    abortController = new AbortController()
    const requestId = ++currentRequestId

    // Reset state if requested
    if (reset) {
      entries.value = []
      error.value = null
    }

    loading.value = true

    try {
      const params: Record<string, string> = {
        period: period.value,
      }

      const response = await api<GiftLeaderboardResponse>(
        `/rooms/${currentRoomId}/gift-leaderboard`,
        {
          method: 'GET',
          params,
          signal: abortController.signal,
        }
      )

      // A newer fetch was started while we were in flight — discard this result
      if (requestId !== currentRequestId) return

      entries.value = response.data.leaderboard
      periodTotalXp.value = response.data.period_total_xp
      error.value = null
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      if (requestId !== currentRequestId) return

      const normalized = normalizeError(err)
      error.value = normalized.message
    } finally {
      if (requestId === currentRequestId) {
        loading.value = false
        refreshing.value = false
        hasFetched.value = true
      }
    }
  }

  /**
   * Refresh leaderboard (clear and refetch).
   * Sets refreshing state for UI feedback.
   */
  async function refresh(): Promise<void> {
    refreshing.value = true
    await fetch(true)
  }

  /**
   * Set the time period filter and refetch.
   * @param newPeriod - The new period to filter by
   */
  async function setPeriod(newPeriod: LeaderboardPeriod): Promise<void> {
    if (period.value === newPeriod) return
    period.value = newPeriod
    await fetch(true)
  }

  /**
   * Reset state completely.
   */
  function reset(): void {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    entries.value = []
    period.value = 'all_time'
    loading.value = false
    refreshing.value = false
    error.value = null
    hasFetched.value = false
    periodTotalXp.value = '0'
  }

  // ========================================
  // Lifecycle
  // ========================================

  onUnmounted(() => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  })

  // ========================================
  // Return
  // ========================================

  return {
    // State
    entries,
    period,
    loading,
    refreshing,
    error,
    hasFetched,
    periodTotalXp,

    // Actions
    fetch,
    refresh,
    setPeriod,
    reset,
  }
}

/**
 * Optimistic bump of the drawer's period-total XP, mirroring
 * `roomStore.bumpDailyXp`. Called by useRoomGifts.sendGift and
 * useRoomEventHandlers's gift:received handler alongside the daily-XP bump —
 * a gift landing now counts toward every period (daily ⊂ weekly ⊂ monthly ⊂
 * all-time), so this applies unconditionally, with no tab check.
 */
export function bumpPeriodTotalXp(amount: number): void {
  const currentTotal = parseFloat(periodTotalXp.value || '0')
  periodTotalXp.value = (currentTotal + amount).toString()
}
