/**
 * Pretty ID event (/pretty-id) constants — shared by the `pretty-id` layouts'
 * chrome, the event pages, the composables and the nav-direction plugin.
 *
 * Fees, cooldowns and level thresholds are NOT here: they are server-owned and
 * arrive on `PrettyIdMe.rules` / `PrettyIdSlot.required_level`.
 */

import type { PrettyIdLength, PrettyIdSlotKey, PrettyIdTier } from '~/types/pretty-id'

// ========================================
// Routes
// ========================================

export const PRETTY_ID_ROUTES = {
  choose: '/pretty-id',
  auction: '/pretty-id/auction',
  my: '/pretty-id/my',
  search: '/pretty-id/search',
  winners: '/pretty-id/winners',
  weekly: '/pretty-id/weekly',
} as const

/**
 * Tab bar under the hero, in on-screen left → right order. The order is
 * load-bearing: plugins/nav-direction.client.ts derives the slide direction
 * between sibling tabs from it.
 */
export const PRETTY_ID_TABS = [
  { to: PRETTY_ID_ROUTES.choose, label: 'Choose ID' },
  { to: PRETTY_ID_ROUTES.auction, label: 'Rare Auction' },
  { to: PRETTY_ID_ROUTES.my, label: 'My ID' },
] as const

/** Where the top-bar back button leaves the event from a tab page. */
export const PRETTY_ID_EXIT_ROUTE = '/'

/** Status-bar / browser chrome colour while the event is open (matches the top-bar scrim). */
export const PRETTY_ID_THEME_COLOR = '#1a0828'

// ========================================
// Slots
// ========================================

export const PRETTY_ID_SLOT_KEYS: readonly PrettyIdSlotKey[] = ['lv17', 'lv34']

/** Digit count each slot hands out. */
export const PRETTY_ID_SLOT_LENGTH: Record<PrettyIdSlotKey, PrettyIdLength> = { lv17: 6, lv34: 4 }

/** Inverse of `PRETTY_ID_SLOT_LENGTH`: which slot an ID of this length belongs to. */
export const PRETTY_ID_LENGTH_SLOT: Record<PrettyIdLength, PrettyIdSlotKey> = { 6: 'lv17', 4: 'lv34' }

export const PRETTY_ID_SLOT_LABEL: Record<PrettyIdSlotKey, string> = {
  lv17: '6-digit · Lv 17',
  lv34: '4-digit · Lv 34',
}

// ========================================
// Tiers
// ========================================

export const PRETTY_ID_TIER_LABEL: Record<PrettyIdTier, string> = {
  legend: 'Legend',
  couple: 'Couple',
  lucky: 'Lucky',
  sequence: 'Sequence',
  mirror: 'Mirror',
  repeat: 'Repeat',
  standard: 'Classic',
}

/**
 * The five shield filters on the Choose tab, in on-screen left → right order.
 * Only these tiers have shield art (`PRETTY_ID_TIER_SHIELD`); `repeat` and
 * `standard` are never offered as a filter.
 */
export const PRETTY_ID_TIER_FILTERS = ['lucky', 'sequence', 'legend', 'mirror', 'couple'] as const satisfies readonly PrettyIdTier[]

export type PrettyIdFilterTier = (typeof PRETTY_ID_TIER_FILTERS)[number]

// ========================================
// Sizes & timing
// ========================================

/** IDs shown in the Choose grid (the header still reports the full count). */
export const PRETTY_ID_LIST_PAGE_SIZE = 30

/** Alternative IDs offered when a searched / raced ID is gone. */
export const PRETTY_ID_SUGGESTION_LIMIT = 6

/** Longest ID the search box accepts. */
export const PRETTY_ID_SEARCH_MAX_LENGTH = 6

/** Quick-add chips next to the bid input. */
export const PRETTY_ID_BID_INCREMENTS: readonly number[] = [50_000, 100_000, 500_000]

/** Bidders listed on a lot page. */
export const PRETTY_ID_LOT_BIDDERS_SHOWN = 8

/** Weeks listed on the Weekly Record page. */
export const PRETTY_ID_WEEKLY_ROWS_SHOWN = 8

/** Countdown repaint cadence. */
export const PRETTY_ID_CLOCK_TICK_MS = 1_000

/** How often an open lot page refetches its auction (bids, anti-snipe extension, settlement). */
export const PRETTY_ID_LOT_POLL_MS = 7_000

/** How often the auction grid refetches while visible. */
export const PRETTY_ID_LOTS_POLL_MS = 15_000

// ========================================
// Time units
// ========================================

export const PRETTY_ID_HOUR_MS = 3_600_000
export const PRETTY_ID_DAY_MS = 86_400_000
