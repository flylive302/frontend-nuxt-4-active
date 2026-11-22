// ========================================
// Pretty ID mock backend — entering, bidding and rival-bot tests
// ========================================
//
// See `tests/helpers/prettyIdMockHarness.ts` for the shared environment (pinned clock,
// localStorage stub, scripted RNG).

import { describe, it, expect, vi } from 'vitest'
import {
  ENTRY_FEE,
  HOUR,
  LOT_7_ENDS_AFTER,
  MINUTE,
  MIN_INCREMENT,
  NOON,
  OPENING_BID,
  PROFILE,
  SECOND,
  START_COINS,
  lotOf,
  make,
  refusal,
  scriptedRandom,
  useMockBackendEnvironment,
} from '../helpers/prettyIdMockHarness'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

useMockBackendEnvironment()

describe('enter', () => {
  it('charges the non-refundable entry fee once', async () => {
    const { api } = make()
    const result = await api.enter(8)

    expect(result.coins).toBe(START_COINS - ENTRY_FEE)
    expect(result.auction).toMatchObject({ id: 8, entered: true })
    expect((await refusal(api.enter(8))).code).toBe('already_entered')
    expect((await api.me()).coins).toBe(START_COINS - ENTRY_FEE)
  })

  it('needs Lv 17 and enough coins', async () => {
    const { api, controls } = make()
    controls.setLevel(5)
    const level = await refusal(api.enter(8))
    expect(level.code).toBe('level_required')
    expect(level.message).toBe('Reach Lv 17 to join auctions')

    controls.setLevel(17)
    controls.addCoins(0)
    const broke = await refusal(api.enter(8))
    expect(broke.code).toBe('insufficient_coins')
    expect(broke.message).toBe('Not enough coins for the 2,000 entry fee')
  })

  it('refuses an unknown lot', async () => {
    const { api } = make()
    expect((await refusal(api.enter(1234))).code).toBe('not_found')
    expect((await refusal(api.auction(1234))).code).toBe('not_found')
  })
})

