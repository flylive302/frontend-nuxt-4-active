// ========================================
// Owner Income Window Utilities Tests
// ========================================
// The client half of the range contract: the cache key, the endpoint split and
// the GATE that must agree with the API's 422 exactly.

import { describe, expect, it } from 'vitest'
import {
  checkOwnerIncomeRange,
  defaultOwnerIncomeRange,
  isOwnerIncomeDay,
  ownerIncomeDayLabel,
  ownerIncomeRangeLabel,
  ownerIncomeRangeSpanDays,
  ownerIncomeSheetKey,
  ownerIncomeWindowEndpoint,
  ownerIncomeWindowKey,
  shiftOwnerIncomeDay,
} from '../../app/utils/ownerIncomeWindow'
import type { OwnerIncomeRangeLimits } from '../../app/types/income/ownerIncome'

const LIMITS: OwnerIncomeRangeLimits = {
  min_day: '2026-01-01',
  max_day: '2026-09-16',
  max_span_days: 366,
}

describe('isOwnerIncomeDay', () => {
  it('accepts YYYY-MM-DD', () => {
    expect(isOwnerIncomeDay('2026-09-01')).toBe(true)
  })

  it('rejects any other shape', () => {
    expect(isOwnerIncomeDay('2026-9-1')).toBe(false)
    expect(isOwnerIncomeDay('01/09/2026')).toBe(false)
    expect(isOwnerIncomeDay('')).toBe(false)
    expect(isOwnerIncomeDay('2026-09-01T00:00:00+00:00')).toBe(false)
  })
})

describe('ownerIncomeWindowKey', () => {
  it('keys a run by its number', () => {
    expect(ownerIncomeWindowKey({ kind: 'run', number: 5 })).toBe('run:5')
  })

  it('keys a range by its two days', () => {
    expect(ownerIncomeWindowKey({ kind: 'range', from: '2026-09-01', to: '2026-09-15' }))
      .toBe('range:2026-09-01|2026-09-15')
  })

  it('never collides a run with a range', () => {
    const run = ownerIncomeWindowKey({ kind: 'run', number: 1 })
    const range = ownerIncomeWindowKey({ kind: 'range', from: '2026-09-01', to: '2026-09-01' })

    expect(run).not.toBe(range)
  })
})

describe('ownerIncomeSheetKey', () => {
  it('scopes a member to one window', () => {
    expect(ownerIncomeSheetKey('run:5', 42)).toBe('run:5:42')
    expect(ownerIncomeSheetKey('range:2026-09-01|2026-09-15', 42)).toBe('range:2026-09-01|2026-09-15:42')
  })
})

describe('ownerIncomeWindowEndpoint', () => {
  it('routes a run to the cycles family with no query', () => {
    expect(ownerIncomeWindowEndpoint({ kind: 'run', number: 5 })).toEqual({
      url: '/user/agency/income/cycles/5',
      query: {},
    })
  })

  it('routes a range to the range family with from/to', () => {
    expect(ownerIncomeWindowEndpoint({ kind: 'range', from: '2026-09-01', to: '2026-09-15' })).toEqual({
      url: '/user/agency/income/range',
      query: { from: '2026-09-01', to: '2026-09-15' },
    })
  })

  it('appends the members suffix to both families', () => {
    expect(ownerIncomeWindowEndpoint({ kind: 'run', number: 5 }, '/members').url)
      .toBe('/user/agency/income/cycles/5/members')
    expect(ownerIncomeWindowEndpoint({ kind: 'range', from: '2026-09-01', to: '2026-09-15' }, '/members').url)
      .toBe('/user/agency/income/range/members')
  })

  it('appends the member sheet suffix to both families', () => {
    expect(ownerIncomeWindowEndpoint({ kind: 'run', number: 5 }, '/members/42').url)
      .toBe('/user/agency/income/cycles/5/members/42')

    const range = ownerIncomeWindowEndpoint({ kind: 'range', from: '2026-09-01', to: '2026-09-15' }, '/members/42')
    expect(range.url).toBe('/user/agency/income/range/members/42')
    expect(range.query).toEqual({ from: '2026-09-01', to: '2026-09-15' })
  })
})

describe('ownerIncomeRangeSpanDays', () => {
  it('counts both ends, so a single day is a span of 1', () => {
    expect(ownerIncomeRangeSpanDays('2026-09-01', '2026-09-01')).toBe(1)
  })

  it('counts an inclusive range', () => {
    expect(ownerIncomeRangeSpanDays('2026-09-01', '2026-09-15')).toBe(15)
  })

  it('counts across a month boundary', () => {
    expect(ownerIncomeRangeSpanDays('2026-08-31', '2026-09-01')).toBe(2)
  })

  it('counts a full leap year as 366', () => {
    expect(ownerIncomeRangeSpanDays('2028-01-01', '2028-12-31')).toBe(366)
  })

  it('is NaN for a malformed day', () => {
    expect(ownerIncomeRangeSpanDays('nope', '2026-09-01')).toBeNaN()
  })
})

describe('ownerIncomeDayLabel', () => {
  it('drops the leading zero and names the month', () => {
    expect(ownerIncomeDayLabel('2026-09-01')).toBe('1 Sep 2026')
    expect(ownerIncomeDayLabel('2026-12-25')).toBe('25 Dec 2026')
  })

  it('passes a malformed value through unchanged', () => {
    expect(ownerIncomeDayLabel('soon')).toBe('soon')
  })
})

