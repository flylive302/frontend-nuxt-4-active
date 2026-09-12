// ========================================
// Transaction Activity List Composable (Data derivation)
// ========================================
// Flattens day-grouped transactions into one heterogeneous list (header +
// transaction items) that the activity page renders as a plain list.
// Collapse state is a Set of collapsed dates; collapsing a day removes its
// transaction items from the flattened list while keeping its header item.
// Expanded rows are a Set of transaction ids owned here, not in the row.
// ========================================

import type { Ref } from 'vue'
import type { Transaction, TransactionsByDate } from '~/types/economy/wallet'

// ========================================
// Constants
// ========================================

const HEADER_KEY_PREFIX = 'header-'
const TRANSACTION_KEY_PREFIX = 'tx-'

// ========================================
// Types
// ========================================

export interface ActivityHeaderItem {
  type: 'header'
  key: string
  date: string
  dateFormatted: string
  collapsed: boolean
}

export interface ActivityTransactionItem {
  type: 'transaction'
  key: string
  transaction: Transaction
  expanded: boolean
}

export type ActivityListItem = ActivityHeaderItem | ActivityTransactionItem

// ========================================
// Composable
// ========================================

export function useTransactionActivityList(
  transactionsByDate: Ref<TransactionsByDate[]> | (() => TransactionsByDate[]),
) {
  // ========================================
  // State
  // ========================================

  const collapsedDates = ref<Set<string>>(new Set())

  // Expanded rows live here, keyed by transaction id, so they survive
  // list re-renders (pagination merges) and are trivially testable.
  const expandedIds = ref<Set<string>>(new Set())

  // ========================================
  // Computed
  // ========================================

  const items = computed<ActivityListItem[]>(() => {
    const days = typeof transactionsByDate === 'function' ? transactionsByDate() : transactionsByDate.value
    const flattened: ActivityListItem[] = []

    for (const day of days) {
      const collapsed = collapsedDates.value.has(day.date)

      flattened.push({
        type: 'header',
        key: `${HEADER_KEY_PREFIX}${day.date}`,
        date: day.date,
        dateFormatted: day.date_formatted,
        collapsed,
      })

      if (collapsed) continue

      for (const transaction of day.transactions) {
        flattened.push({
          type: 'transaction',
          key: `${TRANSACTION_KEY_PREFIX}${transaction.id}`,
          transaction,
          expanded: expandedIds.value.has(transaction.id),
        })
      }
    }

    return flattened
  })

  // ========================================
  // Actions
  // ========================================

  /**
   * Toggle collapse state for a given day's date.
   */
  function toggleDate(date: string): void {
    const next = new Set(collapsedDates.value)
    if (next.has(date)) {
      next.delete(date)
    } else {
      next.add(date)
    }
    collapsedDates.value = next
  }

  /**
   * Toggle the expanded details of one transaction row.
   */
  function toggleExpanded(transactionId: string): void {
    const next = new Set(expandedIds.value)
    if (next.has(transactionId)) {
      next.delete(transactionId)
    } else {
      next.add(transactionId)
    }
    expandedIds.value = next
  }

  /**
   * Whether a given day's date is currently collapsed.
   */
  function isCollapsed(date: string): boolean {
    return collapsedDates.value.has(date)
  }

  return {
    items,
    collapsedDates,
    expandedIds,
    toggleDate,
    toggleExpanded,
    isCollapsed,
  }
}
