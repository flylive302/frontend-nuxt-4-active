// ========================================
// Ranking Constants
// ========================================
// Static configuration for the global rankings page.
// No imports from stores or composables.
// ========================================

export const RANKING_CATEGORIES = ['wealth', 'charm', 'room', 'agency'] as const
export const RANKING_PERIODS = ['daily', 'weekly', 'monthly'] as const

export type RankingCategory = typeof RANKING_CATEGORIES[number]
export type RankingPeriod = typeof RANKING_PERIODS[number]

/** Number of entries surfaced from the top-100 backend snapshot. */
export const RANKING_TOP_N = 30

/**
 * Time-to-live for cached entries before a background refresh fires.
 * Matches the backend cache TTL ceiling (60s for per-user rank).
 */
export const RANKING_STALE_MS = 60 * 1000

export const CATEGORY_LABELS: Record<RankingCategory, string> = {
  wealth: 'Wealth',
  charm: 'Charm',
  room: 'Rooms',
  agency: 'Agencies',
}

export const PERIOD_LABELS: Record<RankingPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

export const CATEGORY_ICONS: Record<RankingCategory, string> = {
  wealth: 'i-lucide-coins',
  charm: 'i-lucide-heart',
  room: 'i-lucide-home',
  agency: 'i-lucide-building-2',
}

/** Composite key used in store maps. */
export function rankingKey(category: RankingCategory, period: RankingPeriod): string {
  return `${category}:${period}`
}
