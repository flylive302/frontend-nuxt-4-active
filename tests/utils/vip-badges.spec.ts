import { describe, it, expect } from 'vitest'
import { collectCumulativeBadges } from '../../app/utils/vip-badges'
import type { VipLevel } from '../../app/types/vip/vip-level'

function makeLevel(level: number, badgeIds: number[]): VipLevel {
  return {
    id: level,
    level,
    name: `VIP ${level}`,
    color: '#000000',
    price: 100,
    duration_days: 30,
    discount_percentage: 0,
    privileges: [],
    props: [],
    badges: badgeIds.map(id => ({
      id,
      name: `Badge ${id}`,
      icon_url: null,
      animated_url: null,
    })),
    is_active: true,
  }
}

describe('collectCumulativeBadges', () => {
  it('returns an empty array when levels is empty', () => {
    expect(collectCumulativeBadges([], 3)).toEqual([])
  })

  it('collects only the badges up to and including the target level', () => {
    const levels = [
      makeLevel(1, [1]),
      makeLevel(2, [2]),
      makeLevel(3, [3]),
    ]

    const result = collectCumulativeBadges(levels, 2)

    expect(result.map(b => b.id)).toEqual([1, 2])
  })

  it('excludes badges from levels above the target level', () => {
    const levels = [
      makeLevel(1, [1]),
      makeLevel(2, [2]),
      makeLevel(3, [3]),
    ]

    const result = collectCumulativeBadges(levels, 1)

    expect(result.map(b => b.id)).toEqual([1])
  })

  it('returns all badges when target level is the highest level', () => {
    const levels = [
      makeLevel(1, [1]),
      makeLevel(2, [2, 20]),
      makeLevel(3, [3]),
    ]

    const result = collectCumulativeBadges(levels, 3)

    expect(result.map(b => b.id)).toEqual([1, 2, 20, 3])
  })

  it('returns an empty array when target level is below every level', () => {
    const levels = [makeLevel(2, [2]), makeLevel(3, [3])]

    expect(collectCumulativeBadges(levels, 1)).toEqual([])
  })

  it('handles a level with an empty badges array gracefully', () => {
    const levels = [makeLevel(1, []), makeLevel(2, [2])]

    expect(collectCumulativeBadges(levels, 2).map(b => b.id)).toEqual([2])
  })
})
