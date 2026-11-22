// ========================================
// Pretty ID — slot lookup
// ========================================
//
// An ID's digit count decides which level reward (slot) it belongs to: 6 digits
// fill the Lv 17 slot, 4 digits the Lv 34 slot. Anything else — including the
// 1–2 digit auction IDs — belongs to no slot.

import { PRETTY_ID_SLOT_KEYS, PRETTY_ID_SLOT_LENGTH } from '~/constants/pretty-id'
import type { PrettyIdSlotKey } from '~/types/pretty-id'

/** The slot an ID of this many digits fills, or `null` when it fits neither. */
export function prettyIdSlotKeyForLength(length: number): PrettyIdSlotKey | null {
  return PRETTY_ID_SLOT_KEYS.find(key => PRETTY_ID_SLOT_LENGTH[key] === length) ?? null
}
