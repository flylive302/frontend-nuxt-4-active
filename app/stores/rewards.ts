// ========================================
// Rewards Store
// ========================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createLogger } from '~/utils/logger'
import type {
  UserReward,
  RewardStats,
  GetRewardsParams,
  RewardPagination,
} from '~/types/reward'

// ========================================
// Types
// ========================================

interface RewardListState {
  items: UserReward[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}

// ========================================
// Store Definition
// ========================================

export const useRewardsStore = defineStore('rewards', () => {
  const log = createLogger('[RewardsStore]')
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // State
  // ========================================

  const pending = ref<RewardListState>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  const history = ref<RewardListState>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  const stats = ref<RewardStats | null>(null)
  const statsLoading = ref(false)
  const claimingId = ref<number | null>(null)

  /** Timestamp of last successful data fetch */
  const lastFetchedAt = ref<number | null>(null)

  // ========================================
  // Constants
  // ========================================

  /** Data is considered stale after 5 minutes */
  const STALE_TIME = 5 * 60 * 1000

  // ========================================
  // Computed
  // ========================================

  /**
   * Count of pending rewards.
   */
  const pendingCount = computed(() => stats.value?.total_pending ?? 0)

  /**
   * Total pending diamonds.
   */
  const totalPendingDiamonds = computed(() => stats.value?.pending_diamonds ?? 0)

  /**
   * Total pending coins.
   */
  const totalPendingCoins = computed(() => stats.value?.pending_coins ?? 0)

  /**
   * Check if any reward is being claimed.
   */
  const isClaiming = computed(() => claimingId.value !== null)

  /**
   * Check if there are any claimable rewards.
   */
  const hasClaimableRewards = computed(() => pending.value.items.length > 0)

  /**
   * Whether cached data needs refreshing.
   */
  const needsRefresh = computed<boolean>(() => {
    if (!lastFetchedAt.value) return true
    return Date.now() - lastFetchedAt.value > STALE_TIME
  })

  // ========================================
  // Actions
  // ========================================

  /**
   * Fetch pending rewards.
   */
  async function fetchPending(params: GetRewardsParams = {}, reset = false): Promise<void> {
    if (reset) {
      pending.value.items = []
      pending.value.cursor = null
      pending.value.hasMore = true
    }

    if (!pending.value.hasMore || pending.value.loading) return

    pending.value.loading = true
    pending.value.error = null

    try {
      const queryParams: Record<string, unknown> = {
        per_page: params.per_page ?? 20,
      }

      if (pending.value.cursor) {
        queryParams.cursor = pending.value.cursor
      }

      const response = await api<{
        success: true
        data: {
          rewards: UserReward[]
          pagination: RewardPagination
        }
      }>('/user/rewards', { params: queryParams })

      pending.value.items.push(...response.data.rewards)
      pending.value.hasMore = response.data.pagination.has_more
      pending.value.cursor = response.data.pagination.next_cursor ?? null
    } catch (err) {
      const normalized = normalizeError(err)
      pending.value.error = normalized.message
      log.error('fetchPending failed:', err)
    } finally {
      pending.value.loading = false
    }
  }

  /**
   * Fetch reward history.
   */
  async function fetchHistory(params: GetRewardsParams = {}, reset = false): Promise<void> {
    if (reset) {
      history.value.items = []
      history.value.cursor = null
      history.value.hasMore = true
    }

    if (!history.value.hasMore || history.value.loading) return

    history.value.loading = true
    history.value.error = null

    try {
      const queryParams: Record<string, unknown> = {
        per_page: params.per_page ?? 20,
      }

      if (history.value.cursor) {
        queryParams.cursor = history.value.cursor
      }

      const response = await api<{
        success: true
        data: {
          rewards: UserReward[]
          pagination: RewardPagination
        }
      }>('/user/rewards/history', { params: queryParams })

      history.value.items.push(...response.data.rewards)
      history.value.hasMore = response.data.pagination.has_more
      history.value.cursor = response.data.pagination.next_cursor ?? null
    } catch (err) {
      const normalized = normalizeError(err)
      history.value.error = normalized.message
      log.error('fetchHistory failed:', err)
    } finally {
      history.value.loading = false
    }
  }

  /**
   * Fetch reward statistics.
   */
  async function fetchStats(): Promise<void> {
    statsLoading.value = true

    try {
      const response = await api<{
        success: true
        data: RewardStats
      }>('/user/rewards/stats')

      stats.value = response.data
    } catch (err) {
      log.error('fetchStats failed:', err)
    } finally {
      statsLoading.value = false
    }
  }

  /**
   * Claim a single reward.
   */
  async function claim(rewardId: number): Promise<boolean> {
    if (claimingId.value !== null) return false

    claimingId.value = rewardId

    try {
      const response = await api<{
        success: true
        data: {
          reward: UserReward
          new_balance?: { coins?: string; diamonds?: string }
        }
        message: string
      }>(`/user/rewards/${rewardId}/claim`, { method: 'POST' })

      // Update pending list (remove claimed reward)
      pending.value.items = pending.value.items.filter(r => r.id !== rewardId)

      // Update stats
      if (stats.value) {
        stats.value.total_pending = Math.max(0, stats.value.total_pending - 1)
        stats.value.total_claimed += 1
        stats.value.last_claimed_at = new Date().toISOString()
      }

      // Update user balance if provided (via authStore API — no direct mutation)
      if (response.data.new_balance) {
        const authStore = useAuthStore()
        authStore.patchBalance({
          ...(response.data.new_balance.coins && { coins: response.data.new_balance.coins }),
          ...(response.data.new_balance.diamonds && { diamonds: response.data.new_balance.diamonds }),
        })
      }

      toast.add({
        title: 'Reward Claimed!',
        description: response.message,
        color: 'success',
      })

      return true
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({
        title: 'Claim Failed',
        description: normalized.message,
        color: 'error',
      })
      log.error('claim failed:', err)
      return false
    } finally {
      claimingId.value = null
    }
  }

  /**
   * Claim all pending rewards.
   */
  async function claimAll(): Promise<number> {
    let claimedCount = 0
    const rewardsToClam = [...pending.value.items]

    for (const reward of rewardsToClam) {
      const success = await claim(reward.id)
      if (success) claimedCount++
    }

    return claimedCount
  }

  /**
   * Handle reward earned event (real-time).
   */
  function onRewardEarned(reward: UserReward): void {
    // Add to pending list
    pending.value.items.unshift(reward)

    // Update stats
    if (stats.value) {
      stats.value.total_pending += 1
      if (reward.reward_type === 'diamonds' && reward.reward_value) {
        stats.value.pending_diamonds += reward.reward_value
      }
      if (reward.reward_type === 'coins' && reward.reward_value) {
        stats.value.pending_coins += reward.reward_value
      }
    }

    // Show notification
    toast.add({
      title: 'New Reward!',
      description: reward.source_name,
      color: 'success',
      icon: 'i-lucide-gift',
    })
  }

  /**
   * Fetch all rewards data (pending + stats).
   */
  async function fetchAll(): Promise<void> {
    await Promise.all([fetchPending({}, true), fetchStats()])
    lastFetchedAt.value = Date.now()
  }

  /**
   * Reset all state.
   */
  function reset(): void {
    pending.value = {
      items: [],
      loading: false,
      error: null,
      hasMore: true,
      cursor: null,
    }
    history.value = {
      items: [],
      loading: false,
      error: null,
      hasMore: true,
      cursor: null,
    }
    stats.value = null
    statsLoading.value = false
    claimingId.value = null
    lastFetchedAt.value = null
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    pending,
    history,
    stats,
    statsLoading,
    claimingId,
    lastFetchedAt,

    // Computed
    pendingCount,
    totalPendingDiamonds,
    totalPendingCoins,
    isClaiming,
    hasClaimableRewards,
    needsRefresh,

    // Actions
    fetchPending,
    fetchHistory,
    fetchStats,
    claim,
    claimAll,
    onRewardEarned,
    fetchAll,
    reset,
  }
})
