import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import type { RoomParticipant } from '../../app/types/room/audio'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

function makeParticipant(id: number, extra: Partial<RoomParticipant> = {}): RoomParticipant {
  return { id, name: `User${id}`, ...extra } as RoomParticipant
}

beforeEach(() => {
  setActivePinia(createPinia())
})

// ============================================================
// realtime-12 — setSeatCount resizes the seat array to per-Room max_seats
// ============================================================
describe('roomSeatsStore.setSeatCount', () => {
  it('grows the seat array so seats beyond the default count exist', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.setSeatCount(20)

    expect(store.seats).toHaveLength(20)

    // A seat added by the grow (index 19) must accept an occupant that
    // updateSeat's bounds guard would otherwise have dropped at length 15.
    store.updateSeat(19, 42, false)
    expect(store.seats[19]?.occupantId).toBe(42)
  })

  it('shrinks the seat array by slicing the tail', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.setSeatCount(5)

    expect(store.seats).toHaveLength(5)
  })

  it('preserves existing seat occupancy when growing', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.updateSeat(3, 7, true)
    store.setSeatCount(20)

    expect(store.seats[3]?.occupantId).toBe(7)
    expect(store.seats[3]?.isMuted).toBe(true)
  })

  it('is a no-op for a non-positive count', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    const before = store.seats.length
    store.setSeatCount(0)

    expect(store.seats).toHaveLength(before)
  })
})

// ============================================================
// Slices 8–9 — reconcileSeats (occupantId snapshot format)
// ============================================================
describe('roomSeatsStore.reconcileSeats', () => {
  it('applies an occupied seat from the snapshot using occupantId', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.reconcileSeats([{ seatIndex: 3, occupantId: 7, isMuted: true }])

    expect(store.seats[3]?.occupantId).toBe(7)
    expect(store.seats[3]?.isMuted).toBe(true)
  })

  it('clears a seat whose occupant is absent from the snapshot', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.updateSeat(0, 1, false)
    store.updateSeat(1, 2, false)

    // Snapshot only has occupant 1 on seat 0 — occupant 2 left
    store.reconcileSeats([{ seatIndex: 0, occupantId: 1, isMuted: false }])

    expect(store.seats[0]?.occupantId).toBe(1)
    expect(store.seats[1]?.occupantId).toBeNull()
  })

  it('preserves seat lock state when clearing a vacated seat', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.updateSeat(2, 9, false)
    store.setSeatLocked(2, true)

    store.reconcileSeats([]) // occupant 9 gone

    expect(store.seats[2]?.occupantId).toBeNull()
    expect(store.seats[2]?.isLocked).toBe(true)
  })
})

// ============================================================
// Slices 5–7 — speakerIds, setSeatMutedByUserId, clearParticipantFromSeat
// ============================================================
describe('roomSeatsStore.speakerIds', () => {
  it('contains the occupantId of every occupied seat', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.updateSeat(0, 1, false)
    store.updateSeat(2, 3, true)

    expect(store.speakerIds.has(1)).toBe(true)
    expect(store.speakerIds.has(3)).toBe(true)
    expect(store.speakerIds.size).toBe(2)
  })

  it('is empty when no seats are occupied', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    expect(store.speakerIds.size).toBe(0)
  })

  it('drops an id when the seat is cleared', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.updateSeat(0, 1, false)
    store.clearSeat(0)

    expect(store.speakerIds.has(1)).toBe(false)
  })
})

describe('roomSeatsStore.setSeatMutedByUserId', () => {
  it('mutes the seat for the given userId', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.updateSeat(0, 5, false)
    store.setSeatMutedByUserId(5, true)

    expect(store.seats[0]?.isMuted).toBe(true)
  })

  it('unmutes the seat for the given userId', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.updateSeat(0, 5, true)
    store.setSeatMutedByUserId(5, false)

    expect(store.seats[0]?.isMuted).toBe(false)
  })

  it('is a no-op for a userId not on any seat', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    // Should not throw
    expect(() => store.setSeatMutedByUserId(999, true)).not.toThrow()
  })
})

describe('roomSeatsStore.clearParticipantFromSeat', () => {
  it('clears the seat whose occupantId matches the userId', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.updateSeat(1, 7, true)
    store.clearParticipantFromSeat(7)

    expect(store.seats[1]?.occupantId).toBeNull()
    expect(store.seats[1]?.isMuted).toBe(false)
  })

  it('does not touch other seats', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.updateSeat(0, 7, false)
    store.updateSeat(1, 8, false)
    store.clearParticipantFromSeat(7)

    expect(store.seats[1]?.occupantId).toBe(8)
  })
})

