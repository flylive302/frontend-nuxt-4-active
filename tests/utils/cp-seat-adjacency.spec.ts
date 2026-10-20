import { describe, expect, it } from 'vitest'
import { findAdjacentCpSeats, seatGridCols } from '~/utils/cp-seat-adjacency'

function seats(count: number, placed: Record<number, number>): (number | null)[] {
  return Array.from({ length: count }, (_, i) => placed[i] ?? null)
}

describe('seatGridCols', () => {
  it('is 5 up to 15 seats and 6 above', () => {
    expect(seatGridCols(8)).toBe(5)
    expect(seatGridCols(15)).toBe(5)
    expect(seatGridCols(16)).toBe(6)
  })
})

describe('findAdjacentCpSeats', () => {
  const pair = { binder_id: 10, partner_id: 20 }

  it('finds neighbours in the same row, binder left or right', () => {
    expect(findAdjacentCpSeats(seats(15, { 1: 10, 2: 20 }), [pair])).toEqual([{ left: 1, right: 2 }])
    expect(findAdjacentCpSeats(seats(15, { 1: 20, 2: 10 }), [pair])).toEqual([{ left: 1, right: 2 }])
  })

  it('ignores row ends (5 cols): seats 4 and 5', () => {
    expect(findAdjacentCpSeats(seats(15, { 4: 10, 5: 20 }), [pair])).toEqual([])
    expect(findAdjacentCpSeats(seats(15, { 9: 10, 10: 20 }), [pair])).toEqual([])
    expect(findAdjacentCpSeats(seats(15, { 3: 10, 4: 20 }), [pair])).toHaveLength(1)
  })

  it('uses 6 columns above 15 seats', () => {
    expect(findAdjacentCpSeats(seats(20, { 4: 10, 5: 20 }), [pair])).toEqual([{ left: 4, right: 5 }])
    expect(findAdjacentCpSeats(seats(20, { 5: 10, 6: 20 }), [pair])).toEqual([])
  })

  it('ignores non-adjacent, missing and unseated partners', () => {
    expect(findAdjacentCpSeats(seats(15, { 0: 10, 2: 20 }), [pair])).toEqual([])
    expect(findAdjacentCpSeats(seats(15, { 0: 10 }), [pair])).toEqual([])
    expect(findAdjacentCpSeats(seats(15, {}), [pair])).toEqual([])
  })

  it('handles multiple pairs', () => {
    const s = seats(15, { 0: 1, 1: 2, 7: 3, 8: 4 })
    const res = findAdjacentCpSeats(s, [
      { binder_id: 1, partner_id: 2 },
      { binder_id: 4, partner_id: 3 },
    ])
    expect(res).toEqual([{ left: 0, right: 1 }, { left: 7, right: 8 }])
  })

  it('a user in two pairs only hearts the neighbour that is adjacent', () => {
    const s = seats(15, { 0: 1, 1: 2, 7: 3 })
    const res = findAdjacentCpSeats(s, [
      { binder_id: 1, partner_id: 2 },
      { binder_id: 1, partner_id: 3 },
    ])
    expect(res).toEqual([{ left: 0, right: 1 }])
  })

  it('dedupes the same seat pair', () => {
    const s = seats(15, { 0: 1, 1: 2 })
    const res = findAdjacentCpSeats(s, [
      { binder_id: 1, partner_id: 2 },
      { binder_id: 2, partner_id: 1 },
    ])
    expect(res).toHaveLength(1)
  })
})
