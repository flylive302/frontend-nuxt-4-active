// ========================================
// Income Store
// ========================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  IncomeTarget,
  IncomeSummary,
  IncomeTargetHistory,
  GetIncomeHistoryParams,
} from '~/types/income'

// ========================================
// Types
// ========================================

interface HistoryState {
  items: IncomeTargetHistory[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}

// ========================================
// Store Definition
// ========================================

export const useIncomeStore = defineStore('income', () => {
  const { api, normalizeError } = useApi()

  // ========================================
  // State
  // ========================================

  const summary = ref<IncomeSummary | null>(null)
  const activeTarget = ref<IncomeTarget | null>(null)
  const isLoading = ref(false)
  const isTargetLoading = ref(false)
  const error = ref<string | null>(null)

  const history = ref<HistoryState>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  // ========================================
  // Computed
  // ========================================

  /**
   * Whether user has an active income target.
   */
  const hasActiveTarget = computed(() => activeTarget.value !== null)

  /**
   * Progress percentage of active target (0-100).
   */
  const targetProgress = computed(() => activeTarget.value?.progress_percentage ?? 0)

  /**
   * Days remaining for active target.
   */
  const daysRemaining = computed(() => activeTarget.value?.days_remaining ?? 0)

  /**
   * Coins needed to complete active target.
   */
  const coinsToComplete = computed(() => activeTarget.value?.coins_to_complete ?? '0')

  /**
   * Recent earnings from summary.
   */
  const recentEarnings = computed(() => summary.value?.recent_earnings ?? [])

  // ========================================
  // Actions
  // ========================================

  /**
   * Fetch income summary statistics.
   */
  async function fetchStats(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const response = await api<{
        success: true
        data: IncomeSummary
      }>('/user/income')

      summary.value = response.data
    } catch (err) {
      const normalized = normalizeError(err)
      error.value = normalized.message
      console.error('[IncomeStore] fetchStats failed:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch active income target.
   */
  async function fetchActiveTarget(): Promise<void> {
    isTargetLoading.value = true

    try {
      const response = await api<{
        success: true
        data: IncomeTarget | null
      }>('/user/income/targets/active')

      activeTarget.value = response.data
    } catch (err) {
      console.error('[IncomeStore] fetchActiveTarget failed:', err)
      activeTarget.value = null
    } finally {
      isTargetLoading.value = false
    }
  }

  /**
   * Fetch income target history.
   */
  async function fetchHistory(params: GetIncomeHistoryParams = {}, reset = false): Promise<void> {
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
          targets: IncomeTargetHistory[]
          pagination: { has_more: boolean; next_cursor?: string }
        }
      }>('/user/income/targets/history', { params: queryParams })

      history.value.items.push(...response.data.targets)
      history.value.hasMore = response.data.pagination.has_more
      history.value.cursor = response.data.pagination.next_cursor ?? null
    } catch (err) {
      const normalized = normalizeError(err)
      history.value.error = normalized.message
      console.error('[IncomeStore] fetchHistory failed:', err)
    } finally {
      history.value.loading = false
    }
  }

  /**
   * Fetch all income data (stats + active target).
   * Call this on mount for income dashboard.
   */
  async function fetchAll(): Promise<void> {
    await Promise.all([fetchStats(), fetchActiveTarget()])
  }

  /**
   * Handle income target completed event (real-time).
   */
  function onTargetCompleted(completedTarget: IncomeTargetHistory): void {
    // Clear active target
    activeTarget.value = null

    // Add to history
    history.value.items.unshift(completedTarget)

    // Refresh stats
    void fetchStats()
  }

  /**
   * Handle income earned event (real-time).
   * Updates summary totals optimistically.
   */
  function onIncomeEarned(amount: string): void {
    if (summary.value) {
      const current = parseFloat(summary.value.total_today)
      const added = parseFloat(amount)
      summary.value.total_today = (current + added).toFixed(4)
    }

    // Update active target progress
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

  /**
   * Reset all state.
   */
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
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    summary,
    activeTarget,
    isLoading,
    isTargetLoading,
    error,
    history,

    // Computed
    hasActiveTarget,
    targetProgress,
    daysRemaining,
    coinsToComplete,
    recentEarnings,

    // Actions
    fetchStats,
    fetchActiveTarget,
    fetchHistory,
    fetchAll,
    onTargetCompleted,
    onIncomeEarned,
    reset,
  }
})
