// ========================================
// Ranking Store
// ========================================
// State + setters ONLY. All API calls and business logic live in
// useRankingData. Per architecture rules, stores never call the API.
// ========================================

import { defineStore } from 'pinia'
import type { RankingEntry, CurrentUserRank } from '~/types/ranking'
import type { RankingCategory, RankingPeriod } from '~/constants/ranking'
import { rankingKey } from '~/constants/ranking'

interface SliceMeta {
  /** ISO timestamp from the backend snapshot the entries were built from. */
  updatedAt: string | null
  /** `Date.now()` when this slice was last fetched (used for staleness checks). */
  fetchedAt: number
}

export const useRankingStore = defineStore('ranking', () => {
  // ========================================
  // State
  // ========================================

  const entriesByKey = ref<Record<string, RankingEntry[]>>({})
  const currentUserByKey = ref<Record<string, CurrentUserRank | null>>({})
  const metaByKey = ref<Record<string, SliceMeta>>({})

  /** Slice keys currently in flight, used to coalesce concurrent fetches. */
  const loadingKeys = ref<Set<string>>(new Set())
  /** Last error per slice; cleared on a successful fetch. */
  const errorByKey = ref<Record<string, string | null>>({})

  // ========================================
  // Getters
  // ========================================

  function getEntries(category: RankingCategory, period: RankingPeriod): RankingEntry[] {
    return entriesByKey.value[rankingKey(category, period)] ?? []
  }

  function getCurrentUser(category: RankingCategory, period: RankingPeriod): CurrentUserRank | null {
    return currentUserByKey.value[rankingKey(category, period)] ?? null
  }

  function getMeta(category: RankingCategory, period: RankingPeriod): SliceMeta | undefined {
    return metaByKey.value[rankingKey(category, period)]
  }

  function isLoading(category: RankingCategory, period: RankingPeriod): boolean {
    return loadingKeys.value.has(rankingKey(category, period))
  }

  function getError(category: RankingCategory, period: RankingPeriod): string | null {
    return errorByKey.value[rankingKey(category, period)] ?? null
  }

  // ========================================
  // Setters
  // ========================================

  function setSlice(
    category: RankingCategory,
    period: RankingPeriod,
    entries: RankingEntry[],
    currentUser: CurrentUserRank | null,
    updatedAt: string | null,
  ): void {
    const key = rankingKey(category, period)
    entriesByKey.value[key] = entries
    currentUserByKey.value[key] = currentUser
    metaByKey.value[key] = { updatedAt, fetchedAt: Date.now() }
    errorByKey.value[key] = null
  }

  function setLoading(category: RankingCategory, period: RankingPeriod, value: boolean): void {
    const key = rankingKey(category, period)
    if (value) {
      loadingKeys.value.add(key)
    } else {
      loadingKeys.value.delete(key)
    }
    // Force reactivity on a Set ref.
    loadingKeys.value = new Set(loadingKeys.value)
  }

  function setError(category: RankingCategory, period: RankingPeriod, message: string | null): void {
    errorByKey.value[rankingKey(category, period)] = message
  }

  function reset(): void {
    entriesByKey.value = {}
    currentUserByKey.value = {}
    metaByKey.value = {}
    loadingKeys.value = new Set()
    errorByKey.value = {}
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    entriesByKey,
    currentUserByKey,
    metaByKey,
    loadingKeys,
    errorByKey,

    // Getters
    getEntries,
    getCurrentUser,
    getMeta,
    isLoading,
    getError,

    // Setters
    setSlice,
    setLoading,
    setError,
    reset,
  }
})
