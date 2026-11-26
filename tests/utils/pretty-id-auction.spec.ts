import { describe, expect, it } from 'vitest'
import {
  parsePrettyIdAuctionId,
  groupPrettyIdAuctions,
  isPrettyIdAuctionFinalizing,
  isPrettyIdBidSuspicious,
  parsePrettyIdBidAmount,
  sanitizePrettyIdBidText,
  nextPrettyIdAuctionPollDelayMs,
  prettyIdAuctionCardRoute,
  prettyIdAuctionRoute,
  prettyIdClockOffset,
  prettyIdProfileRoute,
  prettyIdRareFontPx,
  prettyIdRareWinView,
  prettyIdWinnerProfileRoute,
} from '~/utils/pretty-id-auction'
import { HOUR, iso, makeCard, makeHistoryWinner, MINUTE, SERVER_NOW_MS } from '../helpers/prettyIdAuctionFixtures'

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

describe('prettyIdAuctionCardRoute', () => {
  it('sends a live or upcoming card to its auction page', () => {
    expect(prettyIdAuctionCardRoute(makeCard({ id: 12, state: 'live' }))).toBe('/pretty-id/auction/12')
    expect(prettyIdAuctionCardRoute(makeCard({ id: 13, state: 'upcoming' }))).toBe('/pretty-id/auction/13')
  })

  it('sends an ended card to the Weekly Record of the PKT month it ended in', () => {
    expect(prettyIdAuctionCardRoute(makeCard({ state: 'ended', ends_at: '2026-10-15T10:00:00.000Z' })))
      .toEqual({ path: '/pretty-id/weekly', query: { month: '2026-10' } })
  })

  it('uses the PKT month at a month edge, not the UTC one', () => {
    // 20:00 UTC on 31 Oct is already 1 Nov in Pakistan.
    expect(prettyIdAuctionCardRoute(makeCard({ state: 'ended', ends_at: '2026-10-31T20:00:00.000Z' })))
      .toEqual({ path: '/pretty-id/weekly', query: { month: '2026-11' } })
  })

  it('falls back to the current month when the end time is unreadable', () => {
    expect(prettyIdAuctionCardRoute(makeCard({ state: 'ended', ends_at: 'soon' }))).toEqual({ path: '/pretty-id/weekly' })
  })
})

describe('prettyIdWinnerProfileRoute', () => {
  it('opens the profile by Signature', () => {
    expect(prettyIdWinnerProfileRoute(makeHistoryWinner({ id: 7, signature: 'SIG7' }))).toBe('/profile/SIG7')
  })

  it('has no link for a deleted account (no id), even if a Signature is left', () => {
    expect(prettyIdWinnerProfileRoute(makeHistoryWinner({ id: null, signature: 'SIG7' }))).toBeNull()
  })

  it('has no link without a Signature', () => {
    expect(prettyIdWinnerProfileRoute(makeHistoryWinner({ id: 7, signature: null }))).toBeNull()
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

describe('bid amount helpers', () => {
  it.each([
    ['2,500,000', '2500000'],
    ['abc', ''],
    ['', ''],
    ['0012', '12'],
    ['1.5', '15'],
    ['9'.repeat(20), '9'.repeat(12)],
  ])('sanitizePrettyIdBidText(%j) keeps %j', (raw, kept) => {
    expect(sanitizePrettyIdBidText(raw)).toBe(kept)
  })

  it.each([
    ['100000', 100_000],
    ['1', 1],
    ['', null],
    ['0', null],
    ['12a', null],
    ['-5', null],
    ['1.5', null],
  ])('parsePrettyIdBidAmount(%j) is %j', (text, amount) => {
    expect(parsePrettyIdBidAmount(text)).toBe(amount)
  })

  it('warns only above ten times the minimum (exactly ten times is fine)', () => {
    expect(isPrettyIdBidSuspicious(1_000_000, 100_000)).toBe(false)
    expect(isPrettyIdBidSuspicious(1_000_001, 100_000)).toBe(true)
    expect(isPrettyIdBidSuspicious(100_000, 100_000)).toBe(false)
  })
})

describe('isPrettyIdAuctionFinalizing', () => {
  const live = (endsInMs: number) => ({ state: 'live' as const, ends_at: iso(endsInMs) })

  it('is false before the end', () => {
    expect(isPrettyIdAuctionFinalizing(live(1), SERVER_NOW_MS)).toBe(false)
    expect(isPrettyIdAuctionFinalizing(live(HOUR), SERVER_NOW_MS)).toBe(false)
  })

  it('is true at the end and after it while still live', () => {
    expect(isPrettyIdAuctionFinalizing(live(0), SERVER_NOW_MS)).toBe(true)
    expect(isPrettyIdAuctionFinalizing(live(-30_000), SERVER_NOW_MS)).toBe(true)
    expect(isPrettyIdAuctionFinalizing(live(-5 * MINUTE), SERVER_NOW_MS)).toBe(true)
  })

  it('is false once the auction is ended or cancelled, even past the end', () => {
    expect(isPrettyIdAuctionFinalizing({ state: 'ended', ends_at: iso(-MINUTE) }, SERVER_NOW_MS)).toBe(false)
    expect(isPrettyIdAuctionFinalizing({ state: 'cancelled', ends_at: iso(-MINUTE) }, SERVER_NOW_MS)).toBe(false)
  })

  it('is false for an upcoming auction', () => {
    expect(isPrettyIdAuctionFinalizing({ state: 'upcoming', ends_at: iso(-MINUTE) }, SERVER_NOW_MS)).toBe(false)
  })

  it('is false when the end is not a date', () => {
    expect(isPrettyIdAuctionFinalizing({ state: 'live', ends_at: 'soon' }, SERVER_NOW_MS)).toBe(false)
  })
})

describe('prettyIdRareWinView', () => {
  it('words the win celebration: Rare ID, spaced number, keep-period', () => {
    expect(prettyIdRareWinView({ rare_id: '0777', keep_days: 7 })).toEqual({
      title: 'Congratulations!',
      subline: 'You won Rare ID 0777',
      spacedId: '0 7 7 7',
      keepLine: 'Yours for 7 days',
      idLabel: 'Rare ID 0777',
    })
  })

  it('uses the singular for one day', () => {
    expect(prettyIdRareWinView({ rare_id: '1', keep_days: 1 }).keepLine).toBe('Yours for 1 day')
  })
})
