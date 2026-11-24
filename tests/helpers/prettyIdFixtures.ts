// ========================================
// Pretty ID test fixtures
// ========================================
// Plain data builders + a vi.fn() stand-in for the `PrettyIdApi` seam. Specs
// mock `~/composables/pretty-id/usePrettyIdApi` with this, so none of them
// depend on the real mock backend.

import { vi } from 'vitest'
import type {
  PrettyIdMe,
  PrettyIdSlot,
  PrettyIdSlotKey,
} from '../../app/types/pretty-id'

/** `PrettyIdMe.server_now` of every fixture; specs pin the device clock to it for a zero offset. */
export const SERVER_NOW = '2026-11-21T10:00:00.000Z'

export function makeSlot(key: PrettyIdSlotKey, overrides: Partial<PrettyIdSlot> = {}): PrettyIdSlot {
  const isLv17 = key === 'lv17'
  return {
    key,
    required_level: isLv17 ? 17 : 34,
    length: isLv17 ? 6 : 4,
    unlocked: true,
    id: null,
    ...overrides,
  }
}

export interface SlotOverrides {
  lv17?: Partial<PrettyIdSlot>
  lv34?: Partial<PrettyIdSlot>
}

/** Level 20: the Lv 17 slot is unlocked and empty, the Lv 34 slot is locked. */
export function makeMe(overrides: Partial<PrettyIdMe> = {}, slots: SlotOverrides = {}): PrettyIdMe {
  return {
    server_now: SERVER_NOW,
    level: 20,
    slots: {
      lv17: makeSlot('lv17', slots.lv17),
      lv34: makeSlot('lv34', { unlocked: false, ...slots.lv34 }),
    },
    ...overrides,
  }
}

/** One `vi.fn()` per `PrettyIdApi` method. Reset it in `beforeEach` with `resetApiMock`. */
export function createApiMock() {
  return {
    me: vi.fn(),
    list: vi.fn(),
    search: vi.fn(),
    claim: vi.fn(),
  }
}

export type ApiMock = ReturnType<typeof createApiMock>

/** Clears every call and gives the methods that every flow touches a harmless default. */
export function resetApiMock(api: ApiMock): void {
  for (const fn of Object.values(api)) fn.mockReset()
  api.me.mockResolvedValue(makeMe())
  api.list.mockResolvedValue({ items: [], total: 0 })
}
