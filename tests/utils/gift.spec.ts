import { describe, it, expect } from 'vitest'
import {
  batchItemTaps,
  canAffordLuckyTap,
  compareGiftsForDrawer,
  isBindingGift,
  isComboPausingRefusal,
  seatGiftValue,
  wholeGiftValue,
} from '../../app/utils/gift'
import { LUCKY_SPLIT_SHARE } from '../../app/constants/room'
import { GIFT_SEND_ERROR, LUCKY_COMBO_PAUSING_REFUSAL_CODES } from '../../app/constants/gift'
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

describe('isBindingGift', () => {
  it('is true only for cp-gift + binding', () => {
    expect(isBindingGift({ category: 'cp-gift', subcategory: 'binding' })).toBe(true);
  });

  it.each([
    ['binding subcategory in another category', { category: 'normal', subcategory: 'binding' }],
    ['cp-gift with another subcategory', { category: 'cp-gift', subcategory: 'ring' }],
    ['cp-gift with null subcategory', { category: 'cp-gift', subcategory: null }],
    ['cp-gift with missing subcategory', { category: 'cp-gift' }],
  ] as const)('is false for %s', (_label, gift) => {
    expect(isBindingGift(gift)).toBe(false);
  });
});

describe('compareGiftsForDrawer', () => {
  const g = (price: number, sort_order: number, subcategory: string | null = null) => ({
    category: 'cp-gift' as const,
    subcategory,
    price,
    sort_order,
  });

  it('puts the binding gift first even when it is the most expensive', () => {
    const sorted = [g(10, 1), g(5000, 2, 'binding'), g(20, 3)].sort(compareGiftsForDrawer);

    expect(sorted.map((x) => x.price)).toEqual([5000, 10, 20]);
  });

  it('otherwise orders by price then sort_order', () => {
    const sorted = [g(20, 1), g(10, 9), g(10, 2)].sort(compareGiftsForDrawer);

    expect(sorted.map((x) => [x.price, x.sort_order])).toEqual([[10, 2], [10, 9], [20, 1]]);
  });
});

// ========================================
// gift-cashback-latency 06 — lucky combo gate + refusal predicate
// ========================================

describe('canAffordLuckyTap', () => {
  const COST = 50

  it('allows a tap when spendable minus in-flight still covers the cost', () => {
    expect(canAffordLuckyTap(3 * COST, 2 * COST, COST)).toBe(true)
  })

  it('allows a tap that spends the last coin exactly (>=, not >)', () => {
    expect(canAffordLuckyTap(COST, 0, COST)).toBe(true)
    expect(canAffordLuckyTap(2 * COST, COST, COST)).toBe(true)
  })

  it('refuses when in-flight taps have already claimed the balance', () => {
    expect(canAffordLuckyTap(3 * COST, 3 * COST, COST)).toBe(false)
    expect(canAffordLuckyTap(3 * COST, 2 * COST + 1, COST)).toBe(false)
  })

  it('refuses when the balance alone is short, even with nothing in flight', () => {
    expect(canAffordLuckyTap(COST - 1, 0, COST)).toBe(false)
  })
})

describe('isComboPausingRefusal', () => {
  it('pauses on every code in LUCKY_COMBO_PAUSING_REFUSAL_CODES', () => {
    expect(LUCKY_COMBO_PAUSING_REFUSAL_CODES.size).toBeGreaterThan(0)
    for (const code of LUCKY_COMBO_PAUSING_REFUSAL_CODES) {
      expect(isComboPausingRefusal({ success: false, code })).toBe(true)
    }
  })

  it('names INSUFFICIENT and MONEY_UNAVAILABLE', () => {
    expect(LUCKY_COMBO_PAUSING_REFUSAL_CODES.has('INSUFFICIENT')).toBe(true)
    expect(LUCKY_COMBO_PAUSING_REFUSAL_CODES.has('MONEY_UNAVAILABLE')).toBe(true)
  })

  it('pauses on the rate limiter, which acks an `error` string and no `code`', () => {
    expect(isComboPausingRefusal({ success: false, error: GIFT_SEND_ERROR.RATE_LIMITED })).toBe(true)
  })

  it('does not pause on refusals a wait would not fix', () => {
    for (const code of ['GIFT_NOT_SENDABLE', 'LUCKY_DISABLED', 'GIFT_UNKNOWN', 'SOMETHING_NEW']) {
      expect(isComboPausingRefusal({ success: false, code })).toBe(false)
    }
    expect(isComboPausingRefusal({ success: false, error: GIFT_SEND_ERROR.NOT_IN_ROOM })).toBe(false)
  })

  it('never pauses on a success ack or a missing ack (timeout / disconnect)', () => {
    expect(isComboPausingRefusal({ success: true })).toBe(false)
    expect(isComboPausingRefusal(null)).toBe(false)
  })
})
