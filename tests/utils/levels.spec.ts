import { describe, it, expect } from 'vitest'

import { computeLevelStatus } from '../../app/utils/levels'

// Mirrors the level-math coverage that previously lived in useLevelActions.spec
// (the composable now only writes XP; computeLevelStatus owns the calculation).
const LEVELS = [
  { level: 1, name: 'Bronze', required_xp: 0, image_url: 'https://example.com/bronze.webp' },
  { level: 2, name: 'Silver', required_xp: 100, image_url: 'https://example.com/silver.webp' },
  { level: 3, name: 'Gold', required_xp: 500, image_url: 'https://example.com/gold.webp' },
]

describe('computeLevelStatus', () => {
  it('computes progress percentage and remaining XP within a level', () => {
    // XP 300 sits in level 2 (100→500): 200/400 = 50%, 200 remaining
    const status = computeLevelStatus(300, LEVELS)
    expect(status.current_level).toBe(2)
    expect(status.level_name).toBe('Silver')
    expect(status.progress_percentage).toBe(50)
    expect(status.xp_remaining).toBe(200)
    expect(status.image_url).toBe('https://example.com/silver.webp')
  })

  it('caps at the highest level with 100% progress and no remaining', () => {
    const status = computeLevelStatus(9999, LEVELS)
    expect(status.current_level).toBe(3)
    expect(status.level_name).toBe('Gold')
    expect(status.progress_percentage).toBe(100)
    expect(status.xp_remaining).toBe(0)
    expect(status.image_url).toBe('https://example.com/gold.webp')
  })

  it('returns level 1 (start of progression) for zero XP', () => {
    const status = computeLevelStatus(0, LEVELS)
    expect(status.current_level).toBe(1)
    expect(status.level_name).toBe('Bronze')
  })

  it('parses string XP values', () => {
    const status = computeLevelStatus('300', LEVELS)
    expect(status.current_level).toBe(2)
    expect(status.progress_percentage).toBe(50)
  })

  it('returns an Unknown level-0 status when config is empty', () => {
    const status = computeLevelStatus(300, [])
    expect(status.current_level).toBe(0)
    expect(status.level_name).toBe('Unknown')
    expect(status.progress_percentage).toBe(0)
  })
})
