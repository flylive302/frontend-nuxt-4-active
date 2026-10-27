import { describe, it, expect } from 'vitest'
import {
  formatDiamondsExact,
  formatGiftCoinsExact,
  formatRunDate,
  formatRunRange,
  formatRunTimeLeft,
  isRunEndingSoon,
  RUN_URGENT_DAYS_LEFT,
  toStatusBadgeColor,
} from '../../app/utils/incomeFormat'

describe('formatDiamondsExact', () => {
  it('formats a large integer with thousands separators', () => {
    expect(formatDiamondsExact(1234567)).toBe('1,234,567')
  })

  it('keeps small integers unabbreviated', () => {
    expect(formatDiamondsExact(500)).toBe('500')
  })

  it('keeps the leading minus for negative values', () => {
    expect(formatDiamondsExact(-50)).toBe('-50')
  })

  it('formats zero', () => {
    expect(formatDiamondsExact(0)).toBe('0')
  })
})

describe('formatGiftCoinsExact', () => {
  it('formats a round thousand with a separator', () => {
    expect(formatGiftCoinsExact(241000)).toBe('241,000')
  })

  it('formats a large integer with thousands separators', () => {
    expect(formatGiftCoinsExact(1234567)).toBe('1,234,567')
  })

  it('keeps small integers unabbreviated', () => {
    expect(formatGiftCoinsExact(999)).toBe('999')
  })

  it('formats zero', () => {
    expect(formatGiftCoinsExact(0)).toBe('0')
  })

  it('truncates the fraction instead of rounding', () => {
    expect(formatGiftCoinsExact(315312.7)).toBe('315,312')
  })

  it('truncates a fraction just below the next whole number', () => {
    expect(formatGiftCoinsExact(3700.99)).toBe('3,700')
  })
})

describe('formatRunDate', () => {
  it('formats an ISO date as short month, day, year in UTC', () => {
    expect(formatRunDate('2026-09-01T00:00:00.000Z')).toBe('Sep 1, 2026')
  })

  it('stays in UTC near a day boundary', () => {
    expect(formatRunDate('2026-12-31T23:30:00.000Z')).toBe('Dec 31, 2026')
  })
})

describe('formatRunRange', () => {
  it('omits the year on the start date when both fall in the same year', () => {
    expect(formatRunRange('2026-09-01T00:00:00.000Z', '2026-09-11T00:00:00.000Z')).toBe(
      'Sep 1 – Sep 11, 2026',
    )
  })

  it('shows the year on both dates when they span a year boundary', () => {
    expect(formatRunRange('2026-12-28T00:00:00.000Z', '2027-01-07T00:00:00.000Z')).toBe(
      'Dec 28, 2026 – Jan 7, 2027',
    )
  })
})

describe('toStatusBadgeColor', () => {
  it.each(['info', 'success', 'warning', 'neutral'] as const)(
    'passes through known color %s',
    (color) => {
      expect(toStatusBadgeColor(color)).toBe(color)
    },
  )

  it('falls back to neutral for an unrecognized color', () => {
    expect(toStatusBadgeColor('error')).toBe('neutral')
  })
})

describe('formatRunTimeLeft', () => {
  const endsAt = '2026-10-30T00:00:00+00:00'
  const END_MS = Date.parse(endsAt)
  const HOUR = 3_600_000
  const DAY = 24 * HOUR

  it('shows days and hours when at least a day is left', () => {
    expect(formatRunTimeLeft(endsAt, END_MS - 2 * DAY - 5 * HOUR - 30 * 60_000)).toBe('2d 5h left')
  })

  it('floors instead of rounding up (2d 23h is not "3 days")', () => {
    expect(formatRunTimeLeft(endsAt, END_MS - 2 * DAY - 23 * HOUR - 59 * 60_000)).toBe('2d 23h left')
  })

  it('shows 0h explicitly on an exact day boundary', () => {
    expect(formatRunTimeLeft(endsAt, END_MS - 3 * DAY)).toBe('3d 0h left')
  })

  it('drops the day part under 24 hours', () => {
    expect(formatRunTimeLeft(endsAt, END_MS - 5 * HOUR - 10 * 60_000)).toBe('5h left')
  })

  it('says "Ends soon" under one hour', () => {
    expect(formatRunTimeLeft(endsAt, END_MS - 59 * 60_000)).toBe('Ends soon')
  })

  it('says "Ended" at and after the boundary', () => {
    expect(formatRunTimeLeft(endsAt, END_MS)).toBe('Ended')
    expect(formatRunTimeLeft(endsAt, END_MS + DAY)).toBe('Ended')
  })

  it('treats an unparseable ends_at as ended rather than throwing', () => {
    expect(formatRunTimeLeft('not-a-date', END_MS)).toBe('Ended')
  })
})

describe('isRunEndingSoon', () => {
  const endsAt = '2026-10-30T00:00:00+00:00'
  const END_MS = Date.parse(endsAt)
  const HOUR = 3_600_000
  const DAY = 24 * HOUR

  it('threshold is three days', () => {
    expect(RUN_URGENT_DAYS_LEFT).toBe(3)
  })

  it('is urgent at exactly three days and anything less', () => {
    expect(isRunEndingSoon(endsAt, END_MS - 3 * DAY)).toBe(true)
    expect(isRunEndingSoon(endsAt, END_MS - 2 * DAY - 23 * HOUR)).toBe(true)
    expect(isRunEndingSoon(endsAt, END_MS - HOUR)).toBe(true)
    expect(isRunEndingSoon(endsAt, END_MS)).toBe(true)
  })

  it('is not urgent at 3d 1h (floored days alone would wrongly flag it)', () => {
    expect(isRunEndingSoon(endsAt, END_MS - 3 * DAY - HOUR)).toBe(false)
    expect(isRunEndingSoon(endsAt, END_MS - 4 * DAY)).toBe(false)
  })

  it('treats an unparseable ends_at as urgent', () => {
    expect(isRunEndingSoon('not-a-date', END_MS)).toBe(true)
  })
})