// ============================================================
// Slice 4 — profile update propagates via seatsWithUsers automatically
// ============================================================
describe('roomSeatsStore.seatsWithUsers — reactivity', () => {
  it('reflects a profile update without any explicit sync call', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const seats = useRoomSeatsStore()
    const participants = useRoomParticipantsStore()

    participants.addParticipant(makeParticipant(1, { name: 'Alice' }))
    seats.updateSeat(0, 1, false)

    expect(seats.seatsWithUsers[0]?.user?.name).toBe('Alice')

    participants.updateParticipantProfile(1, { name: 'Bob' })

    // No refreshSeatUser call — just read seatsWithUsers
    expect(seats.seatsWithUsers[0]?.user?.name).toBe('Bob')
  })
})

// ============================================================
// Slice 2 — single-occupancy invariant
// ============================================================
describe('roomSeatsStore.updateSeat — single-occupancy', () => {
  it('clears the previous seat when the same occupant moves', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.updateSeat(0, 1, false)
    store.updateSeat(3, 1, false) // same occupant moves to seat 3

    expect(store.seats[0]?.occupantId).toBeNull()
    expect(store.seats[3]?.occupantId).toBe(1)
  })

  it('does not duplicate occupant across repeated moves', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.updateSeat(0, 1, false)
    store.updateSeat(3, 1, false)
    store.updateSeat(5, 1, false)

    const occupied = store.seats.filter((s) => s.occupantId === 1).map((s) => s.index)
    expect(occupied).toEqual([5])
  })

  it('does not disturb other occupants when one moves', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.updateSeat(0, 1, false)
    store.updateSeat(1, 2, false)
    store.updateSeat(3, 1, false) // occupant 1 moves; occupant 2 stays

    expect(store.seats[1]?.occupantId).toBe(2)
    expect(store.seats[0]?.occupantId).toBeNull()
    expect(store.seats[3]?.occupantId).toBe(1)
  })
})

// ============================================================
// Slice 3 — seatsWithUsers: joins occupantId → participant
// ============================================================
describe('roomSeatsStore.seatsWithUsers', () => {
  it('resolves the live participant for an occupied seat', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const seats = useRoomSeatsStore()
    const participants = useRoomParticipantsStore()

    participants.addParticipant(makeParticipant(1, { name: 'Alice' }))
    seats.updateSeat(0, 1, false)

    expect(seats.seatsWithUsers[0]?.user?.name).toBe('Alice')
  })

  it('returns null user when occupantId is not in participants', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const seats = useRoomSeatsStore()

    seats.updateSeat(0, 99, false) // no participant 99

    expect(seats.seatsWithUsers[0]?.user).toBeNull()
  })

  it('returns null user for an empty seat', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const seats = useRoomSeatsStore()

    expect(seats.seatsWithUsers[0]?.user).toBeNull()
  })
})

// ============================================================
// Slice 1 — updateSeat stores occupantId (not user object)
// ============================================================
describe('roomSeatsStore.updateSeat — occupantId', () => {
  it('sets occupantId on the seat', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.updateSeat(0, 42, false)

    expect(store.seats[0]?.occupantId).toBe(42)
  })

  it('clears occupantId when called with null', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.updateSeat(0, 42, false)
    store.updateSeat(0, null, false)

    expect(store.seats[0]?.occupantId).toBeNull()
  })

  it('seatsWithUsers user is null after clearing with null', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const seats = useRoomSeatsStore()
    const participants = useRoomParticipantsStore()

    participants.addParticipant(makeParticipant(3))
    seats.updateSeat(0, 3, false)
    seats.updateSeat(0, null, false)

    expect(seats.seatsWithUsers[0]?.user).toBeNull()
  })

  it('stores isMuted on the seat', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.updateSeat(2, 7, true)

    expect(store.seats[2]?.isMuted).toBe(true)
  })
})

// ============================================================
// clearSeat direct
// ============================================================
describe('roomSeatsStore.clearSeat', () => {
  it('sets occupantId to null and isMuted to false', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const store = useRoomSeatsStore()

    store.updateSeat(0, 5, true)
    store.clearSeat(0)

    expect(store.seats[0]?.occupantId).toBeNull()
    expect(store.seats[0]?.isMuted).toBe(false)
  })
})

// ============================================================
// seatsWithUsers — order independence
// ============================================================
describe('roomSeatsStore.seatsWithUsers — order independence', () => {
  it('resolves user when seat is set before participant is added', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const seats = useRoomSeatsStore()
    const participants = useRoomParticipantsStore()

    const userX = makeParticipant(10)
    seats.updateSeat(2, 10, false)
    participants.addParticipant(userX)

    expect(seats.seatsWithUsers[2]?.user?.id).toBe(10)
    expect(seats.seatsWithUsers[2]?.user?.name).toBe('User10')
  })
})

