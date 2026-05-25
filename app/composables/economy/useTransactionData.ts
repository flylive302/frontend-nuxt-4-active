// ========================================
// Transaction Data Composable (Data/Query Role)
// ========================================
// Owns all API calls for transaction data. The store holds
// reactive state only; this composable fetches, transforms,
// and pushes data into the store.
// ========================================

import type {
  GetTransactionsParams,
  TransactionsByDate,
  TransactionPagination,
  TransactionSummary,
  TransactionTypeFilter,
} from '~/types/economy/wallet'
import { createLogger } from '~/utils/logger'
import { useApi } from '../shared/useApi'

export function useTransactionData() {
  const store = useTransactionStore()
  const { api, normalizeError } = useApi()
  const log = createLogger('[useTransactionData]')

  // ========================================
  // Helpers
  // ========================================

  /**
   * Merge new transaction pages into store, de-duping by date + id.
   */
  function mergeTransactions(newData: TransactionsByDate[]): void {
    const existing = store.transactions.transactionsByDate

    for (const newDay of newData) {
      const existingDay = existing.find(d => d.date === newDay.date)

      if (existingDay) {
        const existingIds = new Set(existingDay.transactions.map(t => t.id))
        const uniqueNew = newDay.transactions.filter(t => !existingIds.has(t.id))
        existingDay.transactions.push(...uniqueNew)
      } else {
        existing.push(newDay)
      }
    }
  }

  // ========================================
  // Data Fetching
  // ========================================

  /**
   * Fetch transactions from API.
   * @param params - Query parameters for filtering
   * @param reset - If true, clears existing data before fetching
   */
  async function fetchTransactions(
    params: GetTransactionsParams = {},
    reset = false,
  ): Promise<void> {
    if (reset) {
      store.setTransactions([])
      store.setCursor(null)
      store.setCurrentPage(1)
      store.setHasMore(true)
    }

    if (!store.transactions.hasMore || store.transactions.loading) return

    store.setLoading(true)
    store.setError(null)

    try {
      const queryParams: Record<string, unknown> = {
        per_page: params.per_page ?? 20,
      }

      if (params.type && params.type !== 'all') {
        queryParams.type = params.type
      }
      if (store.transactions.cursor) {
        queryParams.cursor = store.transactions.cursor
      } else if (params.page) {
        queryParams.page = params.page
      }
      if (params.date_from) queryParams.date_from = params.date_from
      if (params.date_to) queryParams.date_to = params.date_to
      if (params.sort) queryParams.sort = params.sort

      const response = await api<{
        success: true
        data: {
          transactions_by_date: TransactionsByDate[]
          pagination: TransactionPagination
        }
      }>('/transactions', { params: queryParams })

      mergeTransactions(response.data.transactions_by_date)

      store.setCurrentPage(response.data.pagination.current_page)
      store.setHasMore(response.data.pagination.has_more)
      store.setCursor(response.data.pagination.next_cursor ?? null)
      store.setFilter(params.type ?? 'all')
    } catch (error) {
      const err = normalizeError(error)
      store.setError(err.message)
    } finally {
      store.setLoading(false)
    }
  }

  /**
   * Load next page of transactions.
   */
  async function loadMore(): Promise<void> {
    if (!store.transactions.hasMore || store.transactions.loading) return

    await fetchTransactions({
      type: store.currentFilter,
      cursor: store.transactions.cursor ?? undefined,
      page: store.transactions.cursor ? undefined : store.transactions.currentPage + 1,
    })
  }

  /**
   * Fetch transaction summary statistics.
   */
  async function fetchSummary(): Promise<void> {
    store.setSummaryLoading(true)

    try {
      const response = await api<{
        success: true
        data: TransactionSummary
      }>('/transactions/summary')

      store.setSummary(response.data)
    } catch (error) {
    } finally {
      store.setSummaryLoading(false)
    }
  }

  /**
   * Change filter and refetch.
   */
  async function changeFilter(filter: TransactionTypeFilter): Promise<void> {
    store.setFilter(filter)
    await fetchTransactions({ type: filter }, true)
  }

  return {
    fetchTransactions,
    loadMore,
    fetchSummary,
    changeFilter,
  }
}
