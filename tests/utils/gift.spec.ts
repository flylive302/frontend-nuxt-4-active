import { describe, it, expect } from 'vitest'
import { seatGiftValue } from '../../app/utils/gift'
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

  it('multiplies by quantity before applying the split base, then floors', () => {
    // GCV = 100 * 3 = 300; split base = floor(300 * 0.10) = 30
    expect(seatGiftValue(makeGift('lucky', 100), 3)).toBe(30)
  })

  it('floors fractional lucky split bases', () => {
    // GCV = 55; floor(55 * 0.10) = floor(5.5) = 5
    expect(seatGiftValue(makeGift('lucky', 55), 1)).toBe(5)
  })

  it('derives the lucky split base from the documented constant', () => {
    expect(LUCKY_SPLIT_SHARE).toBe(0.1)
    const gcv = 100
    expect(seatGiftValue(makeGift('lucky', gcv), 1)).toBe(Math.floor(gcv * LUCKY_SPLIT_SHARE))
  })
})
