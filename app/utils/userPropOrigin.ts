// ========================================
// User Prop Origin Helpers (pure)
// ========================================
// Shared by MyPropCard and MyPropDetailModal (My Props).
// pretty-id 06: the user's original Signature is a permanent prop that is the
// fallback every other Signature switches back to — it can be equipped but
// never unequipped (the server answers 422 `original_signature_locked`).

import type { UserProp } from '~/types/mall/prop'

type UserPropOrigin = Pick<UserProp, 'origin'>

/** Backend `error_code` for an unequip attempt on the original Signature. */
export const ORIGINAL_SIGNATURE_LOCKED_CODE = 'original_signature_locked'

/** Friendly text for that refusal. */
export const ORIGINAL_SIGNATURE_LOCKED_MESSAGE =
  'Your original signature can\'t be unequipped. Equip another signature to switch.'

/** Whether this row is the user's original Signature. */
export function isOriginalSignature(userProp: UserPropOrigin): boolean {
  return userProp.origin === 'original_signature'
}

/** Whether an Unequip button may be shown for this row (equipped, and not the original). */
export function canUnequipUserProp(userProp: UserPropOrigin & Pick<UserProp, 'is_equipped'>): boolean {
  return userProp.is_equipped && !isOriginalSignature(userProp)
}
