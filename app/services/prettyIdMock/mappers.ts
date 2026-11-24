// ========================================
// Pretty ID mock backend — response mappers
// ========================================
//
// Persisted data → the `PrettyIdApi` response shapes. Pure: no mutation, no
// rules beyond display.

import { PRETTY_ID_SLOT_LENGTH } from '~/constants/pretty-id'
import { PRETTY_ID_MOCK_RULES } from '~/services/prettyIdMock/rules'
import type { MockData } from '~/services/prettyIdMock/state'
import type { PrettyIdMe, PrettyIdSlot, PrettyIdSlotKey } from '~/types/pretty-id'

function slotView(data: MockData, key: PrettyIdSlotKey): PrettyIdSlot {
  const requiredLevel = PRETTY_ID_MOCK_RULES.slotLevel[key]
  return {
    key,
    required_level: requiredLevel,
    length: PRETTY_ID_SLOT_LENGTH[key],
    unlocked: data.level >= requiredLevel,
    id: data.slots[key]?.id ?? null,
  }
}

export function buildMe(data: MockData): PrettyIdMe {
  return {
    server_now: new Date().toISOString(),
    level: data.level,
    slots: { lv17: slotView(data, 'lv17'), lv34: slotView(data, 'lv34') },
  }
}
