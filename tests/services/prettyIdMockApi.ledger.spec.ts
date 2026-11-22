// ========================================
// Pretty ID mock backend — settlement, winners and weekly record tests
// ========================================
//
// See `tests/helpers/prettyIdMockHarness.ts` for the shared environment (pinned clock,
// localStorage stub, scripted RNG).

import { describe, it, expect, vi } from 'vitest'
import {
  DAY,
  ENTRY_FEE,
  HOUR,
  NOON,
  OPENING_BID,
  PROFILE,
  START_COINS,
  lotOf,
  make,
  useMockBackendEnvironment,
} from '../helpers/prettyIdMockHarness'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

useMockBackendEnvironment()

describe('settlement', () => {
  it('makes the user the winner and records it everywhere when all auctions end', async () => {
    const { api, controls } = make()
    await api.enter(8)
    await api.bid(8, OPENING_BID)
    controls.endAllAuctions()

    const me = await api.me()
    expect(me.auction_ids).toEqual([{
      id: '8',
      won_at: new Date(NOON).toISOString(),
      expires_at: new Date(NOON + 30 * DAY).toISOString(),
    }])
    expect(me.coins).toBe(START_COINS - ENTRY_FEE - OPENING_BID)

    const lot = await lotOf(api, 8)
    expect(lot).toMatchObject({ status: 'ended', winning_bid: OPENING_BID, you_are_highest: true })
    expect(lot.winner?.id).toBe(PROFILE.id)

    const winner = (await api.winners()).winners.find(w => w.id_number === '8')
    expect(winner).toMatchObject({ auction_id: 8, winning_bid: OPENING_BID, won_at: new Date(NOON).toISOString() })
    expect(winner?.user.id).toBe(PROFILE.id)

    const weekly = await api.weekly()
    const allotment = weekly.allotments.find(a => a.id_number === '8')
    expect(allotment).toMatchObject({ signature_text: PROFILE.name })
    expect(allotment?.user.id).toBe(PROFILE.id)
    expect(Date.parse(allotment?.week_start ?? '')).toBe(new Date(2026, 10, 16).getTime())
    expect(Date.parse(allotment?.week_end ?? '')).toBe(new Date(2026, 10, 22).getTime())
    // Seeded baseline + the one bid placed through the mock.
    expect(weekly.total_bid_coins).toBe(96_500_000 + OPENING_BID)
  })

  it('settles rival-led lots to the rival and leaves empty lots without a winner', async () => {
    const { api, controls } = make()
    controls.endAllAuctions()

    const lot7 = await lotOf(api, 7)
    expect(lot7).toMatchObject({ status: 'ended', winning_bid: OPENING_BID })
    expect(lot7.winner?.name).toBe('Star_99')
    expect(lot7.you_are_highest).toBe(false)

    const lot8 = await lotOf(api, 8)
    expect(lot8).toMatchObject({ status: 'ended', winner: null, winning_bid: null })
    const wonNumbers = (await api.winners()).winners.map(w => w.id_number)
    expect(wonNumbers).toContain('7')
    expect(wonNumbers).not.toContain('8')
    expect((await api.me()).auction_ids).toEqual([])
  })

  it('holds a won ID for 30 days and then lets it go', async () => {
    const { api, controls } = make()
    await api.enter(8)
    await api.bid(8, OPENING_BID)
    controls.endAllAuctions()

    controls.skipHours(30 * 24 - 1)
    expect((await api.me()).auction_ids).toHaveLength(1)
    controls.skipHours(1)
    expect((await api.me()).auction_ids).toEqual([])
    expect((await api.winners('2026-11')).winners.some(w => w.id_number === '8')).toBe(true)
  })

  it('settles lazily from the lot end time, so a long skip cannot mint a fresh 30 days', async () => {
    const { api, controls } = make()
    await api.enter(8)
    await api.bid(8, OPENING_BID)
    controls.skipHours(40 * 24)

    expect((await api.me()).auction_ids).toEqual([])
    const lot8EndsAt = NOON + 63 * HOUR
    const november = await api.winners('2026-11')
    const mine = november.winners.find(w => w.id_number === '8')
    expect(mine?.won_at).toBe(new Date(lot8EndsAt).toISOString())
    // The current month has moved on: the default page is no longer November.
    expect((await api.winners()).month).toBe('2026-12')
  })

  it('does not settle a lot twice', async () => {
    const { api, controls } = make()
    controls.endAllAuctions()
    const first = (await api.winners()).winners.length
    controls.endAllAuctions()
    await api.me()
    expect((await api.winners()).winners).toHaveLength(first)
    expect((await api.weekly()).allotments).toHaveLength(8 + 3)
  })
})

// ========================================
// Winners / weekly
// ========================================

describe('winners', () => {
  it('falls back to the current month for an unknown or omitted month', async () => {
    const { api } = make()
    expect((await api.winners('2099-01')).month).toBe('2026-11')
    expect((await api.winners('garbage')).month).toBe('2026-11')
    expect((await api.winners(undefined)).month).toBe('2026-11')
  })

  it('lists months newest first and always includes the current one', async () => {
    vi.setSystemTime(new Date(2026, 11, 3, 12))
    const { api } = make()
    const response = await api.winners()
    expect(response.months[0]).toBe('2026-12')
    expect([...response.months]).toEqual([...response.months].sort().reverse())
    expect(response.winners.every(w => new Date(w.won_at).getMonth() === 11)).toBe(true)
  })
})

describe('weekly', () => {
  it('lists the current week allotment ahead of the seeded history', async () => {
    const { api, controls } = make()
    controls.endAllAuctions()
    const { allotments } = await api.weekly()

    expect(allotments).toHaveLength(8 + 3)
    expect(Date.parse(allotments[0]?.week_start ?? '')).toBe(new Date(2026, 10, 16).getTime())
    const starts = allotments.map(a => Date.parse(a.week_start))
    expect(starts).toEqual([...starts].sort((a, b) => b - a))
  })
})

// ========================================
// Controls
// ========================================
