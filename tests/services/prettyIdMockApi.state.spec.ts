// ========================================
// Pretty ID mock backend — seed, dev controls and persistence tests
// ========================================
//
// See `tests/helpers/prettyIdMockHarness.ts` for the shared environment (pinned clock,
// localStorage stub, scripted RNG).

import { describe, it, expect, vi } from 'vitest'
import { createPrettyIdMockApi, PRETTY_ID_MOCK_RULES } from '~/services/prettyIdMockApi'
import { PRETTY_ID_MOCK_STORAGE_KEY } from '~/services/prettyIdMock/state'
import {
  ENTRY_FEE,
  HOUR,
  MIN_INCREMENT,
  NOON,
  OPENING_BID,
  PROFILE,
  SEEDED_LOT_NUMBERS,
  START_COINS,
  currentStorage,
  lotOf,
  make,
  refusal,
  stored,
  unusedRandom,
  useMockBackendEnvironment,
} from '../helpers/prettyIdMockHarness'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

useMockBackendEnvironment()

describe('seed', () => {
  it('starts the user at Lv 17 with 5,000,000 coins and nothing claimed', async () => {
    const { api } = make()
    const me = await api.me()

    expect(me.level).toBe(17)
    expect(me.coins).toBe(START_COINS)
    expect(me.user).toEqual({ id: PROFILE.id, name: PROFILE.name, avatar_url: PROFILE.avatar_url })
    expect(me.server_now).toBe(new Date(NOON).toISOString())
    expect(me.auction_ids).toEqual([])
    expect(me.slots.lv17).toMatchObject({
      key: 'lv17', required_level: 17, length: 6, unlocked: true, id: null, claimed_at: null, change_tokens: 0, next_change_at: null,
    })
    expect(me.slots.lv34).toMatchObject({ key: 'lv34', required_level: 34, length: 4, unlocked: false, id: null })
  })

  it('surfaces the event rules through me().rules', async () => {
    const { api } = make()
    expect((await api.me()).rules).toEqual({
      entry_fee: ENTRY_FEE,
      opening_bid: OPENING_BID,
      min_increment: MIN_INCREMENT,
      ownership_days: 30,
      change_cooldown_hours: 24,
      min_level_auction: 17,
    })
    expect(PRETTY_ID_MOCK_RULES.entryFee).toBe(ENTRY_FEE)
  })

  it('seeds six live lots with the demo end times and three rival bids', async () => {
    const { api } = make()
    const lots = await api.auctions()

    expect(lots.map(lot => lot.number)).toEqual(SEEDED_LOT_NUMBERS.map(String))
    expect(lots.map(lot => lot.id)).toEqual(SEEDED_LOT_NUMBERS)
    expect(lots.every(lot => lot.status === 'live' && !lot.entered && !lot.you_are_highest)).toBe(true)
    // Lot i closes (66 - 3i) hours from now.
    lots.forEach((lot, index) => {
      expect(Date.parse(lot.ends_at)).toBe(NOON + (66 - 3 * index) * HOUR)
    })

    expect(lots.map(lot => lot.highest_bid)).toEqual([OPENING_BID, null, OPENING_BID + 200_000, null, OPENING_BID + 400_000, null])
    expect(lots.map(lot => lot.min_next_bid)).toEqual([
      OPENING_BID + MIN_INCREMENT, OPENING_BID, OPENING_BID + 250_000, OPENING_BID, OPENING_BID + 450_000, OPENING_BID,
    ])
    const [lot7, , lot9, , lot88] = lots
    expect(lot7?.top_bids[0]?.user.name).toBe('Star_99')
    expect(lot9?.top_bids[0]?.user.name).toBe('Mira')
    expect(lot88?.top_bids[0]?.user.name).toBe('Leo.R')
  })

  it('gives rivals stable negative ids and avatar URLs from the placeholder set', async () => {
    const { api } = make()
    const bidder = (await lotOf(api, 7)).top_bids[0]?.user
    expect(bidder?.id).toBeLessThan(0)
    expect(bidder?.avatar_url).toMatch(/\/avatars\/av\d\.webp$/)
    expect((await lotOf(make().api, 7)).top_bids[0]?.user).toEqual(bidder)
  })

  it('seeds ten winners across this and last month, each filed under its own timestamp', async () => {
    const { api } = make()
    const current = await api.winners()
    expect(current.month).toBe('2026-11')
    expect(current.months).toEqual(['2026-11', '2026-10'])
    expect(current.winners).toHaveLength(5)

    const previous = await api.winners('2026-10')
    expect(previous.month).toBe('2026-10')
    expect(previous.winners).toHaveLength(5)

    for (const winner of current.winners) {
      expect(new Date(winner.won_at).getMonth()).toBe(10)
    }
    for (const winner of previous.winners) {
      expect(new Date(winner.won_at).getMonth()).toBe(9)
    }
    const times = current.winners.map(w => Date.parse(w.won_at))
    expect(times).toEqual([...times].sort((a, b) => b - a))
    expect(current.winners[0]).toMatchObject({ id_number: '7', winning_bid: 3_450_000 })
    expect(current.winners[0]?.user.name).toBe('Fly Live')
  })

  it('seeds eight weekly allotments, newest week first, and the monthly bid total', async () => {
    const { api } = make()
    const weekly = await api.weekly()

    expect(weekly.month).toBe('2026-11')
    expect(weekly.total_bid_coins).toBe(96_500_000)
    expect(weekly.allotments).toHaveLength(8)
    const starts = weekly.allotments.map(a => Date.parse(a.week_start))
    expect(starts).toEqual([...starts].sort((a, b) => b - a))
    expect(weekly.allotments[0]).toMatchObject({ id_number: '7', signature_text: 'Fly Live' })
    expect(Date.parse(weekly.allotments[0]?.week_start ?? '')).toBe(new Date(2026, 10, 9).getTime())
    expect(Date.parse(weekly.allotments[0]?.week_end ?? '')).toBe(new Date(2026, 10, 15).getTime())
  })

  it('clamps the first three wins into the current month when the month has just begun', async () => {
    vi.setSystemTime(new Date(2027, 0, 2, 1, 30, 0, 0))
    const { api } = make()
    const january = await api.winners()

    expect(january.month).toBe('2027-01')
    expect(january.winners).toHaveLength(3)
    const times = january.winners.map(w => Date.parse(w.won_at))
    expect(Math.min(...times)).toBeGreaterThanOrEqual(new Date(2027, 0, 1).getTime())
    expect(Math.max(...times)).toBeLessThanOrEqual(Date.now())
    expect(new Set(times).size).toBe(3)
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('files the baseline bid totals under the right keys across January', async () => {
    vi.setSystemTime(new Date(2027, 0, 2, 1, 30, 0, 0))
    const { api } = make()
    await api.me()

    expect(stored().base_bid).toEqual({ '2027-01': 96_500_000, '2026-12': 118_200_000 })
    const january = await api.winners()
    expect(january.months).toContain('2026-12')
  })
})

// ========================================
// Choose / search
// ========================================

describe('controls', () => {
  it('reports and changes the levers', async () => {
    const { api, controls } = make()
    expect(controls.state()).toEqual({ level: 17, coins: START_COINS, offset_hours: 0, race_armed: false })

    controls.setLevel(34)
    expect(controls.state().level).toBe(34)
    expect((await api.me()).slots.lv34.unlocked).toBe(true)

    controls.addCoins(1_000_000)
    expect(controls.state().coins).toBe(START_COINS + 1_000_000)
    controls.addCoins(0)
    expect(controls.state().coins).toBe(0)

    controls.toggleRace()
    expect(controls.state().race_armed).toBe(true)
    controls.toggleRace()
    expect(controls.state().race_armed).toBe(false)
  })

  it('moves the mock clock with skipHours', async () => {
    const { api, controls } = make()
    controls.skipHours(5)
    controls.skipHours(1)

    expect(controls.state().offset_hours).toBe(6)
    expect((await api.me()).server_now).toBe(new Date(NOON + 6 * HOUR).toISOString())
  })

  it('ends every live lot at once', async () => {
    const { api, controls } = make()
    controls.endAllAuctions()
    expect((await api.auctions()).every(lot => lot.status === 'ended')).toBe(true)
  })

  it('reset() restores the seed', async () => {
    const { api, controls } = make()
    await api.claim('111111')
    await api.enter(8)
    controls.skipHours(10)
    controls.setLevel(34)
    controls.endAllAuctions()

    controls.reset()
    const me = await api.me()
    expect(me.slots.lv17.id).toBeNull()
    expect(me.coins).toBe(START_COINS)
    expect(me.level).toBe(17)
    expect(controls.state()).toEqual({ level: 17, coins: START_COINS, offset_hours: 0, race_armed: false })
    const lots = await api.auctions()
    expect(lots.every(lot => lot.status === 'live' && !lot.entered)).toBe(true)
  })
})

// ========================================
// Persistence
// ========================================

describe('persistence', () => {
  it('writes the state to localStorage under one versioned key', async () => {
    const { api } = make()
    expect(currentStorage().getItem(PRETTY_ID_MOCK_STORAGE_KEY)).toBeNull()
    await api.me()

    expect(PRETTY_ID_MOCK_STORAGE_KEY).toBe('flylive.prettyId.mock.v1')
    expect(stored()).toMatchObject({ version: 1, owner_id: PROFILE.id })
  })

  it('survives a second factory call', async () => {
    await make().api.claim('111111')
    const second = make()
    expect((await second.api.me()).slots.lv17.id).toBe('111111')
    expect((await second.api.search('111111')).reason).toBe('taken')
  })

  it('shares state between two live instances instead of overwriting', async () => {
    const a = make()
    const b = make()
    await a.api.claim('111111')
    await b.api.enter(8)

    const me = await a.api.me()
    expect(me.slots.lv17.id).toBe('111111')
    expect(me.coins).toBe(START_COINS - ENTRY_FEE)
  })

  it('reseeds when the stored blob is missing', async () => {
    const { api } = make()
    await api.claim('111111')
    currentStorage().removeItem(PRETTY_ID_MOCK_STORAGE_KEY)

    expect((await api.me()).slots.lv17.id).toBeNull()
  })

  it('reseeds when the stored blob is garbage or from an older schema', async () => {
    const { api } = make()
    await api.claim('111111')

    currentStorage().setItem(PRETTY_ID_MOCK_STORAGE_KEY, '{not json')
    expect((await api.me()).slots.lv17.id).toBeNull()

    await api.claim('222222')
    currentStorage().setItem(PRETTY_ID_MOCK_STORAGE_KEY, JSON.stringify({ ...stored(), version: 0 }))
    expect((await api.me()).slots.lv17.id).toBeNull()

    await api.claim('333333')
    currentStorage().setItem(PRETTY_ID_MOCK_STORAGE_KEY, JSON.stringify({ version: 1 }))
    expect((await api.me()).slots.lv17.id).toBeNull()
  })

  it('reseeds for a different signed-in user', async () => {
    await make().api.claim('111111')
    const other = createPrettyIdMockApi({ id: 999, name: 'Someone', avatar_url: null }, { random: unusedRandom })
    const me = await other.api.me()

    expect(me.slots.lv17.id).toBeNull()
    expect(me.user).toEqual({ id: 999, name: 'Someone', avatar_url: null })
    expect(stored().owner_id).toBe(999)
  })

  it('shows a renamed profile without reseeding', async () => {
    await make().api.claim('111111')
    const renamed = createPrettyIdMockApi({ ...PROFILE, name: 'New Name' }, { random: unusedRandom })
    const me = await renamed.api.me()

    expect(me.user.name).toBe('New Name')
    expect(me.slots.lv17.id).toBe('111111')
  })

  it('persists a refusal side effect such as a disarmed race lever', async () => {
    const { api, controls } = make()
    controls.toggleRace()
    await refusal(api.claim('222222'))

    expect(make().controls.state().race_armed).toBe(false)
    expect((await make().api.search('222222')).reason).toBe('taken')
  })

  it('keeps working in memory when localStorage throws', async () => {
    const blocked = {
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => { throw new Error('QuotaExceededError') },
      removeItem: () => { throw new Error('SecurityError') },
    }
    vi.stubGlobal('localStorage', blocked)
    vi.resetModules()
    const fresh = await import('~/services/prettyIdMockApi')
    const { api } = fresh.createPrettyIdMockApi(PROFILE, { random: unusedRandom })

    expect((await api.claim('111111')).me.slots.lv17.id).toBe('111111')
    expect((await api.me()).slots.lv17.id).toBe('111111')
    expect((await api.me()).coins).toBe(START_COINS)
  })
})