// ============================================================
// setSeatMutedByUserId — side-effect isolation
// ============================================================
describe('roomSeatsStore.setSeatMutedByUserId — side effects', () => {
  it('does not modify the participants store', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const seats = useRoomSeatsStore()
    const participants = useRoomParticipantsStore()

    participants.addParticipant(makeParticipant(5))
    seats.updateSeat(0, 5, false)
    const participantRef = participants.participants.get(5)

    seats.setSeatMutedByUserId(5, true)

    expect(participants.participants.get(5)).toBe(participantRef)
    expect(participants.participants.get(5)?.name).toBe('User5')
  })
})

// ============================================================
// Seat Reactions — activeReactions set/clear (ADR 0015 slice 01)
// ============================================================
describe('roomSeatsStore.activeReactions', () => {
  it('sets a reaction for a userId', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const seats = useRoomSeatsStore()

    seats.setReaction(7, '1f602')

    expect(seats.activeReactions.get(7)?.code).toBe('1f602')
    expect(typeof seats.activeReactions.get(7)?.startedAt).toBe('number')
  })

  it('replaces (does not queue) a reaction already playing for that userId', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const seats = useRoomSeatsStore()

    seats.setReaction(7, '1f602')
    seats.setReaction(7, '1f923')

    expect(seats.activeReactions.get(7)?.code).toBe('1f923')
    expect(seats.activeReactions.size).toBe(1)
  })

  it('clears a reaction for a userId', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const seats = useRoomSeatsStore()

    seats.setReaction(7, '1f602')
    seats.clearReaction(7)

    expect(seats.activeReactions.has(7)).toBe(false)
  })

  it("clearSeat also clears the vacated occupant's reaction", async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const seats = useRoomSeatsStore()

    seats.updateSeat(0, 7, false)
    seats.setReaction(7, '1f602')

    seats.clearSeat(0)

    expect(seats.activeReactions.has(7)).toBe(false)
  })

  it('clearParticipantFromSeat also clears the reaction', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const seats = useRoomSeatsStore()

    seats.updateSeat(0, 7, false)
    seats.setReaction(7, '1f602')

    seats.clearParticipantFromSeat(7)

    expect(seats.activeReactions.has(7)).toBe(false)
  })

  it('replace bumps startedAt so a Vue :key on code+startedAt remounts', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const seats = useRoomSeatsStore()

    seats.setReaction(7, '1f602')
    const first = seats.activeReactions.get(7)?.startedAt
    // Re-send the SAME code — must still count as a replace (new startedAt),
    // not a no-op, since a rapid double-send of the same reaction must restart.
    vi.spyOn(Date, 'now').mockReturnValueOnce((first ?? 0) + 50)
    seats.setReaction(7, '1f602')

    expect(seats.activeReactions.get(7)?.startedAt).not.toBe(first)
  })

  it('resetSeats clears all active reactions', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const seats = useRoomSeatsStore()

    seats.updateSeat(0, 7, false)
    seats.setReaction(7, '1f602')
    seats.updateSeat(1, 8, false)
    seats.setReaction(8, '1f923')

    seats.resetSeats()

    expect(seats.activeReactions.size).toBe(0)
  })

  it('reconcileSeats clears the reaction of an occupant absent from the snapshot', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const seats = useRoomSeatsStore()

    seats.updateSeat(0, 7, false)
    seats.setReaction(7, '1f602')

    seats.reconcileSeats([]) // occupant 7 gone from the snapshot

    expect(seats.activeReactions.has(7)).toBe(false)
  })

  it('seat:locked force-clear path (clearSeat on a locked occupied seat) clears the reaction', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const seats = useRoomSeatsStore()

    seats.updateSeat(0, 7, false)
    seats.setReaction(7, '1f602')

    // Mirrors useRoomEventHandlers' seat:locked handler: lock, then clearSeat
    // the occupant it just kicked.
    seats.setSeatLocked(0, true)
    seats.clearSeat(0)

    expect(seats.activeReactions.has(7)).toBe(false)
  })

  it('updateSeat reassigning a seat to a DIFFERENT occupant clears the vacated occupant reaction', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const seats = useRoomSeatsStore()

    seats.updateSeat(0, 7, false)
    seats.setReaction(7, '1f602')

    // Seat 0 handed to occupant 8 directly (e.g. reconcileSeats replacing the
    // same seatIndex with a new occupant) — no intervening `seat:cleared`.
    seats.updateSeat(0, 8, false)

    expect(seats.activeReactions.has(7)).toBe(false)
    expect(seats.seats[0]?.occupantId).toBe(8)
  })

  it('updateSeat re-affirming the SAME occupant on their own seat leaves their reaction untouched', async () => {
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const seats = useRoomSeatsStore()

    seats.updateSeat(0, 7, false)
    seats.setReaction(7, '1f602')

    seats.updateSeat(0, 7, true) // e.g. a mute-state refresh for the same occupant

    expect(seats.activeReactions.has(7)).toBe(true)
  })
})
