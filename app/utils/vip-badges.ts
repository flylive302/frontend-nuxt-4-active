// ========================================
// VIP Badge Collection Helpers
// ========================================
// Pure helpers for deriving badge display lists from VIP level data.

import type { VipBadge, VipLevel } from '~/types/vip/vip-level'

/**
 * Collect badges CUMULATIVELY across every level at or below `targetLevel`.
 * Purchasing a VIP tier grants every lower tier's badges too (surprise reveal
 * in the congrats modal), unlike props which are shown per-level only.
 */
export function collectCumulativeBadges(levels: VipLevel[], targetLevel: number): VipBadge[] {
  return levels
    .filter(l => l.level <= targetLevel)
    .flatMap(l => l.badges ?? [])
}
