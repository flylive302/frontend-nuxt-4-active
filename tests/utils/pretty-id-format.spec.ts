// ========================================
// Pretty ID formatter tests
// ========================================
//
// Dates are built from LOCAL parts (the formatters render in the device
// timezone), so the assertions hold in any timezone.

import { describe, it, expect } from 'vitest'
import {
  formatPrettyIdDate,
  formatPrettyIdDateTime,
  formatPrettyIdDuration,
  formatPrettyIdShort,
  prettyIdMonthKey,
  prettyIdMonthName,
  prettyIdPreviousMonthKey,
  prettyIdWeekStart,
} from '~/utils/pretty-id-format'

const SECOND = 1_000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatPrettyIdShort', () => {
  it('abbreviates thousands without decimals', () => {
    expect(formatPrettyIdShort(50_000)).toBe('50K')
    expect(formatPrettyIdShort(1_000)).toBe('1K')
    expect(formatPrettyIdShort(51_400)).toBe('51K')
  })

  it('abbreviates millions with up to two decimals', () => {
    expect(formatPrettyIdShort(1_200_000)).toBe('1.2M')
    expect(formatPrettyIdShort(1_250_000)).toBe('1.25M')
    expect(formatPrettyIdShort(5_200_000)).toBe('5.2M')
  })

  it('drops the decimals of whole millions', () => {
    expect(formatPrettyIdShort(1_000_000)).toBe('1M')
    expect(formatPrettyIdShort(10_000_000)).toBe('10M')
    expect(formatPrettyIdShort(100_000_000)).toBe('100M')
  })

  it('leaves small numbers alone', () => {
    expect(formatPrettyIdShort(0)).toBe('0')
    expect(formatPrettyIdShort(999)).toBe('999')
  })
})

describe('formatPrettyIdDuration', () => {
  it('formats under a day as HH:MM:SS', () => {
    expect(formatPrettyIdDuration(0)).toBe('00:00:00')
    expect(formatPrettyIdDuration(HOUR + MINUTE + SECOND)).toBe('01:01:01')
    expect(formatPrettyIdDuration(DAY - SECOND)).toBe('23:59:59')
  })

  it('prefixes whole days', () => {
    expect(formatPrettyIdDuration(DAY)).toBe('1D 00:00:00')
    expect(formatPrettyIdDuration(2 * DAY + 3 * HOUR + 4 * MINUTE + 5 * SECOND)).toBe('2D 03:04:05')
    expect(formatPrettyIdDuration(72 * HOUR)).toBe('3D 00:00:00')
  })

  it('clamps negative durations to zero', () => {
    expect(formatPrettyIdDuration(-5 * SECOND)).toBe('00:00:00')
    expect(formatPrettyIdDuration(-DAY)).toBe('00:00:00')
  })

  it('drops sub-second remainders', () => {
    expect(formatPrettyIdDuration(1_999)).toBe('00:00:01')
  })
})

describe('formatPrettyIdDate / formatPrettyIdDateTime', () => {
  const iso = new Date(2026, 9, 5, 9, 7, 42).toISOString()

  it('renders the local calendar date', () => {
    expect(formatPrettyIdDate(iso)).toBe('2026/10/05')
  })

  it('renders local date and zero-padded time', () => {
    expect(formatPrettyIdDateTime(iso)).toBe('2026/10/05 09:07')
    expect(formatPrettyIdDateTime(new Date(2026, 11, 31, 23, 59).toISOString())).toBe('2026/12/31 23:59')
  })

  it('returns an empty string for an unparseable timestamp', () => {
    expect(formatPrettyIdDate('not a date')).toBe('')
    expect(formatPrettyIdDateTime('')).toBe('')
  })
})

describe('prettyIdMonthKey', () => {
  it('uses the local month, padded', () => {
    expect(prettyIdMonthKey(new Date(2026, 0, 31, 23, 59).getTime())).toBe('2026-01')
    expect(prettyIdMonthKey(new Date(2026, 11, 1, 0, 0).getTime())).toBe('2026-12')
    expect(prettyIdMonthKey(new Date(2026, 9, 15).getTime())).toBe('2026-10')
  })
})

describe('prettyIdMonthName', () => {
  it('spells out the month and year', () => {
    expect(prettyIdMonthName('2026-10')).toBe('October 2026')
    expect(prettyIdMonthName('2026-01')).toBe('January 2026')
    expect(prettyIdMonthName('2027-12')).toBe('December 2027')
  })

  it('returns a malformed key unchanged', () => {
    expect(prettyIdMonthName('oops')).toBe('oops')
    expect(prettyIdMonthName('2026-13')).toBe('2026-13')
  })
})

describe('prettyIdPreviousMonthKey', () => {
  it('steps back one month', () => {
    expect(prettyIdPreviousMonthKey('2026-11')).toBe('2026-10')
    expect(prettyIdPreviousMonthKey('2026-03')).toBe('2026-02')
  })

  it('rolls January back into the previous December', () => {
    expect(prettyIdPreviousMonthKey('2026-01')).toBe('2025-12')
    expect(prettyIdPreviousMonthKey('2000-01')).toBe('1999-12')
  })

  it('returns a malformed key unchanged', () => {
    expect(prettyIdPreviousMonthKey('oops')).toBe('oops')
  })
})

describe('prettyIdWeekStart', () => {
  const monday = new Date(2026, 10, 16).getTime()

  it('returns the local Monday 00:00 of a mid-week instant', () => {
    expect(prettyIdWeekStart(new Date(2026, 10, 18, 15, 30).getTime())).toBe(monday)
  })

  it('maps Monday 00:00 and Monday 23:59 to the same Monday', () => {
    expect(prettyIdWeekStart(monday)).toBe(monday)
    expect(prettyIdWeekStart(new Date(2026, 10, 16, 23, 59, 59).getTime())).toBe(monday)
  })

  it('treats Sunday as the last day of the week', () => {
    expect(prettyIdWeekStart(new Date(2026, 10, 22, 12).getTime())).toBe(monday)
    expect(prettyIdWeekStart(new Date(2026, 10, 23, 0, 0).getTime())).toBe(new Date(2026, 10, 23).getTime())
  })

  it('crosses month and year boundaries', () => {
    expect(prettyIdWeekStart(new Date(2026, 2, 1, 12).getTime())).toBe(new Date(2026, 1, 23).getTime())
    expect(prettyIdWeekStart(new Date(2027, 0, 2, 12).getTime())).toBe(new Date(2026, 11, 28).getTime())
  })
})
