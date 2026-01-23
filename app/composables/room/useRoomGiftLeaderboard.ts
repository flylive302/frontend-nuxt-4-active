// ========================================
// Room Gift Leaderboard Composable
// ========================================

import { ref, computed, onUnmounted } from 'vue'
import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  GiftLeaderboardResponse,
} from '~/types/leaderboard'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useRoomGiftLeaderboard]')

// ========================================
// Constants
// ========================================

const PER_PAGE = 20

// ========================================
// Composable
// ========================================

/**
 * Composable for fetching and managing room gift leaderboard data.
 * Supports cursor pagination, period filtering, and request cancellation.
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
  const period = ref<LeaderboardPeriod>('daily')
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref<string | null>(null)
  const cursor = ref<string | null>(null)
  const hasMore = ref(true)
  const hasFetched = ref(false)

  // AbortController for request cancellation
  let abortController: AbortController | null = null

  // ========================================
  // Computed
  // ========================================

  /**
   * Whether more entries can be loaded.
   */
  const canLoadMore = computed(() => hasMore.value && !loading.value)

  /**
   * Get the current room ID (supports reactive getter).
   */
  const getRoomId = () => (typeof roomId === 'function' ? roomId() : roomId)

  // ========================================
  // Actions
  // ========================================

  /**
   * Fetch leaderboard entries from API.
   * @param reset - If true, clears existing entries and resets pagination
   */
  async function fetch(reset = false): Promise<void> {
    // Guard: Prevent duplicate requests
    if (loading.value) return

    const currentRoomId = getRoomId()
    if (!currentRoomId) {
      error.value = 'No room ID provided'
      return
    }

    // Cancel any pending request
    if (abortController) {
      abortController.abort()
    }
    abortController = new AbortController()

    // Reset state if requested
    if (reset) {
      entries.value = []
      cursor.value = null
      hasMore.value = true
      error.value = null
    }

    // Guard: No more data to fetch
    if (!hasMore.value && !reset) return

    loading.value = true
    log.debug('Fetching leaderboard', { roomId: currentRoomId, period: period.value, reset })

    try {
      // Build query params
      const params: Record<string, string> = {
        period: period.value,
        per_page: String(PER_PAGE),
      }
      if (cursor.value && !reset) {
        params.cursor = cursor.value
      }

      const response = await api<GiftLeaderboardResponse>(
        `/rooms/${currentRoomId}/gift-leaderboard`,
        {
          method: 'GET',
          params,
          signal: abortController.signal,
        }
      )

      log.debug('Leaderboard response', { count: response.data.length, hasNext: !!response.meta.pagination.next_cursor })

      // Append or replace entries
      if (reset) {
        entries.value = response.data
      } else {
        entries.value.push(...response.data)
      }

      // Update pagination state
      cursor.value = response.meta.pagination.next_cursor
      hasMore.value = response.meta.pagination.next_cursor !== null
      error.value = null
    } catch (err) {
      // Ignore aborted requests
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }

      const normalized = normalizeError(err)
      error.value = normalized.message
      log.error('Fetch failed:', normalized.message, err)
    } finally {
      loading.value = false
      refreshing.value = false
      hasFetched.value = true  // Always mark as fetched so UI shows empty/error state
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
   * Load more entries (next page).
   */
  async function loadMore(): Promise<void> {
    if (!canLoadMore.value) return
    await fetch(false)
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
    period.value = 'daily'
    loading.value = false
    refreshing.value = false
    error.value = null
    cursor.value = null
    hasMore.value = true
    hasFetched.value = false
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
    hasMore,
    hasFetched,

    // Computed
    canLoadMore,

    // Actions
    fetch,
    refresh,
    setPeriod,
    loadMore,
    reset,
  }
}
