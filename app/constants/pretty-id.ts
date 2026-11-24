/**
 * Pretty ID event (/pretty-id) constants — shared by the `pretty-id` layouts'
 * chrome, the event pages, the composables and the nav-direction plugin.
 *
 * Level thresholds are NOT here: they are server-owned and arrive on
 * `PrettyIdSlot.required_level`.
 */

import type { PrettyIdLength, PrettyIdSlotKey, PrettyIdTier } from '~/types/pretty-id'

// ========================================
// Routes
// ========================================

export const PRETTY_ID_ROUTES = {
  choose: '/pretty-id',
  auction: '/pretty-id/auction',
  search: '/pretty-id/search',
} as const

/**
 * Tab bar under the hero, in on-screen left → right order. The order is
 * load-bearing: plugins/nav-direction.client.ts derives the slide direction
 * between sibling tabs from it.
 */
export const PRETTY_ID_TABS = [
  { to: PRETTY_ID_ROUTES.choose, label: 'Choose ID' },
  { to: PRETTY_ID_ROUTES.auction, label: 'Rare Auction' },
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
// Sizes
// ========================================

/** IDs shown in the Choose grid (the header still reports the full count). */
export const PRETTY_ID_LIST_PAGE_SIZE = 30

/** Alternative IDs offered when a searched / raced ID is gone. */
export const PRETTY_ID_SUGGESTION_LIMIT = 6

/** Longest ID the search box accepts. */
export const PRETTY_ID_SEARCH_MAX_LENGTH = 6
