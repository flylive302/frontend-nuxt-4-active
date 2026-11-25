/**
 * Pretty ID plate — plate vs plain decision for a profile's signature.
 *
 * The server sends `pretty_id_tier` (6 | 4) only while the user wears a Pretty
 * ID; `null`/absent means an original or mall signature (plain badge).
 */

import { PRETTY_ID_TIERS } from '~/constants/pretty-id'
import type { PrettyIdTier } from '~/types/pretty-id'

/** True when the signature should be drawn on the gold Pretty ID plate. */
export function showsPrettyIdPlate(tier: PrettyIdTier | null | undefined): tier is PrettyIdTier {
  return tier != null && PRETTY_ID_TIERS.includes(tier)
}
