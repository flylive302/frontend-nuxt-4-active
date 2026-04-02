// ========================================
// Rewards Store
// ========================================
// State + computed + setters ONLY — orchestration in useRewardsActions.

import { defineStore } from 'pinia'
import type {
  UserReward,
  RewardStats,
  RewardPagination,
} from '~/types/progression/reward'

interface RewardListState {
  items: UserReward[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}

export const useRewardsStore = defineStore('rewards', () => {
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
  const lastFetchedAt = ref<number | null>(null)

  const STALE_TIME = 5 * 60 * 1000

  const pendingCount = computed(() => stats.value?.total_pending ?? 0)
  const totalPendingDiamonds = computed(() => stats.value?.pending_diamonds ?? 0)
  const totalPendingCoins = computed(() => stats.value?.pending_coins ?? 0)
  const isClaiming = computed(() => claimingId.value !== null)
  const hasClaimableRewards = computed(() => pending.value.items.length > 0)
  const needsRefresh = computed<boolean>(() => {
    if (!lastFetchedAt.value) return true
    return Date.now() - lastFetchedAt.value > STALE_TIME
  })

  function setPendingLoading(v: boolean): void {
    pending.value.loading = v
  }

  function setPendingError(msg: string | null): void {
    pending.value.error = msg
  }

  function resetPendingPagination(): void {
    pending.value.items = []
    pending.value.cursor = null
    pending.value.hasMore = true
  }

  function appendPendingPage(items: UserReward[], pagination: RewardPagination): void {
    pending.value.items.push(...items)
    pending.value.hasMore = pagination.has_more
    pending.value.cursor = pagination.next_cursor ?? null
  }

  function setHistoryLoading(v: boolean): void {
    history.value.loading = v
  }

  function setHistoryError(msg: string | null): void {
    history.value.error = msg
  }

  function resetHistoryPagination(): void {
    history.value.items = []
    history.value.cursor = null
    history.value.hasMore = true
  }

  function appendHistoryPage(items: UserReward[], pagination: RewardPagination): void {
    history.value.items.push(...items)
    history.value.hasMore = pagination.has_more
    history.value.cursor = pagination.next_cursor ?? null
  }

  function setStatsLoading(v: boolean): void {
    statsLoading.value = v
  }

  function setStats(s: RewardStats | null): void {
    stats.value = s
  }

  function setClaimingId(id: number | null): void {
    claimingId.value = id
  }

  function setLastFetchedAt(t: number | null): void {
    lastFetchedAt.value = t
  }

  function applyClaimSuccess(rewardId: number): void {
    pending.value.items = pending.value.items.filter(r => r.id !== rewardId)
    if (stats.value) {
      stats.value.total_pending = Math.max(0, stats.value.total_pending - 1)
      stats.value.total_claimed += 1
      stats.value.last_claimed_at = new Date().toISOString()
    }
  }

  function prependPendingReward(reward: UserReward): void {
    pending.value.items.unshift(reward)
    if (stats.value) {
      stats.value.total_pending += 1
      if (reward.reward_type === 'diamonds' && reward.reward_value) {
        stats.value.pending_diamonds += reward.reward_value
      }
      if (reward.reward_type === 'coins' && reward.reward_value) {
        stats.value.pending_coins += reward.reward_value
      }
    }
  }

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

  return {
    pending,
    history,
    stats,
    statsLoading,
    claimingId,
    lastFetchedAt,
    pendingCount,
    totalPendingDiamonds,
    totalPendingCoins,
    isClaiming,
    hasClaimableRewards,
    needsRefresh,
    setPendingLoading,
    setPendingError,
    resetPendingPagination,
    appendPendingPage,
    setHistoryLoading,
    setHistoryError,
    resetHistoryPagination,
    appendHistoryPage,
    setStatsLoading,
    setStats,
    setClaimingId,
    setLastFetchedAt,
    applyClaimSuccess,
    prependPendingReward,
    reset,
  }
})
