import { describe, it, expect } from 'vitest'
import { formatCoins, formatCurrency } from '../../app/utils/currency'

describe('formatCoins (exact spendable coins — gift-cashback-latency 06)', () => {
  it('groups thousands with commas', () => {
    expect(formatCoins('1234567')).toBe('1,234,567')
    expect(formatCoins(1_000)).toBe('1,000')
  })

  it('leaves amounts under a thousand ungrouped', () => {
    expect(formatCoins('999')).toBe('999')
    expect(formatCoins(0)).toBe('0')
  })

  it('never abbreviates to K/M, unlike formatCurrency', () => {
    for (const coins of [1_000, 12_345, 999_999, 1_000_000, 2_500_000, 123_456_789]) {
      const exact = formatCoins(coins)
      expect(exact).not.toMatch(/[KM]/)
      // Every digit survives: stripping separators gives back the whole number.
      expect(exact.replaceAll(',', '')).toBe(String(coins))
    }
    // The contrast the drawer used to show: 1.0K for 1,000-ish balances.
    expect(formatCurrency(1_000)).toBe('1.0K')
    expect(formatCoins(1_000)).not.toBe(formatCurrency(1_000))
  })

  it('treats a never-seeded balance (null/undefined/empty/garbage) as 0', () => {
    expect(formatCoins(null)).toBe('0')
    expect(formatCoins(undefined)).toBe('0')
    expect(formatCoins('')).toBe('0')
    expect(formatCoins('abc')).toBe('0')
  })

  it('truncates to whole coins — never rounds a fraction up', () => {
    expect(formatCoins('1999.9')).toBe('1,999')
  })
})
