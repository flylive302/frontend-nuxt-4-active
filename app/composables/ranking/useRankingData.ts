/**
 * Ranking Data Composable
 *
 * Fetches the global ranking slice for a (category, period) tuple from
 * GET /api/v1/rankings, persists it in the ranking store, and exposes
 * reactive accessors keyed by the active selection.
 *
 * Cache strategy: the store keeps every viewed slice in memory; this
 * composable only refetches when older than RANKING_STALE_MS or never
 * loaded.
 */

import { useApi } from '../shared/useApi'
import { useRankingStore } from '~/stores/ranking'
import type { RankingApiResponse } from '~/types/ranking'
import type { RankingCategory, RankingPeriod } from '~/constants/ranking'
import { RANKING_STALE_MS } from '~/constants/ranking'
import { createLogger } from '~/utils/logger'

const log = createLogger('[Ranking]')

export function useRankingData() {
  const { api, normalizeError } = useApi()
  const store = useRankingStore()

  // ========================================
  // Fetch
  // ========================================

  /**
   * Fetch a (category, period) slice and write it into the store.
   * Coalesces concurrent calls for the same slice.
   */
  async function fetch(category: RankingCategory, period: RankingPeriod): Promise<void> {
    if (store.isLoading(category, period)) {
      return
    }

    store.setLoading(category, period, true)

    try {
      const response = await api<RankingApiResponse>('/rankings', {
        method: 'GET',
        params: { category, period },
      })

      const data = response.data
      store.setSlice(
        category,
        period,
        data.entries,
        data.current_user,
        data.updated_at,
      )
    } catch (err) {
      const normalized = normalizeError(err)
      store.setError(category, period, normalized.message)
    } finally {
      store.setLoading(category, period, false)
    }
  }

  /**
   * Load the slice if it has never been fetched, or refetch it if the
   * cached copy is older than RANKING_STALE_MS.
   */
  async function ensureLoaded(category: RankingCategory, period: RankingPeriod): Promise<void> {
    const meta = store.getMeta(category, period)
    if (meta && Date.now() - meta.fetchedAt < RANKING_STALE_MS) {
      return
    }
    await fetch(category, period)
  }

  /** Force a refetch ignoring freshness. */
  async function refresh(category: RankingCategory, period: RankingPeriod): Promise<void> {
    await fetch(category, period)
  }

  // ========================================
  // Reactive Views
  // ========================================

  /**
   * Build computed views bound to a reactive (category, period). Pass
   * getters so the views track the page's URL-driven selection.
   */
  function bindToSelection(
    categoryGetter: () => RankingCategory,
    periodGetter: () => RankingPeriod,
  ) {
    const entries = computed(() => store.getEntries(categoryGetter(), periodGetter()))
    const currentUser = computed(() => store.getCurrentUser(categoryGetter(), periodGetter()))
    const updatedAt = computed(() => store.getMeta(categoryGetter(), periodGetter())?.updatedAt ?? null)
    const isLoading = computed(() => store.isLoading(categoryGetter(), periodGetter()))
    const error = computed(() => store.getError(categoryGetter(), periodGetter()))

    return { entries, currentUser, updatedAt, isLoading, error }
  }

  return {
    fetch,
    ensureLoaded,
    refresh,
    bindToSelection,
  }
}