describe('ownerIncomeRangeLabel', () => {
  it('matches the label the API builds for the same range', () => {
    expect(ownerIncomeRangeLabel('2026-09-01', '2026-09-15')).toBe('1 Sep – 15 Sep')
  })

  it('handles a single-day range', () => {
    expect(ownerIncomeRangeLabel('2026-09-01', '2026-09-01')).toBe('1 Sep – 1 Sep')
  })
})

describe('checkOwnerIncomeRange', () => {
  it('accepts a range inside every bound', () => {
    expect(checkOwnerIncomeRange('2026-09-01', '2026-09-15', LIMITS)).toEqual({ valid: true })
  })

  it('accepts from === to (span 1)', () => {
    expect(checkOwnerIncomeRange('2026-09-01', '2026-09-01', LIMITS)).toEqual({ valid: true })
  })

  it('accepts the exact boundary days', () => {
    expect(checkOwnerIncomeRange(LIMITS.min_day, LIMITS.max_day, LIMITS)).toEqual({ valid: true })
  })

  it('rejects a missing day', () => {
    expect(checkOwnerIncomeRange('', '2026-09-15', LIMITS).valid).toBe(false)
    expect(checkOwnerIncomeRange('2026-09-01', '', LIMITS).valid).toBe(false)
  })

  it('rejects a malformed day', () => {
    expect(checkOwnerIncomeRange('2026-9-1', '2026-09-15', LIMITS).valid).toBe(false)
  })

  it('rejects when the limits have not loaded', () => {
    expect(checkOwnerIncomeRange('2026-09-01', '2026-09-15', null).valid).toBe(false)
  })

  it('rejects a reversed range', () => {
    const check = checkOwnerIncomeRange('2026-09-15', '2026-09-01', LIMITS)

    expect(check.valid).toBe(false)
    expect(check).toMatchObject({ message: expect.stringContaining('on or before') })
  })

  it('rejects a start before the programme anchor', () => {
    expect(checkOwnerIncomeRange('2025-12-31', '2026-09-15', LIMITS).valid).toBe(false)
  })

  it('rejects an end after today UTC', () => {
    expect(checkOwnerIncomeRange('2026-09-01', '2026-09-17', LIMITS).valid).toBe(false)
  })

  it('accepts a span of exactly max_span_days', () => {
    const limits: OwnerIncomeRangeLimits = { min_day: '2028-01-01', max_day: '2028-12-31', max_span_days: 366 }

    expect(checkOwnerIncomeRange('2028-01-01', '2028-12-31', limits)).toEqual({ valid: true })
  })

  it('rejects a span one day over max_span_days', () => {
    const limits: OwnerIncomeRangeLimits = { min_day: '2027-01-01', max_day: '2028-12-31', max_span_days: 366 }
    const check = checkOwnerIncomeRange('2027-12-31', '2028-12-31', limits)

    expect(ownerIncomeRangeSpanDays('2027-12-31', '2028-12-31')).toBe(367)
    expect(check.valid).toBe(false)
    expect(check).toMatchObject({ message: expect.stringContaining('366') })
  })
})

describe('shiftOwnerIncomeDay', () => {
  it('moves forward and back in UTC days', () => {
    expect(shiftOwnerIncomeDay('2026-09-15', -14)).toBe('2026-09-01')
    expect(shiftOwnerIncomeDay('2026-09-01', 14)).toBe('2026-09-15')
  })

  it('crosses a month boundary', () => {
    expect(shiftOwnerIncomeDay('2026-09-01', -1)).toBe('2026-08-31')
  })

  it('crosses a year boundary', () => {
    expect(shiftOwnerIncomeDay('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('handles a leap day', () => {
    expect(shiftOwnerIncomeDay('2028-03-01', -1)).toBe('2028-02-29')
  })

  it('passes a malformed day through unchanged', () => {
    expect(shiftOwnerIncomeDay('later', 1)).toBe('later')
  })
})

describe('defaultOwnerIncomeRange', () => {
  it('seeds the last 30 days ending on max_day', () => {
    expect(defaultOwnerIncomeRange(LIMITS)).toEqual({ from: '2026-08-18', to: '2026-09-16' })
  })

  it('never seeds a range the bounds check would reject', () => {
    expect(checkOwnerIncomeRange(
      defaultOwnerIncomeRange(LIMITS).from,
      defaultOwnerIncomeRange(LIMITS).to,
      LIMITS
    )).toEqual({ valid: true })
  })

  it('clamps to min_day when the programme is younger than the default span', () => {
    const limits: OwnerIncomeRangeLimits = { min_day: '2026-09-10', max_day: '2026-09-16', max_span_days: 366 }

    expect(defaultOwnerIncomeRange(limits)).toEqual({ from: '2026-09-10', to: '2026-09-16' })
  })

  it('respects a max_span_days narrower than the default span', () => {
    const limits: OwnerIncomeRangeLimits = { min_day: '2026-01-01', max_day: '2026-09-16', max_span_days: 7 }
    const seeded = defaultOwnerIncomeRange(limits)

    expect(seeded).toEqual({ from: '2026-09-10', to: '2026-09-16' })
    expect(ownerIncomeRangeSpanDays(seeded.from, seeded.to)).toBe(7)
  })

  it('seeds nothing before the limits have loaded', () => {
    expect(defaultOwnerIncomeRange(null)).toEqual({ from: '', to: '' })
  })
})
