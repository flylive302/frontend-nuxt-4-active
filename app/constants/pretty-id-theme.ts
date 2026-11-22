/**
 * Pretty ID theme — image custom properties.
 *
 * `<PrettyIdTheme>` spreads this onto its root as inline style, which is how
 * assets/css/pretty-id.css and the primitives' scoped styles get their frame
 * art (`background: var(--pid-img-panel-border)` …) without a single URL being
 * written in CSS. `PRETTY_ID_ASSETS` stays the only place a path lives.
 */

import { PRETTY_ID_ASSETS } from '~/constants/assets'
import type { PrettyIdFilterTier } from '~/constants/pretty-id'

const cssUrl = (path: string): string => `url("${path}")`

export const PRETTY_ID_THEME_VARS: Readonly<Record<`--pid-img-${string}`, string>> = {
  '--pid-img-marble': cssUrl(PRETTY_ID_ASSETS.marble),
  '--pid-img-panel-border': cssUrl(PRETTY_ID_ASSETS.panelBorder),
  '--pid-img-finial': cssUrl(PRETTY_ID_ASSETS.finial),
  '--pid-img-corner': cssUrl(PRETTY_ID_ASSETS.corner),
  '--pid-img-plaque': cssUrl(PRETTY_ID_ASSETS.plaque),
  '--pid-img-plaque-dim': cssUrl(PRETTY_ID_ASSETS.plaqueDim),
  '--pid-img-button': cssUrl(PRETTY_ID_ASSETS.button),
  '--pid-img-row': cssUrl(PRETTY_ID_ASSETS.row),
  '--pid-img-card': cssUrl(PRETTY_ID_ASSETS.card),
  '--pid-img-card2': cssUrl(PRETTY_ID_ASSETS.card2),
  '--pid-img-ring': cssUrl(PRETTY_ID_ASSETS.ring),
  '--pid-img-slip': cssUrl(PRETTY_ID_ASSETS.slip),
  '--pid-img-badge': cssUrl(PRETTY_ID_ASSETS.badge),
  '--pid-img-hero-poster': cssUrl(PRETTY_ID_ASSETS.heroPoster),
  '--pid-img-hero-plain': cssUrl(PRETTY_ID_ASSETS.heroPlain),
}

/** Tier → shield art, for the Choose tab filters. */
export const PRETTY_ID_TIER_SHIELD: Readonly<Record<PrettyIdFilterTier, string>> = {
  lucky: PRETTY_ID_ASSETS.shieldLucky,
  sequence: PRETTY_ID_ASSETS.shieldSequence,
  legend: PRETTY_ID_ASSETS.shieldLegend,
  mirror: PRETTY_ID_ASSETS.shieldMirror,
  couple: PRETTY_ID_ASSETS.shieldCouple,
}
