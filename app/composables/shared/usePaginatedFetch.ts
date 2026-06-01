// ========================================
// Shared Paginated Fetch Composable
// ========================================

import type { Ref } from 'vue'
import type { PaginatedList } from '~/types/shared'
import { createPaginatedList } from '~/types/shared'

// ========================================
// Types
// ========================================

/** Result shape returned by the fetcher callback */
export interface PaginatedFetchResult<T> {
  items: T[]
  hasMore: boolean
  cursor: string | null
}

/** Options for the paginated fetch composable */
export interface PaginatedFetchOptions {
  /** Logger label for error reporting (e.g., '[BadgesCatalog]') */
  logLabel?: string
}

// ========================================
// Composable
// ========================================

/**
 * Shared composable for cursor-paginated fetching.
 * Eliminates 8 copy-pasted fetch functions across stores (~200 lines of DRY violation).
 *
 * @param list - Reactive ref to a PaginatedList<T> in a store
 * @param fetcher - Async function that takes a cursor and returns the next page
 * @param options - Optional configuration
 *
 * @example
 * ```ts
 * const catalog = ref<PaginatedList<Badge>>(createPaginatedList())
 *
 * const { fetch: fetchCatalog } = usePaginatedFetch(
 *   catalog,
 *   async (cursor) => {
 *     const res = await api<{ data: Badge[] }>('/badges', { params: { cursor } })
 *     return { items: res.data, hasMore: false, cursor: null }
 *   },
 *   { logLabel: '[BadgesCatalog]' }
 * )
 *
 * await fetchCatalog()       // first page
 * await fetchCatalog(true)   // reset and refetch
 * ```
 */
export function usePaginatedFetch<T>(
  list: Ref<PaginatedList<T>>,
  fetcher: (cursor: string | null) => Promise<PaginatedFetchResult<T>>,
  options: PaginatedFetchOptions = {}
) {
  const log = createLogger(options.logLabel ?? '[PaginatedFetch]')

  /**
   * Fetch the next page (or reset and fetch the first page).
   *
   * @param reset - If true, clears existing items and restarts from cursor=null
   */
  async function fetch(reset = false): Promise<void> {
    if (reset) {
      const fresh = createPaginatedList<T>()
      list.value.items = fresh.items
      list.value.cursor = fresh.cursor
      list.value.hasMore = fresh.hasMore
      list.value.error = fresh.error
    }

    if (!list.value.hasMore || list.value.loading) return

    list.value.loading = true
    list.value.error = null

    try {
      const result = await fetcher(list.value.cursor)
      list.value.items.push(...result.items)
      list.value.hasMore = result.hasMore
      list.value.cursor = result.cursor
    } catch (err) {
      log.warn('Paginated fetch failed', err)
      const { normalizeError } = useApi()
      const normalized = normalizeError(err)
      list.value.error = normalized.message
    } finally {
      list.value.loading = false
    }
  }

  return { fetch }
}
