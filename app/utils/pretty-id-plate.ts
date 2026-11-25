/**
 * Pretty ID plate — plate vs plain decision for a profile's signature.
 *
 * The server sends `has_pretty_id_plate` (true while the user wears a claimed
 * Pretty ID OR a Rare ID); `false`/absent means an original or mall signature
 * (plain badge). `pretty_id_tier` is NOT used here: it is null for a Rare ID.
 */

/** True when the signature should be drawn on the gold Pretty ID plate. */
export function showsPrettyIdPlate(hasPlate: boolean | null | undefined): boolean {
  return hasPlate === true
}
