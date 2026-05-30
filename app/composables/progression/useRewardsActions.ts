// ========================================
// Rewards — GATE / EXECUTE / REACT orchestration
// ========================================
// API, toasts, and balance patching live here per ARCHITECTURE.md (composables = pipeline).

import { createLogger } from '~/utils/logger'
import type {
  UserReward,
  RewardStats,
  GetRewardsParams,
  RewardPagination,
} from '~/types/progression/reward'

const log = createLogger('[useRewardsActions]')

export function useRewardsActions() {
  const store = useRewardsStore()
  const { api, normalizeError } = useApi()
  const toast = useToast()
  const authStore = useAuthStore()

  async function fetchPending(params: GetRewardsParams = {}, reset = false): Promise<void> {
    if (reset) store.resetPendingPagination()

    if (!store.pending.hasMore || store.pending.loading) return

    store.setPendingLoading(true)
    store.setPendingError(null)

    try {
      const queryParams: Record<string, unknown> = {
        per_page: params.per_page ?? 20,
      }
      if (store.pending.cursor) queryParams.cursor = store.pending.cursor

      const response = await api<{
        success: true
        data: { rewards: UserReward[]; pagination: RewardPagination }
      }>('/user/rewards', { params: queryParams })

      store.appendPendingPage(response.data.rewards, response.data.pagination)
    } catch (err) {
      const normalized = normalizeError(err)
      store.setPendingError(normalized.message)
    } finally {
      store.setPendingLoading(false)
    }
  }

  async function fetchHistory(params: GetRewardsParams = {}, reset = false): Promise<void> {
    if (reset) store.resetHistoryPagination()

    if (!store.history.hasMore || store.history.loading) return

    store.setHistoryLoading(true)
    store.setHistoryError(null)

    try {
      const queryParams: Record<string, unknown> = {
        per_page: params.per_page ?? 20,
      }
      if (store.history.cursor) queryParams.cursor = store.history.cursor

      const response = await api<{
        success: true
        data: { rewards: UserReward[]; pagination: RewardPagination }
      }>('/user/rewards/history', { params: queryParams })

      store.appendHistoryPage(response.data.rewards, response.data.pagination)
    } catch (err) {
      const normalized = normalizeError(err)
      store.setHistoryError(normalized.message)
    } finally {
      store.setHistoryLoading(false)
    }
  }

  async function fetchStats(): Promise<void> {
    store.setStatsLoading(true)
    try {
      const response = await api<{ success: true; data: RewardStats }>('/user/rewards/stats')
      store.setStats(response.data)
    } catch (err) {
    } finally {
      store.setStatsLoading(false)
    }
  }

  async function claim(rewardId: number): Promise<boolean> {
    if (store.claimingId !== null) return false

    store.setClaimingId(rewardId)

    try {
      const response = await api<{
        success: true
        data: {
          reward: UserReward
          new_balance?: { coins?: string; diamonds?: string }
        }
        message: string
      }>(`/user/rewards/${rewardId}/claim`, { method: 'POST' })

      store.applyClaimSuccess(rewardId)

      if (response.data.new_balance) {
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
      return false
    } finally {
      store.setClaimingId(null)
    }
  }

  async function claimAll(): Promise<number> {
    const rewardsToClaim = [...store.pending.items]
    let claimedCount = 0
    for (const reward of rewardsToClaim) {
      const claimed = await claim(reward.id)
      if (claimed) claimedCount += 1
    }
    return claimedCount
  }

  /** Real-time: new pending reward (state only; toast from event layer if needed). */
  function onRewardEarned(reward: UserReward): void {
    store.prependPendingReward(reward)
    toast.add({
      title: 'New Reward!',
      description: reward.source_name,
      color: 'success',
      icon: 'i-lucide-gift',
    })
  }

  async function fetchAll(): Promise<void> {
    await Promise.all([fetchPending({}, true), fetchStats()])
    store.setLastFetchedAt(Date.now())
  }

  return {
    fetchPending,
    fetchHistory,
    fetchStats,
    claim,
    claimAll,
    onRewardEarned,
    fetchAll,
  }
}