describe('bid', () => {
  it('escrows the whole bid and makes the user the highest bidder', async () => {
    const { api } = make()
    await api.enter(8)
    const result = await api.bid(8, OPENING_BID)

    expect(result.coins).toBe(START_COINS - ENTRY_FEE - OPENING_BID)
    expect(result.auction).toMatchObject({
      highest_bid: OPENING_BID,
      min_next_bid: OPENING_BID + MIN_INCREMENT,
      you_are_highest: true,
    })
    expect(result.auction.top_bids[0]).toMatchObject({ amount: OPENING_BID, is_me: true })
    expect(result.auction.top_bids[0]?.user).toEqual({ id: PROFILE.id, name: PROFILE.name, avatar_url: PROFILE.avatar_url })
    expect((await api.me()).coins).toBe(START_COINS - ENTRY_FEE - OPENING_BID)
  })

  it('keeps every bid, highest first', async () => {
    // Draws per lot: 7 (user leads) 2, 8 (empty) 2, 9 (rival leads) 3, 66 (empty) 2, 88 (rival leads) 3, 99 (empty) 2.
    const rng = scriptedRandom(Array<number>(14).fill(0.99))
    const { api, controls } = make(rng.random)
    await api.enter(7)
    await api.bid(7, OPENING_BID + MIN_INCREMENT)
    controls.rivalBidsNow()
    expect(rng.remaining()).toBe(0)
    const lot = await lotOf(api, 7)

    expect(lot.top_bids.map(b => b.amount)).toEqual([1_400_000, 1_250_000, 1_200_000])
    expect(lot.top_bids.map(b => b.is_me)).toEqual([false, true, false])
  })

  it('refuses a bid below the minimum', async () => {
    const { api } = make()
    await api.enter(8)
    const opening = await refusal(api.bid(8, OPENING_BID - 1))
    expect(opening.code).toBe('bid_too_low')
    expect(opening.message).toBe('Minimum bid is 1,200,000')

    await api.enter(7)
    const raise = await refusal(api.bid(7, OPENING_BID + MIN_INCREMENT - 1))
    expect(raise.message).toBe('Minimum bid is 1,250,000')
  })

  it('refuses a bid before the entry fee is paid', async () => {
    const { api } = make()
    const error = await refusal(api.bid(8, OPENING_BID))
    expect(error.code).toBe('entry_required')
    expect(error.message).toBe('Pay the entry fee first')
  })

  it('refuses to outbid yourself', async () => {
    const { api } = make()
    await api.enter(8)
    await api.bid(8, OPENING_BID)
    const error = await refusal(api.bid(8, OPENING_BID + MIN_INCREMENT))

    expect(error.code).toBe('already_highest')
    expect(error.message).toBe('You are already the highest bidder')
    expect((await api.me()).coins).toBe(START_COINS - ENTRY_FEE - OPENING_BID)
  })

  it('refuses a bid the balance cannot escrow', async () => {
    const { api, controls } = make()
    await api.enter(8)
    controls.addCoins(0)
    const error = await refusal(api.bid(8, OPENING_BID))

    expect(error.code).toBe('insufficient_coins')
    expect(error.message).toBe('Not enough coins (escrow 1,200,000)')
  })

  it('refuses fractional or non-finite amounts', async () => {
    const { api } = make()
    await api.enter(8)
    expect((await refusal(api.bid(8, OPENING_BID + 0.5))).code).toBe('invalid')
    expect((await refusal(api.bid(8, Number.NaN))).code).toBe('invalid')
  })

  it('refunds the escrow when a rival outbids the user', async () => {
    const rng = scriptedRandom(Array<number>(15).fill(0.99))
    const { api, controls } = make(rng.random)
    await api.enter(8)
    await api.bid(8, OPENING_BID)
    expect((await api.me()).coins).toBe(START_COINS - ENTRY_FEE - OPENING_BID)

    controls.rivalBidsNow()
    expect(rng.remaining()).toBe(0)
    const lot = await lotOf(api, 8)
    expect(lot.you_are_highest).toBe(false)
    expect(lot.highest_bid).toBe(OPENING_BID + 3 * MIN_INCREMENT)
    expect((await api.me()).coins).toBe(START_COINS - ENTRY_FEE)
  })

  it('extends a lot by one minute when a bid lands in its last minute', async () => {
    const { api, controls } = make()
    await api.enter(7)
    controls.skipHours(65)
    vi.setSystemTime(NOON + 59 * MINUTE + 30 * SECOND)

    const bidAt = Date.now() + 65 * HOUR
    const lot = (await api.bid(7, OPENING_BID + MIN_INCREMENT)).auction
    expect(Date.parse(lot.ends_at)).toBe(bidAt + MINUTE)
    expect(Date.parse(lot.ends_at)).toBeGreaterThan(NOON + LOT_7_ENDS_AFTER)
    expect(lot.status).toBe('live')
  })

  it('leaves the end time alone when a full minute or more remains', async () => {
    const { api, controls } = make()
    await api.enter(7)
    controls.skipHours(65)
    vi.setSystemTime(NOON + 59 * MINUTE)

    const lot = (await api.bid(7, OPENING_BID + MIN_INCREMENT)).auction
    expect(Date.parse(lot.ends_at)).toBe(NOON + LOT_7_ENDS_AFTER)
  })

  it('refuses bids and entries on an ended lot', async () => {
    const { api, controls } = make()
    await api.enter(8)
    controls.endAllAuctions()

    const late = await refusal(api.bid(8, OPENING_BID))
    expect(late.code).toBe('auction_ended')
    expect(late.message).toBe('Auction has ended')
    expect((await refusal(api.enter(7))).code).toBe('auction_ended')
  })
})

// ========================================
// Auctions: rival bots
// ========================================

