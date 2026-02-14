// ========================================
// Shared Types & Factories
// ========================================

/**
 * Generic paginated list state.
 * Replaces 6 duplicated interfaces (BadgeListState, UserBadgeListState,
 * CatalogState, UserPropsState, HistoryState, RewardListState).
 *
 * @template T - The item type in the list
 */
export interface PaginatedList<T> {
  /** Items loaded so far (accumulates across pages) */
  items: T[]
  /** Whether a fetch is in progress */
  loading: boolean
  /** Error message from the last failed fetch */
  error: string | null
  /** Whether there are more pages to fetch */
  hasMore: boolean
  /** Server cursor for the next page */
  cursor: string | null
}

/**
 * Factory to create a fresh PaginatedList with default values.
 * Eliminates 6 duplicated reset object literals across stores.
 */
export function createPaginatedList<T>(): PaginatedList<T> {
  return {
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  }
}
