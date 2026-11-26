// ========================================
// Pretty ID Rare Auction test fixtures
// ========================================
// Plain data builders + a vi.fn() stand-in for the `PrettyIdAuctionApi` seam.
// Specs mock `~/composables/pretty-id/usePrettyIdAuctionApi` with this.

import { vi } from 'vitest'
import type {
  PrettyIdAuctionBid,
  PrettyIdAuctionBidResult,
  PrettyIdAuctionCard,
  PrettyIdAuctionEnterResult,
  PrettyIdAuctionList,
  PrettyIdAuctionMe,
  PrettyIdAuctionSnapshot,
  PrettyIdAuctionUser,
} from '../../app/types/pretty-id-auction'

/** Fixed "server now" used by the builders (ISO, ms precision). */
export const SERVER_NOW_ISO = '2026-11-26T10:00:00.000Z'
export const SERVER_NOW_MS = Date.parse(SERVER_NOW_ISO)
export const MINUTE = 60_000
export const HOUR = 60 * MINUTE

/** ISO time `deltaMs` after the fixed server-now. */
export function iso(deltaMs: number): string {
  return new Date(SERVER_NOW_MS + deltaMs).toISOString()
}

export function makeUser(id = 7, overrides: Partial<PrettyIdAuctionUser> = {}): PrettyIdAuctionUser {
  return { id, name: `User ${id}`, avatar: null, signature: `SIG${id}`, ...overrides }
}

export function makeBid(amount: number, user: PrettyIdAuctionUser = makeUser()): PrettyIdAuctionBid {
  return { user, amount, placed_at: iso(-MINUTE) }
}

export function makeCard(overrides: Partial<PrettyIdAuctionCard> = {}): PrettyIdAuctionCard {
  return {
    id: 1,
    rare_id: '007',
    state: 'live',
    starts_at: iso(-HOUR),
    ends_at: iso(5 * HOUR),
    entry_fee: 5_000,
    opening_bid: 100_000,
    keep_days: 7,
    top_bid: null,
    bidder_count: 0,
    ...overrides,
  }
}

export function makeList(auctions: PrettyIdAuctionCard[], serverNow = SERVER_NOW_ISO): PrettyIdAuctionList {
  return { server_now: serverNow, auctions }
}

/** A live auction ending in 5 hours with no bids. */
export function makeSnapshot(overrides: Partial<PrettyIdAuctionSnapshot> = {}): PrettyIdAuctionSnapshot {
  return {
    id: 1,
    rare_id: '007',
    state: 'live',
    starts_at: iso(-HOUR),
    planned_ends_at: iso(5 * HOUR),
    ends_at: iso(5 * HOUR),
    entry_fee: 5_000,
    opening_bid: 100_000,
    min_raise: 10_000,
    keep_days: 7,
    price_floor: null,
    min_next_bid: 100_000,
    leader: null,
    top_bids: [],
    bidder_count: 0,
    result: null,
    server_now: SERVER_NOW_ISO,
    ...overrides,
  }
}

export function makeMe(overrides: Partial<PrettyIdAuctionMe> = {}): PrettyIdAuctionMe {
  return { entered: false, disqualified: false, may_bid: false, ...overrides }
}

export function makeEnterResult(overrides: Partial<PrettyIdAuctionEnterResult> = {}): PrettyIdAuctionEnterResult {
  return { entered: true, disqualified: false, may_bid: true, fee_paid: 5_000, coins: 95_000, ...overrides }
}

export function makeBidResult(overrides: Partial<PrettyIdAuctionBidResult> = {}): PrettyIdAuctionBidResult {
  return { auction: makeSnapshot(), coins: 90_000, ...overrides }
}

/** One `vi.fn()` per `PrettyIdAuctionApi` method. Reset it in `beforeEach` with `resetAuctionApiMock`. */
export function createAuctionApiMock() {
  return {
    auctions: vi.fn(),
    auction: vi.fn(),
    auctionMe: vi.fn(),
    enter: vi.fn(),
    bid: vi.fn(),
  }
}

export type AuctionApiMock = ReturnType<typeof createAuctionApiMock>

/** Clears every call and gives each method a harmless default. */
export function resetAuctionApiMock(api: AuctionApiMock): void {
  for (const fn of Object.values(api)) fn.mockReset()
  api.auctions.mockResolvedValue(makeList([]))
  api.auction.mockResolvedValue(makeSnapshot())
  api.auctionMe.mockResolvedValue(makeMe())
  api.enter.mockResolvedValue(makeEnterResult())
  api.bid.mockResolvedValue(makeBidResult())
}
