// ========================================
// Lucky cashback float helpers (pure)
// ========================================

import {
  LUCKY_CASHBACK_SVGA_BASE_URL,
  LUCKY_CASHBACK_SVGA_TIERS,
  LUCKY_FLOAT_LANES_PCT,
} from '~/constants/lucky'

/**
 * Resolve the authored .svga tier for a multiplier. Exact tiers win; anything
 * between tiers falls back to the highest tier at or below it, so an unexpected
 * server value still renders. Returns null for ×0 / negatives (bust draws show
 * no animation at all).
 */
export function resolveCashbackTier(multiplier: number): number | null {
  if (!(multiplier > 0)) return null

  let tier: number | null = null
  for (const candidate of LUCKY_CASHBACK_SVGA_TIERS) {
    if (candidate <= multiplier) tier = candidate
  }

  // Wins below the lowest authored tier still deserve a visual: use the lowest.
  return tier ?? LUCKY_CASHBACK_SVGA_TIERS[0]
}

/** Full .svga URL for a multiplier, or null when nothing should render. */
export function resolveCashbackSvgaUrl(multiplier: number): string | null {
  const tier = resolveCashbackTier(multiplier)
  return tier === null ? null : `${LUCKY_CASHBACK_SVGA_BASE_URL}/${tier}.svga`
}

/** Display string for the multiplier placeholder, e.g. `×5` / `×2.5`. */
export function formatCashbackMultiplier(multiplier: number): string {
  const rounded = Number.isInteger(multiplier) ? String(multiplier) : multiplier.toFixed(2).replace(/0+$/, '')
  return `×${rounded}`
}

/**
 * Horizontal lane (percent) for a floater id. Consecutive ids walk the lane
 * list, which is ordered far-left → far-right, so a burst spreads across the
 * container instead of stacking in one spot.
 */
export function luckyFloatLanePct(id: number): number {
  const lanes = LUCKY_FLOAT_LANES_PCT
  const index = ((id % lanes.length) + lanes.length) % lanes.length
  return lanes[index] ?? lanes[0]
}
