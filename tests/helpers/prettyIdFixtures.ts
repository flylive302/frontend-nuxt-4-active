// ========================================
// Pretty ID test fixtures
// ========================================
// Plain data builders + a vi.fn() stand-in for the `PrettyIdApi` seam. Specs
// mock `~/composables/pretty-id/usePrettyIdApi` with this, so none of them
// depend on the real mock backend.

import { vi } from 'vitest'
import type {
  PrettyIdBid,
  PrettyIdLot,
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
    claimed_at: null,
    change_tokens: 0,
    next_change_at: null,
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
    user: { id: 1, name: 'Ana', avatar_url: null },
    level: 20,
    coins: 100_000,
    slots: {
      lv17: makeSlot('lv17', slots.lv17),
      lv34: makeSlot('lv34', { unlocked: false, ...slots.lv34 }),
    },
    auction_ids: [],
    rules: {
      entry_fee: 1_000,
      opening_bid: 10_000,
      min_increment: 1_000,
      ownership_days: 30,
      change_cooldown_hours: 24,
      min_level_auction: 10,
    },
    ...overrides,
  }
}

export function makeBid(name: string, amount: number, isMe = false): PrettyIdBid {
  return { user: { id: isMe ? 1 : 9, name, avatar_url: null }, amount, at: SERVER_NOW, is_me: isMe }
}

export function makeLot(id: number, overrides: Partial<PrettyIdLot> = {}): PrettyIdLot {
  return {
    id,
    number: String(id),
    status: 'live',
    starts_at: '2026-11-21T00:00:00.000Z',
    ends_at: '2026-11-22T00:00:00.000Z',
    entry_fee: 1_000,
    opening_bid: 10_000,
    min_increment: 1_000,
    highest_bid: null,
    min_next_bid: 10_000,
    entered: false,
    you_are_highest: false,
    winner: null,
    winning_bid: null,
    top_bids: [],
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
    change: vi.fn(),
    auctions: vi.fn(),
    auction: vi.fn(),
    enter: vi.fn(),
    bid: vi.fn(),
    winners: vi.fn(),
    weekly: vi.fn(),
  }
}

export type ApiMock = ReturnType<typeof createApiMock>

/** Clears every call and gives the methods that every flow touches a harmless default. */
export function resetApiMock(api: ApiMock): void {
  for (const fn of Object.values(api)) fn.mockReset()
  api.me.mockResolvedValue(makeMe())
  api.list.mockResolvedValue({ items: [], total: 0 })
  api.auctions.mockResolvedValue([])
}
