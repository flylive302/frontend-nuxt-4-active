// ========================================
// useSeatPickerOptions Composable Tests
// ========================================

import { describe, it, expect } from 'vitest'
import { buildSeatPickerOptions, resolveUnlockLevel } from '~/composables/room/useSeatPickerOptions'
import type { SeatPickerOption } from '~/composables/room/useSeatPickerOptions'
import type { SeatLadderLevel } from '~/types/user/bootstrap'

function byValueOf(options: SeatPickerOption[]): (value: number) => SeatPickerOption {
  const map = new Map(options.map((o) => [o.value, o]))
  return (value: number): SeatPickerOption => {
    const option = map.get(value)
    if (!option) throw new Error(`No seat option for value ${value}`)
    return option
  }
}

const LADDER: SeatLadderLevel[] = [
  { level: 3, cap: 20 },
  { level: 6, cap: 25 },
  { level: 10, cap: 30 },
]

describe('resolveUnlockLevel', () => {
  it('returns the lowest ladder level whose cap covers the tier', () => {
    expect(resolveUnlockLevel(20, LADDER)).toBe(3)
    expect(resolveUnlockLevel(25, LADDER)).toBe(6)
    expect(resolveUnlockLevel(30, LADDER)).toBe(10)
  })

  it('returns null when no ladder entry covers the tier (empty ladder)', () => {
    expect(resolveUnlockLevel(20, [])).toBeNull()
  })
})

describe('buildSeatPickerOptions', () => {
  it('lists every tier 5..30 step 5 regardless of cap', () => {
    const options = buildSeatPickerOptions(15, LADDER)
    expect(options.map((o) => o.value)).toEqual([5, 10, 15, 20, 25, 30])
  })

  it('level-0 room (cap 15): 20/25/30 locked with levels 3/6/10, others unlocked', () => {
    const options = buildSeatPickerOptions(15, LADDER)
    const byValue = byValueOf(options)

    expect(byValue(5).disabled).toBe(false)
    expect(byValue(10).disabled).toBe(false)
    expect(byValue(15).disabled).toBe(false)

    expect(byValue(20).disabled).toBe(true)
    expect(byValue(20).unlockLabel).toBe('Unlocks at room level 3')
    expect(byValue(25).disabled).toBe(true)
    expect(byValue(25).unlockLabel).toBe('Unlocks at room level 6')
    expect(byValue(30).disabled).toBe(true)
    expect(byValue(30).unlockLabel).toBe('Unlocks at room level 10')
  })

  it('level-3 room (cap 20): 20 unlocked, 25/30 locked', () => {
    const options = buildSeatPickerOptions(20, LADDER)
    const byValue = byValueOf(options)

    expect(byValue(20).disabled).toBe(false)
    expect(byValue(25).disabled).toBe(true)
    expect(byValue(25).unlockLabel).toBe('Unlocks at room level 6')
    expect(byValue(30).disabled).toBe(true)
    expect(byValue(30).unlockLabel).toBe('Unlocks at room level 10')
  })

  it('level-10 room (cap 30): every tier unlocked', () => {
    const options = buildSeatPickerOptions(30, LADDER)
    expect(options.every((o) => o.disabled === false)).toBe(true)
    expect(options.every((o) => o.unlockLabel === undefined)).toBe(true)
  })

  it('empty ladder: tiers above cap stay locked with no unlock sublabel', () => {
    const options = buildSeatPickerOptions(15, [])
    const byValue = byValueOf(options)

    expect(byValue(20).disabled).toBe(true)
    expect(byValue(20).unlockLabel).toBeUndefined()
    expect(byValue(25).disabled).toBe(true)
    expect(byValue(25).unlockLabel).toBeUndefined()
    expect(byValue(30).disabled).toBe(true)
    expect(byValue(30).unlockLabel).toBeUndefined()
  })
})
