import { describe, expect, it } from 'vitest'
import {
  parsePrettyIdAuctionId,
  groupPrettyIdAuctions,
  nextPrettyIdAuctionPollDelayMs,
  prettyIdAuctionRoute,
  prettyIdClockOffset,
  prettyIdProfileRoute,
  prettyIdRareFontPx,
} from '~/utils/pretty-id-auction'
import { HOUR, iso, makeCard, MINUTE, SERVER_NOW_MS } from '../helpers/prettyIdAuctionFixtures'

describe('nextPrettyIdAuctionPollDelayMs', () => {
  const NOW = SERVER_NOW_MS
  const live = (endsInMs: number) => ({ state: 'live' as const, starts_at: iso(-HOUR), ends_at: iso(endsInMs) })
  const upcoming = (startsInMs: number) => ({ state: 'upcoming' as const, starts_at: iso(startsInMs), ends_at: iso(startsInMs + HOUR) })

  describe('live', () => {
    it('polls every 60 s while more than an hour remains', () => {
      expect(nextPrettyIdAuctionPollDelayMs(live(5 * HOUR), NOW)).toBe(60_000)
      expect(nextPrettyIdAuctionPollDelayMs(live(HOUR + 1), NOW)).toBe(60_000)
    })

    it('polls every 3 s once less than an hour remains (exactly one hour is still 60 s)', () => {
      expect(nextPrettyIdAuctionPollDelayMs(live(HOUR), NOW)).toBe(60_000)
      expect(nextPrettyIdAuctionPollDelayMs(live(HOUR - 1), NOW)).toBe(3_000)
      expect(nextPrettyIdAuctionPollDelayMs(live(10 * MINUTE), NOW)).toBe(3_000)
    })

    it('stays at 3 s after the end is extended (ends_at moves, still under an hour)', () => {
      expect(nextPrettyIdAuctionPollDelayMs(live(20_000), NOW)).toBe(3_000)
      expect(nextPrettyIdAuctionPollDelayMs(live(20_000 + 60_000), NOW)).toBe(3_000)
    })

    it('stays at 3 s past ends_at while awaiting settlement', () => {
      expect(nextPrettyIdAuctionPollDelayMs(live(0), NOW)).toBe(3_000)
      expect(nextPrettyIdAuctionPollDelayMs(live(-5 * MINUTE), NOW)).toBe(3_000)
    })

    it('judges the remaining time on the server clock it is given, not the device clock', () => {
      // Device thinks it is 2 h before the end, but the server clock says 30 min.
      const timing = live(2 * HOUR)
      expect(nextPrettyIdAuctionPollDelayMs(timing, NOW + 90 * MINUTE)).toBe(3_000)
    })
  })

  describe('upcoming', () => {
    it('is 60 s when the start is far away', () => {
      expect(nextPrettyIdAuctionPollDelayMs(upcoming(5 * HOUR), NOW)).toBe(60_000)
    })

    it('is the time to the start plus one second when that is under a minute', () => {
      expect(nextPrettyIdAuctionPollDelayMs(upcoming(20_000), NOW)).toBe(21_000)
    })

    it('is never below 3 s, including at and past the start', () => {
      expect(nextPrettyIdAuctionPollDelayMs(upcoming(1_000), NOW)).toBe(3_000)
      expect(nextPrettyIdAuctionPollDelayMs(upcoming(0), NOW)).toBe(3_000)
      expect(nextPrettyIdAuctionPollDelayMs(upcoming(-30_000), NOW)).toBe(3_000)
    })
  })

  it.each(['ended', 'cancelled'] as const)('stops (null) when %s', (state) => {
    expect(nextPrettyIdAuctionPollDelayMs({ state, starts_at: iso(-HOUR), ends_at: iso(-MINUTE) }, NOW)).toBeNull()
  })
})

describe('groupPrettyIdAuctions', () => {
  it('splits by state, keeps the server order inside each group and drops cancelled', () => {
    const cards = [
      makeCard({ id: 1, state: 'live' }),
      makeCard({ id: 2, state: 'live' }),
      makeCard({ id: 3, state: 'upcoming' }),
      makeCard({ id: 4, state: 'cancelled' }),
      makeCard({ id: 5, state: 'ended' }),
      makeCard({ id: 6, state: 'ended' }),
    ]
    const groups = groupPrettyIdAuctions(cards)
    expect(groups.live.map(card => card.id)).toEqual([1, 2])
    expect(groups.upcoming.map(card => card.id)).toEqual([3])
    expect(groups.ended.map(card => card.id)).toEqual([5, 6])
  })

  it('returns three empty groups for an empty list', () => {
    expect(groupPrettyIdAuctions([])).toEqual({ live: [], upcoming: [], ended: [] })
  })
})

describe('prettyIdClockOffset', () => {
  it('is server time minus device time', () => {
    expect(prettyIdClockOffset('2026-11-26T10:00:05.000Z', Date.parse('2026-11-26T10:00:00.000Z'))).toBe(5_000)
    expect(prettyIdClockOffset('2026-11-26T10:00:00.000Z', Date.parse('2026-11-26T10:00:03.000Z'))).toBe(-3_000)
  })

  it('is null for a stamp that is not a date', () => {
    expect(prettyIdClockOffset('not a date', 1)).toBeNull()
    expect(prettyIdClockOffset('', 1)).toBeNull()
  })
})

describe('prettyIdAuctionRoute / prettyIdProfileRoute', () => {
  it('builds the auction page path', () => {
    expect(prettyIdAuctionRoute(12)).toBe('/pretty-id/auction/12')
  })

  it('opens a profile by Signature, or by nothing when there is none', () => {
    expect(prettyIdProfileRoute('ABC123')).toBe('/profile/ABC123')
    expect(prettyIdProfileRoute(null)).toBeNull()
    expect(prettyIdProfileRoute('')).toBeNull()
  })
})

describe('prettyIdRareFontPx', () => {
  const sizes = { max: 72, min: 36 }

  it('uses the full size up to 3 characters and shrinks after, never below the floor', () => {
    expect(prettyIdRareFontPx('7', sizes)).toBe(72)
    expect(prettyIdRareFontPx('007', sizes)).toBe(72)
    expect(prettyIdRareFontPx('1234', sizes)).toBe(65)
    expect(prettyIdRareFontPx('12345678', sizes)).toBe(36)
    expect(prettyIdRareFontPx('12345678', { max: 38, min: 20 })).toBe(20)
  })
})

describe('parsePrettyIdAuctionId', () => {
  it('accepts plain digits', () => {
    expect(parsePrettyIdAuctionId('42')).toBe(42)
  })

  it.each([['abc'], ['12a'], ['-1'], ['1.5'], [''], [['1']], [undefined], ['99999999999999999999']])(
    'rejects %j',
    (raw) => {
      expect(parsePrettyIdAuctionId(raw)).toBeNull()
    },
  )
})
