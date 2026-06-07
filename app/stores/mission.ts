// ========================================
// Mission Store
// ========================================
// State + setters ONLY. API calls live in composables.
// Keyed by timeframe so daily/weekly/monthly share one store.
// ========================================

import { defineStore } from 'pinia'
import type { MilestoneState, MissionProgressResponse, LeaderboardResponse, HonorWallSection } from '~/types/mission/recharge'

export const useMissionStore = defineStore('mission', () => {
  // ========================================
  // State
  // ========================================

  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const progressByTimeframe = ref<Record<string, MissionProgressResponse>>({})
  const leaderboardByTimeframe = ref<Record<string, LeaderboardResponse>>({})
  const finaleSnapshotByTimeframe = ref<Record<string, HonorWallSection>>({})
  const finaleReadyByTimeframe = ref<Record<string, boolean>>({})

  // ========================================
  // Computed
  // ========================================

  const dailyProgress = computed(() => progressByTimeframe.value['daily'] ?? null)

  // ========================================
  // Setters
  // ========================================

  function setLoading(value: boolean): void {
    isLoading.value = value
  }

  function setError(message: string | null): void {
    error.value = message
  }

  function setProgress(timeframe: string, data: MissionProgressResponse): void {
    progressByTimeframe.value = { ...progressByTimeframe.value, [timeframe]: data }
  }

  function setDailyProgress(data: MissionProgressResponse): void {
    setProgress('daily', data)
  }

  function setLeaderboard(timeframe: string, data: LeaderboardResponse): void {
    leaderboardByTimeframe.value = { ...leaderboardByTimeframe.value, [timeframe]: data }
  }

  function progressFor(timeframe: string): MissionProgressResponse | null {
    return progressByTimeframe.value[timeframe] ?? null
  }

  function leaderboardFor(timeframe: string): LeaderboardResponse | null {
    return leaderboardByTimeframe.value[timeframe] ?? null
  }

  function setMilestoneState(timeframe: string, milestoneId: number, state: MilestoneState): void {
    const progress = progressByTimeframe.value[timeframe]
    if (!progress) return
    const milestone = progress.milestones.find(m => m.id === milestoneId)
    if (milestone) milestone.state = state
  }

  function setFinaleReady(timeframe: string, snapshot: HonorWallSection): void {
    finaleSnapshotByTimeframe.value = { ...finaleSnapshotByTimeframe.value, [timeframe]: snapshot }
    finaleReadyByTimeframe.value = { ...finaleReadyByTimeframe.value, [timeframe]: true }
  }

  function isFinaleReadyFor(timeframe: string): boolean {
    return finaleReadyByTimeframe.value[timeframe] ?? false
  }

  function finaleSnapshotFor(timeframe: string): HonorWallSection | null {
    return finaleSnapshotByTimeframe.value[timeframe] ?? null
  }

  return {
    isLoading: readonly(isLoading),
    error: readonly(error),
    dailyProgress,
    setLoading,
    setError,
    setProgress,
    setDailyProgress,
    setLeaderboard,
    progressFor,
    leaderboardFor,
    setMilestoneState,
    setFinaleReady,
    isFinaleReadyFor,
    finaleSnapshotFor,
  }
})
