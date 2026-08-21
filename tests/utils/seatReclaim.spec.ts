import { describe, it, expect } from 'vitest'
import {
  shouldReproduceOnReclaim,
  decideSeatReclaim,
  decidePendingDrain,
  type SeatSnapshotEntry,
} from '../../app/utils/seatReclaim'

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

// ============================================================
// mic-fgs-crash 02 — the visibility gate and its drain
//
// Table-driven, zero mocks. These two functions are the entire GATE for the F6
// crash: an ungated re-produce from a socket callback started a `microphone`
// foreground service while the app was backgrounded, Android refused it, and
// the process died. Every row below is a case named in spec D2, D6 or the
// recovery user stories.
// ============================================================

describe('decideSeatReclaim (mic-fgs-crash 02)', () => {
  const base = { seats: [seat(42, 3)], userId: 42, isProducing: false, isVisible: true }

  const cases: Array<{
    name: string
    input: Parameters<typeof decideSeatReclaim>[0]
    expected: ReturnType<typeof decideSeatReclaim>
  }> = [
    {
      name: 'seated + not producing + VISIBLE → re-produce now (today\'s behaviour, unchanged)',
      input: { ...base, isVisible: true },
      expected: 'reproduce',
    },
    {
      name: 'seated + not producing + HIDDEN → defer (this is the crash fix)',
      input: { ...base, isVisible: false },
      expected: 'defer',
    },
    {
      name: 'already producing + visible → nothing owed (double-produce guard holds)',
      input: { ...base, isProducing: true, isVisible: true },
      expected: 'none',
    },
    {
      name: 'already producing + hidden → nothing owed, and nothing deferred either',
      input: { ...base, isProducing: true, isVisible: false },
      expected: 'none',
    },
    {
      name: 'fresh join (absent from own snapshot) + visible → nothing owed',
      input: { ...base, seats: [seat(7), seat(9)], isVisible: true },
      expected: 'none',
    },
    {
      name: 'cross-region edge Room reserves no Seats: absent from snapshot + hidden → NO pending re-claim',
      input: { ...base, seats: [], isVisible: false },
      expected: 'none',
    },
    {
      name: 'undefined snapshot + hidden → no pending re-claim',
      input: { ...base, seats: undefined, isVisible: false },
      expected: 'none',
    },
    {
      name: 'unauthenticated (no user id) + hidden → nothing owed',
      input: { ...base, userId: undefined, isVisible: false },
      expected: 'none',
    },
  ]

  it.each(cases)('$name', ({ input, expected }) => {
    expect(decideSeatReclaim(input)).toBe(expected)
  })

  it('never disagrees with the existing predicate about WHETHER a re-claim is owed', () => {
    for (const isVisible of [true, false]) {
      for (const isProducing of [true, false]) {
        for (const seats of [[seat(42, 3)], [seat(7)], [], undefined]) {
          const owed = shouldReproduceOnReclaim(seats, 42, isProducing)
          const action = decideSeatReclaim({ seats, userId: 42, isProducing, isVisible })
          expect(action === 'none').toBe(!owed)
        }
      }
    }
  })
})

describe('decidePendingDrain (mic-fgs-crash 02)', () => {
  const cases: Array<{
    name: string
    input: Parameters<typeof decidePendingDrain>[0]
    expected: ReturnType<typeof decidePendingDrain>
  }> = [
    {
      name: 'pending + still seated + not producing → re-produce (the regression guard: a deferred re-claim MUST come back)',
      input: { pending: true, seatedNow: true, isProducing: false },
      expected: 'reproduce',
    },
    {
      name: 'nothing pending → no-op, however the rest looks',
      input: { pending: false, seatedNow: true, isProducing: false },
      expected: 'none',
    },
    {
      name: 'nothing pending and not seated → still a no-op, no spurious seat-lost',
      input: { pending: false, seatedNow: false, isProducing: false },
      expected: 'none',
    },
    {
      name: 'pending but already producing → nothing to settle (session healed by another route)',
      input: { pending: true, seatedNow: true, isProducing: true },
      expected: 'none',
    },
    {
      // ONE row, not a family (spec D6): unreachable via the retention window,
      // which never creates a pending re-claim. Needs a separate event — a
      // moderator clearing the Seat, or a second disconnect.
      name: 'pending + Seat is no longer ours → seat-lost, the rare branch',
      input: { pending: true, seatedNow: false, isProducing: false },
      expected: 'seat-lost',
    },
    {
      name: 'pending + not seated + already producing → producing wins, no seat-lost noise',
      input: { pending: true, seatedNow: false, isProducing: true },
      expected: 'none',
    },
  ]

  it.each(cases)('$name', ({ input, expected }) => {
    expect(decidePendingDrain(input)).toBe(expected)
  })
})
