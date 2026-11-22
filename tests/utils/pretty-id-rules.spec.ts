// ========================================
// Pretty ID rules engine tests
// ========================================

import { describe, it, expect } from 'vitest'
import {
  classifyPrettyId,
  isPrettyIdAuctionNumber,
  prettyIdShape,
  validatePrettyId,
} from '~/utils/pretty-id-rules'
import type { PrettyIdTier } from '~/types/pretty-id'

describe('classifyPrettyId', () => {
  const cases: Array<[string, PrettyIdTier]> = [
    ['888888', 'legend'],
    ['8888', 'legend'],
    ['111111', 'legend'],
    ['520', 'couple'],
    ['5201314', 'couple'],
    ['1314520', 'couple'],
    ['520520', 'couple'],
    ['123456', 'sequence'],
    ['654321', 'sequence'],
    ['4567', 'sequence'],
    ['168861', 'lucky'],
    ['520131', 'lucky'],
    ['999888', 'lucky'],
    ['123321', 'mirror'],
    ['1221', 'mirror'],
    ['131313', 'repeat'],
    ['121212', 'repeat'],
    ['135790', 'standard'],
    ['2468', 'standard'],
  ]

  it.each(cases)('classifies %s as %s', (id, tier) => {
    expect(classifyPrettyId(id)).toBe(tier)
  })

  it('does not call a short repdigit a legend', () => {
    expect(classifyPrettyId('88')).not.toBe('legend')
    expect(classifyPrettyId('888')).toBe('lucky')
  })

  it('checks legend before lucky, and lucky before mirror', () => {
    expect(classifyPrettyId('888888')).toBe('legend')
    // 168861 is a palindrome too, but the "168" substring wins.
    expect(classifyPrettyId('168861')).toBe('lucky')
  })
})

describe('prettyIdShape', () => {
  it('names digits by first occurrence', () => {
    expect(prettyIdShape('888888')).toBe('AAAAAA')
    expect(prettyIdShape('520520')).toBe('ABCABC')
    expect(prettyIdShape('1221')).toBe('ABBA')
    expect(prettyIdShape('135790')).toBe('ABCDEF')
  })
})

describe('isPrettyIdAuctionNumber', () => {
  it('accepts 1–99 without a leading zero', () => {
    expect(isPrettyIdAuctionNumber('7')).toBe(true)
    expect(isPrettyIdAuctionNumber('99')).toBe(true)
    expect(isPrettyIdAuctionNumber('10')).toBe(true)
  })

  it('rejects zero, three digits, leading zeros and non-digits', () => {
    expect(isPrettyIdAuctionNumber('0')).toBe(false)
    expect(isPrettyIdAuctionNumber('100')).toBe(false)
    expect(isPrettyIdAuctionNumber('07')).toBe(false)
    expect(isPrettyIdAuctionNumber('a')).toBe(false)
    expect(isPrettyIdAuctionNumber('')).toBe(false)
  })
})

describe('validatePrettyId', () => {
  it('accepts a clean ID of the right length', () => {
    expect(validatePrettyId('888888', 6)).toBeNull()
    expect(validatePrettyId('8888', 4)).toBeNull()
    expect(validatePrettyId('135790', 6)).toBeNull()
  })

  it('reports each failure reason', () => {
    expect(validatePrettyId('0123', 4)).toBe('leading_zero')
    expect(validatePrettyId('12a4', 4)).toBe('digits_only')
    expect(validatePrettyId('', 6)).toBe('digits_only')
    expect(validatePrettyId('12345', 6)).toBe('wrong_length')
  })

  it('reserves blocked numbers and the staff / system ranges', () => {
    expect(validatePrettyId('1000', 4)).toBe('reserved')
    expect(validatePrettyId('1234', 4)).toBe('reserved')
    expect(validatePrettyId('444444', 6)).toBe('reserved')
    expect(validatePrettyId('100500', 6)).toBe('reserved')
    expect(validatePrettyId('1099', 4)).toBe('reserved')
    expect(validatePrettyId('1100', 4)).toBeNull()
    expect(validatePrettyId('101000', 6)).toBeNull()
  })

  it('checks the digit pattern before the length, and the length before a leading zero', () => {
    expect(validatePrettyId('0a', 6)).toBe('digits_only')
    expect(validatePrettyId('0123', 6)).toBe('wrong_length')
  })
})
