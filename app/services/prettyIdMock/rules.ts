// ========================================
// Pretty ID mock backend — event rules
// ========================================
//
// The few numbers the mock plays by. Level thresholds are server-owned in the
// real API; here they live in one named constant.

import type { PrettyIdSlotKey } from '~/types/pretty-id'

/** Event rules. */
export const PRETTY_ID_MOCK_RULES = {
  slotLevel: { lv17: 17, lv34: 34 } satisfies Record<PrettyIdSlotKey, number>,
} as const
