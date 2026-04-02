// ========================================
// Income Store
// ========================================
// State + computed + setters ONLY — useIncomeActions for API.

import { defineStore } from 'pinia'
import type {
  IncomeSummary,
  IncomeTarget,
  IncomeTargetHistory,
} from '~/types/income/income'

interface HistoryState {
  items: IncomeTargetHistory[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}

export const useIncomeStore = defineStore('income', () => {
  const summary = ref<IncomeSummary | null>(null)
  const activeTarget = ref<IncomeTarget | null>(null)
  const isLoading = ref(false)
  const isTargetLoading = ref(false)
  const error = ref<string | null>(null)
  const lastFetchedAt = ref<number | null>(null)

  const STALE_TIME = 5 * 60 * 1000

  const history = ref<HistoryState>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  const hasActiveTarget = computed(() => activeTarget.value !== null)
  const targetProgress = computed(() => activeTarget.value?.progress_percentage ?? 0)
  const daysRemaining = computed(() => activeTarget.value?.days_remaining ?? 0)

  const coinsToComplete = computed(() => {
    if (!activeTarget.value) return '0'
    const apiValue = activeTarget.value.coins_to_complete
    if (apiValue && parseFloat(apiValue) > 0) {
      return apiValue
    }
    const required = parseFloat(activeTarget.value.required_coins ?? '0')
    const earned = parseFloat(activeTarget.value.earned_coins ?? '0')
    const remaining = Math.max(0, required - earned)
    return remaining.toFixed(4)
  })

  const recentEarnings = computed(() => summary.value?.recent_earnings ?? [])

  const needsRefresh = computed<boolean>(() => {
    if (!lastFetchedAt.value) return true
    return Date.now() - lastFetchedAt.value > STALE_TIME
  })

  function setStatsLoading(v: boolean): void {
    isLoading.value = v
  }

  function setTargetLoading(v: boolean): void {
    isTargetLoading.value = v
  }

  function setError(msg: string | null): void {
    error.value = msg
  }

  function setSummary(s: IncomeSummary | null): void {
    summary.value = s
  }

  function setActiveTarget(t: IncomeTarget | null): void {
    activeTarget.value = t
  }

  function setLastFetchedAt(t: number | null): void {
    lastFetchedAt.value = t
  }

  function resetHistoryPagination(): void {
    history.value.items = []
    history.value.cursor = null
    history.value.hasMore = true
  }

  function setHistoryLoading(v: boolean): void {
    history.value.loading = v
  }

  function setHistoryError(msg: string | null): void {
    history.value.error = msg
  }

  function appendHistoryPage(
    targets: IncomeTargetHistory[],
    pagination: { has_more: boolean; next_cursor?: string }
  ): void {
    history.value.items.push(...targets)
    history.value.hasMore = pagination.has_more
    history.value.cursor = pagination.next_cursor ?? null
  }

  function onTargetCompleted(completedTarget: IncomeTargetHistory): void {
    activeTarget.value = null
    history.value.items.unshift(completedTarget)
  }

  function onIncomeEarned(amount: string): void {
    if (summary.value) {
      const current = parseFloat(summary.value.total_today)
      const added = parseFloat(amount)
      summary.value.total_today = (current + added).toFixed(4)
    }

    if (activeTarget.value) {
      const earned = parseFloat(activeTarget.value.earned_coins)
      const added = parseFloat(amount)
      const required = parseFloat(activeTarget.value.required_coins)
      const newEarned = earned + added
      const newProgress = Math.min(100, (newEarned / required) * 100)

      activeTarget.value.earned_coins = newEarned.toFixed(4)
      activeTarget.value.progress_percentage = newProgress
      activeTarget.value.coins_to_complete = Math.max(0, required - newEarned).toFixed(4)
    }
  }

  function reset(): void {
    summary.value = null
    activeTarget.value = null
    isLoading.value = false
    isTargetLoading.value = false
    error.value = null
    history.value = {
      items: [],
      loading: false,
      error: null,
      hasMore: true,
      cursor: null,
    }
    lastFetchedAt.value = null
  }

  return {
    summary,
    activeTarget,
    isLoading,
    isTargetLoading,
    error,
    history,
    lastFetchedAt,
    hasActiveTarget,
    targetProgress,
    daysRemaining,
    coinsToComplete,
    recentEarnings,
    needsRefresh,
    setStatsLoading,
    setTargetLoading,
    setError,
    setSummary,
    setActiveTarget,
    setLastFetchedAt,
    resetHistoryPagination,
    setHistoryLoading,
    setHistoryError,
    appendHistoryPage,
    onTargetCompleted,
    onIncomeEarned,
    reset,
  }
})
