// ========================================
// Income Store
// ========================================
// State + computed + setters ONLY — useIncomeActions for API.
// Agency-XP per-run milestone model (native XP, no multiplier).
// Run-centric page: overview + selected run id + per-run detail cache.

import { defineStore } from 'pinia'
import type {
  AgencyRun,
  IncomeOverview,
  RunDetail,
  XpProgressUpdate,
  MilestoneCrossedUpdate,
} from '~/types/income/income'

export const useIncomeStore = defineStore('income', () => {
  const overview = ref<IncomeOverview | null>(null)
  const selectedRunId = ref<number | null>(null)
  const runDetails = ref<Record<number, RunDetail>>({})
  const activeRun = ref<AgencyRun | null>(null)

  const isOverviewLoading = ref(false)
  const loadingRunId = ref<number | null>(null)
  const isRunLoading = ref(false)
  const isClaiming = ref(false)
  const error = ref<string | null>(null)
  const lastFetchedAt = ref<number | null>(null)

  const STALE_TIME = 5 * 60 * 1000

  const hasActiveRun = computed(() => activeRun.value !== null)
  const currentTier = computed(() => activeRun.value?.current_tier ?? 0)
  const progress = computed(() => activeRun.value?.progress_percentage ?? 0)
  const hasAnyRun = computed(() => (overview.value?.agencies.length ?? 0) > 0)

  /** Default selection: the active run, else the most recent run (groups and runs are newest first). */
  const defaultRunId = computed<number | null>(
    () => overview.value?.active_run_id ?? overview.value?.agencies[0]?.runs[0]?.id ?? null
  )

  const selectedRunDetail = computed<RunDetail | null>(() =>
    selectedRunId.value !== null ? (runDetails.value[selectedRunId.value] ?? null) : null
  )

  const isSelectedRunLoading = computed(
    () => selectedRunId.value !== null && loadingRunId.value === selectedRunId.value
  )

  const isSelectedRunActive = computed(
    () => selectedRunId.value !== null && selectedRunId.value === activeRun.value?.id
  )

  const needsRefresh = computed<boolean>(() => {
    if (!lastFetchedAt.value) return true
    return Date.now() - lastFetchedAt.value > STALE_TIME
  })

  function setOverview(value: IncomeOverview | null): void {
    overview.value = value
  }

  function setSelectedRunId(runId: number | null): void {
    selectedRunId.value = runId
  }

  function setRunDetail(detail: RunDetail): void {
    runDetails.value = { ...runDetails.value, [detail.id]: detail }
  }

  function clearRunDetails(): void {
    runDetails.value = {}
  }

  function setOverviewLoading(v: boolean): void {
    isOverviewLoading.value = v
  }

  function setLoadingRunId(runId: number | null): void {
    loadingRunId.value = runId
  }

  function setRunLoading(v: boolean): void {
    isRunLoading.value = v
  }

  function setClaiming(v: boolean): void {
    isClaiming.value = v
  }

  function setError(msg: string | null): void {
    error.value = msg
  }

  function setActiveRun(r: AgencyRun | null): void {
    activeRun.value = r
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

  function syncLadderFlags(tier: number): void {
    if (!activeRun.value) return

    activeRun.value.ladder = activeRun.value.ladder.map((rung) => ({
      ...rung,
      crossed: rung.tier <= tier,
      is_active: rung.tier === tier + 1,
    }))
  }

  function reset(): void {
    overview.value = null
    selectedRunId.value = null
    runDetails.value = {}
    activeRun.value = null
    isOverviewLoading.value = false
    loadingRunId.value = null
    isRunLoading.value = false
    isClaiming.value = false
    error.value = null
    lastFetchedAt.value = null
  }

  return {
    overview,
    selectedRunId,
    runDetails,
    activeRun,
    isOverviewLoading,
    loadingRunId,
    isRunLoading,
    isClaiming,
    error,
    lastFetchedAt,
    hasActiveRun,
    currentTier,
    progress,
    hasAnyRun,
    defaultRunId,
    selectedRunDetail,
    isSelectedRunLoading,
    isSelectedRunActive,
    needsRefresh,
    setOverview,
    setSelectedRunId,
    setRunDetail,
    clearRunDetails,
    setOverviewLoading,
    setLoadingRunId,
    setRunLoading,
    setClaiming,
    setError,
    setActiveRun,
    setLastFetchedAt,
    applyXpProgress,
    onMilestoneCrossed,
    reset,
  }
})
