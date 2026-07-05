import { describe, it, expect } from 'vitest'
import { shouldReproduceOnReclaim, type SeatSnapshotEntry } from '../../app/utils/seatReclaim'

const seat = (userId: number, seatIndex = 0): SeatSnapshotEntry => ({
  seatIndex,
  userId,
  isMuted: false,
})

describe('shouldReproduceOnReclaim (realtime-22)', () => {
  it('re-produces when the user is seated in the snapshot and not yet producing', () => {
    expect(shouldReproduceOnReclaim([seat(42, 3)], 42, false)).toBe(true)
  })

  it('does NOT re-produce on a fresh join (user absent from their own snapshot)', () => {
    expect(shouldReproduceOnReclaim([seat(7), seat(9)], 42, false)).toBe(false)
  })

  it('does NOT re-produce when already producing (guards a benign rejoin)', () => {
    expect(shouldReproduceOnReclaim([seat(42, 3)], 42, true)).toBe(false)
  })

  it('does NOT re-produce for an unauthenticated user (no id)', () => {
    expect(shouldReproduceOnReclaim([seat(42, 3)], undefined, false)).toBe(false)
  })

  it('handles an absent/empty seats snapshot without throwing', () => {
    expect(shouldReproduceOnReclaim(undefined, 42, false)).toBe(false)
    expect(shouldReproduceOnReclaim([], 42, false)).toBe(false)
  })
})
