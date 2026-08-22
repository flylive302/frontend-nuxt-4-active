import { describe, it, expect } from 'vitest'
import { percentToFraction } from '../../app/utils/audio/duck-level'
import { MIN_DUCK_LEVEL_PERCENT, MAX_DUCK_LEVEL_PERCENT } from '../../app/stores/audioPreferences'

describe('percentToFraction', () => {
  it('converts a mid-range percent to a 0-1 fraction', () => {
    expect(percentToFraction(20)).toBe(0.2)
  })

  it('clamps below the minimum', () => {
    expect(percentToFraction(0)).toBe(MIN_DUCK_LEVEL_PERCENT / 100)
    expect(percentToFraction(-50)).toBe(MIN_DUCK_LEVEL_PERCENT / 100)
  })

  it('clamps above the maximum', () => {
    expect(percentToFraction(100)).toBe(MAX_DUCK_LEVEL_PERCENT / 100)
    expect(percentToFraction(999)).toBe(MAX_DUCK_LEVEL_PERCENT / 100)
  })

  it('converts the boundary values exactly', () => {
    expect(percentToFraction(MIN_DUCK_LEVEL_PERCENT)).toBe(MIN_DUCK_LEVEL_PERCENT / 100)
    expect(percentToFraction(MAX_DUCK_LEVEL_PERCENT)).toBe(MAX_DUCK_LEVEL_PERCENT / 100)
  })
})
