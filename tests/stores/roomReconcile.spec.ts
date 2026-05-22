import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, nextTick, ref } from 'vue'

import { useRoomAudioStore } from '../../app/stores/roomAudio'
import { useRoomSeatsStore } from '../../app/stores/roomSeats'
import type { RoomParticipant } from '../../app/types/room/audio'

// Nuxt auto-imports used inside the stores
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('nextTick', nextTick)

function user(id: number, extra: Partial<RoomParticipant> = {}): RoomParticipant {
  return { id, name: `U${id}`, ...extra } as RoomParticipant
}

beforeEach(() => {
  setActivePinia(createPinia())
})

// These specs lock in the anti-drift guarantee: the join snapshot is
// authoritative, so a re-join (reconnect / resume) must PRUNE participants and
// seats that are no longer present rather than merge onto stale state. Before
// the reconcile fix, the participant Map only ever grew and the displayed count
// drifted asymmetrically between clients (the reported "1 vs 2" bug).
describe('roomAudioStore.reconcileParticipants', () => {
  it('prunes participants absent from the snapshot, preserving self', () => {
    const store = useRoomAudioStore()
    store.addParticipant(user(1)) // self
    store.addParticipant(user(2)) // ghost — will be absent from next snapshot
    store.addParticipant(user(3))

    // Re-join snapshot no longer contains user 2 (they left while we were away)
    store.reconcileParticipants([user(3)], 1)

    const ids = store.participantList.map((p) => p.id).sort()
    expect(ids).toEqual([1, 3]) // self kept, ghost (2) pruned, 3 retained
  })

  it('does not accumulate ghosts across repeated re-joins', () => {
    const store = useRoomAudioStore()
    store.addParticipant(user(1)) // self

    store.reconcileParticipants([user(2), user(3)], 1)
    expect(store.participantList).toHaveLength(3)

    // Second re-join: room shrank to just self + user 2
    store.reconcileParticipants([user(2)], 1)
    expect(store.participantList.map((p) => p.id).sort()).toEqual([1, 2])
  })

  it('upserts an existing participant in place (no duplicate, fields updated)', () => {
    const store = useRoomAudioStore()
    store.addParticipant(user(5, { name: 'Old' }))

    store.reconcileParticipants([user(5, { name: 'New' })], undefined)

    expect(store.participantList).toHaveLength(1)
    expect(store.participants.get(5)?.name).toBe('New')
  })
})

describe('roomSeatsStore.reconcileSeats', () => {
  it('clears a seat whose occupant is absent from the snapshot', () => {
    const store = useRoomSeatsStore()
    store.updateSeat(0, user(1), false, [])
    store.updateSeat(1, user(2), false, [])

    // Snapshot only has user 1 on seat 0 — user 2 left their seat
    store.reconcileSeats([{ seatIndex: 0, user: user(1), isMuted: false }], [])

    expect(store.seats[0]?.user?.id).toBe(1)
    expect(store.seats[1]?.user).toBeNull()
  })

  it('preserves seat lock state when clearing a vacated seat', () => {
    const store = useRoomSeatsStore()
    store.updateSeat(2, user(9), false, [])
    store.setSeatLocked(2, true)

    store.reconcileSeats([], []) // user 9 gone

    expect(store.seats[2]?.user).toBeNull()
    expect(store.seats[2]?.isLocked).toBe(true)
  })

  it('applies occupied seats from the snapshot', () => {
    const store = useRoomSeatsStore()

    store.reconcileSeats(
      [
        { seatIndex: 3, user: user(7), isMuted: true },
        { seatIndex: 4, user: user(8), isMuted: false },
      ],
      [8],
    )

    expect(store.seats[3]?.user?.id).toBe(7)
    expect(store.seats[3]?.isMuted).toBe(true)
    expect(store.seats[4]?.user?.id).toBe(8)
    expect(store.seats[4]?.isActive).toBe(true) // user 8 is an active speaker
  })
})
