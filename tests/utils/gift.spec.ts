import { describe, it, expect } from 'vitest'
import { batchItemTaps, seatGiftValue, wholeGiftValue } from '../../app/utils/gift'
import { LUCKY_SPLIT_SHARE } from '../../app/constants/room'
import type { Gift } from '../../app/types/gift/gift'

// ========================================
// Fixtures
// ========================================

function makeGift(category: Gift['category'], price: number): Pick<Gift, 'category' | 'price'> {
  return { category, price }
}

// ========================================
// Tests
// ========================================

describe('seatGiftValue', () => {
  it('adds only the split base for lucky gifts (100-coin lucky → 10)', () => {
    expect(seatGiftValue(makeGift('lucky', 100), 1)).toBe(10)
  })

  it('adds the full GCV for normal gifts (100-coin normal → 100)', () => {
    expect(seatGiftValue(makeGift('normal', 100), 1)).toBe(100)
  })

  it('adds the full GCV for other non-lucky categories', () => {
    expect(seatGiftValue(makeGift('premium', 100), 1)).toBe(100)
    expect(seatGiftValue(makeGift('vip-gifts', 50), 2)).toBe(100)
  })

  it('multiplies by quantity before applying the split base', () => {
    // GCV = 100 * 3 = 300; split base = 300 * 0.10 = 30
    expect(seatGiftValue(makeGift('lucky', 100), 3)).toBe(30)
  })

  it('keeps a fractional lucky split base unfloored (the backend floors per flush group, not per tap)', () => {
    // GCV = 15; 15 * 0.10 = 1.5 — flooring per tap showed 1, a third short.
    expect(seatGiftValue(makeGift('lucky', 15), 1)).toBe(1.5)
  })

  it('derives the lucky split base from the documented constant', () => {
    expect(LUCKY_SPLIT_SHARE).toBe(0.1)
    const gcv = 100
    expect(seatGiftValue(makeGift('lucky', gcv), 1)).toBe(gcv * LUCKY_SPLIT_SHARE)
  })
})

describe('batchItemTaps', () => {
  it('splits an evenly merged total back to per-tap quantity × taps', () => {
    expect(batchItemTaps(12, 4)).toEqual({ quantity: 3, taps: 4 })
  })

  it('passes a single tap through unchanged', () => {
    expect(batchItemTaps(5, 1)).toEqual({ quantity: 5, taps: 1 })
  })

  it('values a total that does not divide evenly as one tap of the total', () => {
    expect(batchItemTaps(3, 2)).toEqual({ quantity: 3, taps: 1 })
  })
})

describe('wholeGiftValue', () => {
  it('rounds a fractional total DOWN, like the backend — never up', () => {
    expect(wholeGiftValue(1.5)).toBe(1)
    expect(wholeGiftValue(4.5)).toBe(4)
  })

  it('absorbs float drift: ten 13-coin lucky taps show 13, not 12', () => {
    let total = 0
    for (let i = 0; i < 10; i++) total += seatGiftValue(makeGift('lucky', 13), 1)
    expect(wholeGiftValue(total)).toBe(13)
  })

  it('leaves whole totals unchanged', () => {
    expect(wholeGiftValue(0)).toBe(0)
    expect(wholeGiftValue(13600)).toBe(13600)
  })
})
