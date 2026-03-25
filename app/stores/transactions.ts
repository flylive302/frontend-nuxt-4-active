// ========================================
// Transaction Store (State Only)
// ========================================
// Holds reactive state, computed derivations, and simple setters.
// NO API calls, NO toasts — all orchestration is in useTransactionData.
// ========================================

import { defineStore } from 'pinia'
import type {
  TransactionsByDate,
  TransactionSummary,
  TransactionTypeFilter,
} from '~/types/economy/wallet'

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

  const totalTransactions = computed(() =>
    transactions.value.transactionsByDate.reduce(
      (sum, day) => sum + day.transactions.length,
      0,
    ),
  )

  const isEmpty = computed(
    () =>
      transactions.value.transactionsByDate.length === 0
      && !transactions.value.loading
      && !transactions.value.error,
  )

  const allTransactions = computed(() =>
    transactions.value.transactionsByDate.flatMap(day => day.transactions),
  )

  // ========================================
  // Setters
  // ========================================

  function setTransactions(data: TransactionsByDate[]): void {
    transactions.value.transactionsByDate = data
  }

  function setLoading(value: boolean): void {
    transactions.value.loading = value
  }

  function setError(message: string | null): void {
    transactions.value.error = message
  }

  function setHasMore(value: boolean): void {
    transactions.value.hasMore = value
  }

  function setCursor(value: string | null): void {
    transactions.value.cursor = value
  }

  function setCurrentPage(page: number): void {
    transactions.value.currentPage = page
  }

  function setFilter(filter: TransactionTypeFilter): void {
    currentFilter.value = filter
  }

  function setSummary(data: TransactionSummary | null): void {
    summary.value = data
  }

  function setSummaryLoading(value: boolean): void {
    summaryLoading.value = value
  }

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

    // Setters
    setTransactions,
    setLoading,
    setError,
    setHasMore,
    setCursor,
    setCurrentPage,
    setFilter,
    setSummary,
    setSummaryLoading,
    reset,
  }
})
