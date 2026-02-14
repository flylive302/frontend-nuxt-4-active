// ========================================
// Transaction Store
// ========================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createLogger } from '~/utils/logger'
import type {
  TransactionsByDate,
  TransactionSummary,
  TransactionTypeFilter,
  GetTransactionsParams,
  TransactionPagination,
} from '~/types/wallet'

// ========================================
// Types
// ========================================

interface TransactionState {
  transactionsByDate: TransactionsByDate[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
  currentPage: number
}

// ========================================
// Store Definition
// ========================================

export const useTransactionStore = defineStore('transactions', () => {
  const log = createLogger('[TransactionStore]')
  const { api, normalizeError } = useApi()

  // ========================================
  // State
  // ========================================

  const transactions = ref<TransactionState>({
    transactionsByDate: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
    currentPage: 1,
  })

  const summary = ref<TransactionSummary | null>(null)
  const currentFilter = ref<TransactionTypeFilter>('all')
  const summaryLoading = ref(false)

  // ========================================
  // Computed
  // ========================================

  /**
   * Total number of transactions across all date groups.
   */
  const totalTransactions = computed(() =>
    transactions.value.transactionsByDate.reduce(
      (sum, day) => sum + day.transactions.length,
      0
    )
  )

  /**
   * Check if transaction list is empty (no error, not loading, no data).
   */
  const isEmpty = computed(
    () => transactions.value.transactionsByDate.length === 0 
      && !transactions.value.loading 
      && !transactions.value.error
  )

  /**
   * Flattened list of all transactions.
   */
  const allTransactions = computed(() =>
    transactions.value.transactionsByDate.flatMap(day => day.transactions)
  )

  // ========================================
  // Actions
  // ========================================

  /**
   * Fetch transactions from API.
   * @param params - Query parameters for filtering
   * @param reset - If true, clears existing data before fetching
   */
  async function fetch(params: GetTransactionsParams = {}, reset = false): Promise<void> {
    if (reset) {
      transactions.value.transactionsByDate = []
      transactions.value.cursor = null
      transactions.value.currentPage = 1
      transactions.value.hasMore = true
    }

    if (!transactions.value.hasMore || transactions.value.loading) return

    transactions.value.loading = true
    transactions.value.error = null

    try {
      // Build query params
      const queryParams: Record<string, unknown> = {
        per_page: params.per_page ?? 20,
      }

      // Add optional params
      if (params.type && params.type !== 'all') {
        queryParams.type = params.type
      }
      if (transactions.value.cursor) {
        queryParams.cursor = transactions.value.cursor
      } else if (params.page) {
        queryParams.page = params.page
      }
      if (params.date_from) {
        queryParams.date_from = params.date_from
      }
      if (params.date_to) {
        queryParams.date_to = params.date_to
      }
      if (params.sort) {
        queryParams.sort = params.sort
      }

      const response = await api<{
        success: true
        data: {
          transactions_by_date: TransactionsByDate[]
          pagination: TransactionPagination
        }
      }>('/transactions', { params: queryParams })

      // Merge new data with existing
      mergeTransactions(response.data.transactions_by_date)

      // Update pagination state
      transactions.value.currentPage = response.data.pagination.current_page
      transactions.value.hasMore = response.data.pagination.has_more
      transactions.value.cursor = response.data.pagination.next_cursor ?? null
      currentFilter.value = params.type ?? 'all'
    } catch (error) {
      const err = normalizeError(error)
      transactions.value.error = err.message
      log.error('fetch failed:', error)
    } finally {
      transactions.value.loading = false
    }
  }

  /**
   * Load more transactions (pagination).
   */
  async function loadMore(): Promise<void> {
    if (!transactions.value.hasMore || transactions.value.loading) return

    await fetch({
      type: currentFilter.value,
      cursor: transactions.value.cursor ?? undefined,
      page: transactions.value.cursor ? undefined : transactions.value.currentPage + 1,
    })
  }

  /**
   * Merge new transaction data with existing data.
   * Groups by date and appends new transactions.
   */
  function mergeTransactions(newData: TransactionsByDate[]): void {
    for (const newDay of newData) {
      const existingDay = transactions.value.transactionsByDate.find(
        d => d.date === newDay.date
      )

      if (existingDay) {
        // Append new transactions to existing day (avoid duplicates)
        const existingIds = new Set(existingDay.transactions.map(t => t.id))
        const uniqueNew = newDay.transactions.filter(t => !existingIds.has(t.id))
        existingDay.transactions.push(...uniqueNew)
      } else {
        // Add new day
        transactions.value.transactionsByDate.push(newDay)
      }
    }
  }

  /**
   * Fetch transaction summary statistics.
   */
  async function fetchSummary(): Promise<void> {
    summaryLoading.value = true

    try {
      const response = await api<{
        success: true
        data: TransactionSummary
      }>('/transactions/summary')

      summary.value = response.data
    } catch (error) {
      log.error('fetchSummary failed:', error)
    } finally {
      summaryLoading.value = false
    }
  }

  /**
   * Change filter and refetch.
   */
  async function changeFilter(filter: TransactionTypeFilter): Promise<void> {
    currentFilter.value = filter
    await fetch({ type: filter }, true)
  }

  /**
   * Reset all state.
   */
  function reset(): void {
    transactions.value = {
      transactionsByDate: [],
      loading: false,
      error: null,
      hasMore: true,
      cursor: null,
      currentPage: 1,
    }
    currentFilter.value = 'all'
    summary.value = null
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    transactions,
    summary,
    currentFilter,
    summaryLoading,

    // Computed
    totalTransactions,
    isEmpty,
    allTransactions,

    // Actions
    fetch,
    loadMore,
    fetchSummary,
    changeFilter,
    reset,
  }
})
