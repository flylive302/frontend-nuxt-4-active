// ========================================
// Income Store
// ========================================
// State + computed + setters ONLY — useIncomeActions for API.
// Agency-XP per-run milestone model (native XP, no multiplier).

import { defineStore } from 'pinia'
import type {
  AgencyRun,
  IncomeStats,
  RunOption,
  RunSnapshot,
  XpProgressUpdate,
  MilestoneCrossedUpdate,
} from '~/types/income/income'

export const useIncomeStore = defineStore('income', () => {
  const stats = ref<IncomeStats | null>(null)
  const activeRun = ref<AgencyRun | null>(null)
  const runOptions = ref<RunOption[]>([])
  const selectedSnapshot = ref<RunSnapshot | null>(null)

  const isStatsLoading = ref(false)
  const isRunLoading = ref(false)
  const isHistoryLoading = ref(false)
  const isSnapshotLoading = ref(false)
  const isClaiming = ref(false)
  const error = ref<string | null>(null)
  const lastFetchedAt = ref<number | null>(null)

  const STALE_TIME = 5 * 60 * 1000

  const hasActiveRun = computed(() => activeRun.value !== null)
  const currentTier = computed(() => activeRun.value?.current_tier ?? 0)
  const progress = computed(() => activeRun.value?.progress_percentage ?? 0)
  const totalDiamondsEarned = computed(() => stats.value?.total_diamonds_earned ?? 0)
  const completedRuns = computed(() => stats.value?.completed_runs ?? 0)

  const needsRefresh = computed<boolean>(() => {
    if (!lastFetchedAt.value) return true
    return Date.now() - lastFetchedAt.value > STALE_TIME
  })

  function setStatsLoading(v: boolean): void {
    isStatsLoading.value = v
  }

  function setRunLoading(v: boolean): void {
    isRunLoading.value = v
  }

  function setHistoryLoading(v: boolean): void {
    isHistoryLoading.value = v
  }

  function setSnapshotLoading(v: boolean): void {
    isSnapshotLoading.value = v
  }

  function setClaiming(v: boolean): void {
    isClaiming.value = v
  }

  function setError(msg: string | null): void {
    error.value = msg
  }

  function setStats(s: IncomeStats | null): void {
    stats.value = s
  }

  function setActiveRun(r: AgencyRun | null): void {
    activeRun.value = r
  }

  function setRunOptions(options: RunOption[]): void {
    runOptions.value = options
  }

  function setSelectedSnapshot(snapshot: RunSnapshot | null): void {
    selectedSnapshot.value = snapshot
  }

  function setLastFetchedAt(t: number | null): void {
    lastFetchedAt.value = t
  }

  /**
   * Realtime — apply a per-gift XP increment to the active run. Only mutates
   * when the payload's run matches the loaded run; a mismatch (or null run)
   * means the backend lazily opened a run the client hasn't fetched, so the
   * caller should refetch instead of writing stale state.
   */
  function applyXpProgress(update: XpProgressUpdate): boolean {
    if (!activeRun.value || activeRun.value.id !== update.run_id) {
      return false
    }

    activeRun.value.accumulated_xp = update.accumulated_xp
    activeRun.value.current_tier = update.current_tier
    activeRun.value.progress_percentage = update.progress_percentage
    syncLadderFlags(update.current_tier)
    return true
  }

  /**
   * Realtime — mark tiers up to `current_tier` crossed on the active run.
   */
  function onMilestoneCrossed(update: MilestoneCrossedUpdate): void {
    if (!activeRun.value || activeRun.value.id !== update.run_id) {
      return
    }

    activeRun.value.current_tier = update.current_tier
    syncLadderFlags(update.current_tier)
  }

  /**
   * Mark every milestone of a snapshot as claimed (after a successful claim).
   */
  function markSnapshotClaimed(runId: number): void {
    if (!selectedSnapshot.value || selectedSnapshot.value.id !== runId) {
      return
    }

    selectedSnapshot.value.milestones = selectedSnapshot.value.milestones.map((milestone) => ({
      ...milestone,
      member_reward_claimed: true,
    }))
  }

  function syncLadderFlags(tier: number): void {
    if (!activeRun.value) return

    activeRun.value.ladder = activeRun.value.ladder.map((rung) => ({
      ...rung,
      crossed: rung.tier <= tier,
      is_active: rung.tier === tier + 1,
    }))
  }

  function reset(): void {
    stats.value = null
    activeRun.value = null
    runOptions.value = []
    selectedSnapshot.value = null
    isStatsLoading.value = false
    isRunLoading.value = false
    isHistoryLoading.value = false
    isSnapshotLoading.value = false
    isClaiming.value = false
    error.value = null
    lastFetchedAt.value = null
  }

  return {
    stats,
    activeRun,
    runOptions,
    selectedSnapshot,
    isStatsLoading,
    isRunLoading,
    isHistoryLoading,
    isSnapshotLoading,
    isClaiming,
    error,
    lastFetchedAt,
    hasActiveRun,
    currentTier,
    progress,
    totalDiamondsEarned,
    completedRuns,
    needsRefresh,
    setStatsLoading,
    setRunLoading,
    setHistoryLoading,
    setSnapshotLoading,
    setClaiming,
    setError,
    setStats,
    setActiveRun,
    setRunOptions,
    setSelectedSnapshot,
    setLastFetchedAt,
    applyXpProgress,
    onMilestoneCrossed,
    markSnapshotClaimed,
    reset,
  }
})
