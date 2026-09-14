import { describe, it, expect } from 'vitest'
import { VIP_NAME_COLOR, vipNameColor } from '../../app/constants/vip'

describe('vipNameColor', () => {
  it('returns empty (inherit) for undefined, null, 0 and levels below 3', () => {
    expect(vipNameColor(undefined)).toBe('')
    expect(vipNameColor(null)).toBe('')
    expect(vipNameColor(0)).toBe('')
    expect(vipNameColor(2)).toBe('')
  })

  it('returns the mapped colour for every listed level', () => {
    for (const [level, colour] of Object.entries(VIP_NAME_COLOR)) {
      expect(vipNameColor(Number(level))).toBe(colour)
    }
  })

  it('returns empty for a level above the table', () => {
    expect(vipNameColor(99)).toBe('')
  })
})
