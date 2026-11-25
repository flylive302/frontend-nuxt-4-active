/**
 * Pretty ID event (/pretty-id) constants — shared by the `pretty-id` layout's
 * chrome, the event pages, the composables and the nav-direction plugin.
 *
 * Level thresholds are NOT here: they are server-owned and arrive on
 * `PrettyIdTierState.required_level`.
 */

import type { PrettyIdCategory, PrettyIdTier } from '~/types/pretty-id'

// ========================================
// Routes
// ========================================

export const PRETTY_ID_ROUTES = {
  /** Entry-only: redirects to the landing tab (utils/pretty-id-tabs.ts). Link here to "enter the event". */
  entry: '/pretty-id',
  /** The Choose ID tab. A stable path that never redirects, so back-navigation lands here untouched. */
  choose: '/pretty-id/choose',
  auction: '/pretty-id/auction',
} as const

/** Outside the event: the wealth levels page ("How to level up"). */
export const PRETTY_ID_LEVELS_ROUTE = '/levels/wealth'

/** Outside the event: My Props, opened on the signature tab ("View in My Props"). */
export const PRETTY_ID_MY_PROPS_ROUTE = { path: '/mall/my-props', query: { type: 'signature' } } as const

/** Where the top-bar back button leaves the event from a tab page. */
export const PRETTY_ID_EXIT_ROUTE = '/'

/** Status-bar / browser chrome colour while the event is open (matches the top-bar scrim). */
export const PRETTY_ID_THEME_COLOR = '#1a0828'

// ========================================
// Tiers
// ========================================

/** Both tiers, in tier-switch order (6-character first). */
export const PRETTY_ID_TIERS: readonly PrettyIdTier[] = [6, 4]

/** The tier the Choose tab opens on. */
export const PRETTY_ID_DEFAULT_TIER: PrettyIdTier = 6

/** The 4-character tier gets the "Elite" celebration. */
export const PRETTY_ID_ELITE_TIER: PrettyIdTier = 4

// ========================================
// Categories
// ========================================

export const PRETTY_ID_CATEGORY_LABEL: Record<PrettyIdCategory, string> = {
  legend: 'Legend',
  couple: 'Couple',
  lucky: 'Lucky',
  sequence: 'Sequence',
  mirror: 'Mirror',
}

/** The five shield filters on the Choose tab, in on-screen left → right order. */
export const PRETTY_ID_CATEGORIES: readonly PrettyIdCategory[] = ['lucky', 'sequence', 'legend', 'mirror', 'couple']
