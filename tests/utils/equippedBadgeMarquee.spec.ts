import { describe, it, expect } from 'vitest'
import type { EquippedBadge } from '../../app/types/progression/badge'

// Mirrors sorted + shouldMarquee computeds in EquippedBadgeMarquee.vue
type SlottedBadge = { slot_position: number; badge_id: number; image_url: string }
function sortedBadges(equippedBadges: EquippedBadge[]): SlottedBadge[] {
  return equippedBadges
    .filter((b): b is SlottedBadge => b.image_url !== null)
    .sort((a, b) => a.slot_position - b.slot_position)
}
const shouldMarquee = (sorted: SlottedBadge[]) => sorted.length > 3

function makeEquipped(slot: number, id: number, imageUrl: string | null = `https://cdn/b${id}.png`): EquippedBadge {
  return { slot_position: slot, badge_id: id, image_url: imageUrl }
}

describe('EquippedBadgeMarquee sorted logic', () => {
  it('returns empty array for empty input → component hides', () => {
    expect(sortedBadges([])).toEqual([])
  })

  it('filters out badges with null image_url', () => {
    const input = [makeEquipped(1, 10, null), makeEquipped(2, 20)]
    const result = sortedBadges(input)
    expect(result).toHaveLength(1)
    expect(result[0]!.badge_id).toBe(20)
  })

  it('sorts by slot_position ascending when input is unordered', () => {
    const input = [makeEquipped(3, 30), makeEquipped(1, 10), makeEquipped(2, 20)]
    const result = sortedBadges(input)
    expect(result.map(b => b.slot_position)).toEqual([1, 2, 3])
  })

  it('preserves already-sorted input', () => {
    const input = [makeEquipped(1, 10), makeEquipped(2, 20), makeEquipped(3, 30)]
    const result = sortedBadges(input)
    expect(result.map(b => b.slot_position)).toEqual([1, 2, 3])
  })

  it('filters null image_url AND sorts remaining by slot', () => {
    const input = [makeEquipped(3, 30), makeEquipped(2, 20, null), makeEquipped(1, 10)]
    const result = sortedBadges(input)
    expect(result).toHaveLength(2)
    expect(result[0]!.slot_position).toBe(1)
    expect(result[1]!.slot_position).toBe(3)
  })
})

describe('EquippedBadgeMarquee shouldMarquee', () => {
  it('does not scroll with 3 or fewer badges', () => {
    expect(shouldMarquee(sortedBadges([makeEquipped(1, 1)]))).toBe(false)
    expect(shouldMarquee(sortedBadges([makeEquipped(1, 1), makeEquipped(2, 2), makeEquipped(3, 3)]))).toBe(false)
  })

  it('scrolls with 4 or more badges', () => {
    const four = [1, 2, 3, 4].map(i => makeEquipped(i, i))
    expect(shouldMarquee(sortedBadges(four))).toBe(true)
  })
})