describe('rival bots', () => {
  it('places a bid on every live lot and counts them', async () => {
    const rng = scriptedRandom(Array<number>(15).fill(0.99))
    const { api, controls } = make(rng.random)

    expect(controls.rivalBidsNow()).toBe(6)
    expect(rng.remaining()).toBe(0)
    const lots = await api.auctions()
    // 0.99 → the last rival (Arjun) raising by three increments.
    expect(lots.map(l => l.highest_bid)).toEqual([1_350_000, 1_300_000, 1_550_000, 1_300_000, 1_750_000, 1_300_000])
    expect(lots.every(l => l.top_bids[0]?.user.name === 'Arjun')).toBe(true)
  })

  it('skips lots whose leader is a rival half the time, and counts only placed bids', async () => {
    // Lots with a rival leader (7, 9, 88) draw once and stand down; empty lots draw a rival and an increment.
    const rng = scriptedRandom([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1])
    const { api, controls } = make(rng.random)

    expect(controls.rivalBidsNow()).toBe(3)
    expect(rng.remaining()).toBe(0)
    const lots = await api.auctions()
    expect(lots.map(l => l.highest_bid)).toEqual([OPENING_BID, OPENING_BID, 1_400_000, OPENING_BID, 1_600_000, OPENING_BID])
  })

  it('never lets the same rival bid twice in a row', async () => {
    const rng = scriptedRandom([
      0.9, 0.0, // lot 7: leader Star_99 is drawn again → no bid
      0.0, 0.0, // lot 8: no leader → Star_99, one increment
      0.9, 0.9, 0.9, // lot 9: Arjun over Mira
      0.9, 0.9, // lot 66
      0.9, 0.0, 0.0, // lot 88: Star_99 over Leo.R
      0.9, 0.9, // lot 99
    ])
    const { api, controls } = make(rng.random)

    expect(controls.rivalBidsNow()).toBe(5)
    expect(rng.remaining()).toBe(0)
    const lot7 = await lotOf(api, 7)
    expect(lot7.top_bids).toHaveLength(1)
    expect(lot7.highest_bid).toBe(OPENING_BID)
  })

  it('never rolls in auctions(), enter() or bid()', async () => {
    const { api } = make() // the default RNG throws if consulted
    await api.auctions()
    await api.enter(8)
    vi.setSystemTime(NOON + HOUR)
    await api.bid(8, OPENING_BID)
    await api.auctions()
    await api.me()
  })

  it('rolls inside auction() only for an entered, live lot and at most once per 6 s', async () => {
    const dice = scriptedRandom([0.5, 0.9, 0.0])
    const { api } = make(dice.random)
    await api.enter(8)

    // Not yet due: the lot was entered a moment ago.
    vi.setSystemTime(NOON + 5_999)
    expect((await lotOf(api, 8)).top_bids).toHaveLength(0)
    expect(dice.remaining()).toBe(3)

    // Due, and the roll (0.5 < 0.6) attempts a bid: no leader, so rival Arjun at the opening bid.
    vi.setSystemTime(NOON + 6 * SECOND)
    const lot = await lotOf(api, 8)
    expect(dice.remaining()).toBe(0)
    expect(lot.top_bids).toHaveLength(1)
    expect(lot.top_bids[0]).toMatchObject({ amount: OPENING_BID, is_me: false })
    expect(lot.top_bids[0]?.user.name).toBe('Arjun')

    // The next call inside the same 6 s window must not roll.
    vi.setSystemTime(NOON + 10 * SECOND)
    expect((await lotOf(api, 8)).top_bids).toHaveLength(1)
  })

  it('does not bid when the dice roll misses, and never rolls on a lot the user has not entered', async () => {
    const dice = scriptedRandom([0.7])
    const { api } = make(dice.random)
    await api.enter(8)

    vi.setSystemTime(NOON + 8 * SECOND)
    expect((await lotOf(api, 8)).top_bids).toHaveLength(0)
    expect(dice.remaining()).toBe(0)

    // Lot 7 was never entered: the exhausted RNG would throw if it were consulted.
    vi.setSystemTime(NOON + 30 * SECOND)
    expect((await lotOf(api, 7)).top_bids).toHaveLength(1)
  })
})

// ========================================
// Auctions: settlement
// ========================================
