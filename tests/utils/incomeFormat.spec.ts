import { describe, it, expect } from 'vitest'
import {
  formatDiamondsExact,
  formatRunDate,
  formatRunRange,
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
