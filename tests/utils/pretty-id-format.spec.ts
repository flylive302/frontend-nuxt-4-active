import { describe, expect, it } from 'vitest'
import { formatPrettyIdDays, formatPrettyIdDuration, formatPrettyIdShort } from '~/utils/pretty-id-format'

describe('formatPrettyIdShort', () => {
  it.each([
    [999, '999'],
    [1_000, '1K'],
    [50_000, '50K'],
    [1_000_000, '1M'],
    [1_200_000, '1.2M'],
    [1_250_000, '1.25M'],
    [10_000_000, '10M'],
  ])('%i -> %s', (input, expected) => {
    expect(formatPrettyIdShort(input)).toBe(expected)
  })
})

describe('formatPrettyIdDuration', () => {
  it('formats HH:MM:SS', () => {
    expect(formatPrettyIdDuration(3_723_000)).toBe('01:02:03')
    expect(formatPrettyIdDuration(59_999)).toBe('00:00:59')
  })

  it('prefixes whole days', () => {
    expect(formatPrettyIdDuration(2 * 86_400_000 + 3_723_000)).toBe('2D 01:02:03')
  })

  it('clamps negative and non-finite input at zero', () => {
    expect(formatPrettyIdDuration(-5_000)).toBe('00:00:00')
    expect(formatPrettyIdDuration(Number.NaN)).toBe('00:00:00')
  })
})

describe('formatPrettyIdDays', () => {
  it('pluralises', () => {
    expect(formatPrettyIdDays(1)).toBe('1 day')
    expect(formatPrettyIdDays(7)).toBe('7 days')
  })
})
