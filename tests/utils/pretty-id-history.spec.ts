import { describe, expect, it } from 'vitest'
import {
  formatPrettyIdPktDateTime,
  formatPrettyIdWeekRange,
  parsePrettyIdHistoryMonth,
  prettyIdHistoryRoute,
  prettyIdMonthLabel,
  prettyIdMonthNeighbours,
  prettyIdPktMonth,
} from '../../app/utils/pretty-id-history'

describe('parsePrettyIdHistoryMonth', () => {
  it('keeps a valid YYYY-MM', () => {
    expect(parsePrettyIdHistoryMonth('2026-11')).toBe('2026-11')
    expect(parsePrettyIdHistoryMonth('2026-01')).toBe('2026-01')
  })

  it.each(['2026-13', '2026-00', '2026-1', '26-11', '2026-11-01', 'november', '', undefined, null, ['2026-11'], 202611])(
    'drops %j (the server then uses the current month)',
    (raw) => {
      expect(parsePrettyIdHistoryMonth(raw)).toBeNull()
    },
  )
})

describe('prettyIdHistoryRoute', () => {
  it('is the bare page without a month and carries ?month= with one', () => {
    expect(prettyIdHistoryRoute('winners')).toEqual({ path: '/pretty-id/winners' })
    expect(prettyIdHistoryRoute('weekly', null)).toEqual({ path: '/pretty-id/weekly' })
    expect(prettyIdHistoryRoute('weekly', '2026-10')).toEqual({ path: '/pretty-id/weekly', query: { month: '2026-10' } })
  })
})

describe('prettyIdPktMonth', () => {
  it('reads the month on the PKT clock, not UTC', () => {
    // 2026-10-31 20:00 UTC is 2026-11-01 01:00 PKT.
    expect(prettyIdPktMonth('2026-10-31T20:00:00.000Z')).toBe('2026-11')
    // 2026-11-30 19:30 UTC is 2026-12-01 00:30 PKT.
    expect(prettyIdPktMonth('2026-11-30T19:30:00.000Z')).toBe('2026-12')
    expect(prettyIdPktMonth('2026-11-30T18:59:59.999Z')).toBe('2026-11')
  })

  it('is null for a bad date', () => {
    expect(prettyIdPktMonth('soon')).toBeNull()
  })
})

describe('prettyIdMonthLabel', () => {
  it('spells the month out', () => {
    expect(prettyIdMonthLabel('2026-11')).toBe('November 2026')
    expect(prettyIdMonthLabel('2027-01')).toBe('January 2027')
  })

  it('returns an unrecognised value as is', () => {
    expect(prettyIdMonthLabel('nope')).toBe('nope')
  })
})

describe('prettyIdMonthNeighbours', () => {
  const months = ['2026-11', '2026-09', '2026-08']

  it('finds the older and newer listed month', () => {
    expect(prettyIdMonthNeighbours(months, '2026-09')).toEqual({ older: '2026-08', newer: '2026-11' })
  })

  it('has no newer at the newest and no older at the oldest', () => {
    expect(prettyIdMonthNeighbours(months, '2026-11')).toEqual({ older: '2026-09', newer: null })
    expect(prettyIdMonthNeighbours(months, '2026-08')).toEqual({ older: null, newer: '2026-09' })
  })

  it('works for a month that is not listed (a URL can ask for an empty month)', () => {
    expect(prettyIdMonthNeighbours(months, '2026-10')).toEqual({ older: '2026-09', newer: '2026-11' })
    expect(prettyIdMonthNeighbours(months, '2025-01')).toEqual({ older: null, newer: '2026-08' })
    expect(prettyIdMonthNeighbours([], '2026-11')).toEqual({ older: null, newer: null })
  })
})

describe('formatPrettyIdPktDateTime', () => {
  it('shows an instant on the PKT 12-hour clock', () => {
    expect(formatPrettyIdPktDateTime('2026-11-26T10:00:00.000Z')).toBe('26 Nov 2026, 3:00 PM')
    expect(formatPrettyIdPktDateTime('2026-11-08T19:30:00.000Z')).toBe('9 Nov 2026, 12:30 AM')
    expect(formatPrettyIdPktDateTime('2026-11-08T18:30:00.000Z')).toBe('8 Nov 2026, 11:30 PM')
    expect(formatPrettyIdPktDateTime('2026-11-26T07:05:00.000Z')).toBe('26 Nov 2026, 12:05 PM')
  })

  it('is empty for a bad date', () => {
    expect(formatPrettyIdPktDateTime('soon')).toBe('')
  })
})

describe('formatPrettyIdWeekRange', () => {
  it('shows the days and the month once', () => {
    expect(formatPrettyIdWeekRange('2026-11-23', '2026-11-29')).toBe('23 – 29 Nov')
    expect(formatPrettyIdWeekRange('2026-11-02', '2026-11-08')).toBe('2 – 8 Nov')
  })

  it('shows a one-day clipped week as a single date', () => {
    expect(formatPrettyIdWeekRange('2026-11-01', '2026-11-01')).toBe('1 Nov')
    expect(formatPrettyIdWeekRange('2026-11-30', '2026-11-30')).toBe('30 Nov')
  })

  it('is empty for a bad date', () => {
    expect(formatPrettyIdWeekRange('nope', '2026-11-29')).toBe('')
  })
})
