import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import type { RoomParticipant } from '../../app/types/room/audio'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

function makeParticipant(id: number, overrides: Partial<RoomParticipant> = {}): RoomParticipant {
  return {
    id,
    name: `User ${id}`,
    signature: '',
    country: 'US',
    wealth_xp: '0',
    charm_xp: '0',
    frame_id: null,
    chat_bubble_id: null,
    entry_animation_id: null,
    data_card_id: null,
    mice_wave_id: null,
    slides_id: null,
    avatar: null,
    cover_image: null,
    gender: null,
    date_of_birth: null,
    vip_level: 0,
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

// ============================================================
// addParticipant
// ============================================================
describe('useRoomParticipantsStore.addParticipant', () => {
  it('adds the participant to participantList', async () => {
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const store = useRoomParticipantsStore()

    store.addParticipant(makeParticipant(1))

    expect(store.participantList).toHaveLength(1)
    expect(store.participantList[0]?.id).toBe(1)
  })

  it('overwrites the existing entry when called with the same id', async () => {
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const store = useRoomParticipantsStore()

    store.addParticipant(makeParticipant(1, { name: 'Alice' }))
    store.addParticipant(makeParticipant(1, { name: 'Bob' }))

    expect(store.participantList).toHaveLength(1)
    expect(store.participantList[0]?.name).toBe('Bob')
  })
})

// ============================================================
// removeParticipant
// ============================================================
describe('useRoomParticipantsStore.removeParticipant', () => {
  it('removes the participant from participantList', async () => {
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const store = useRoomParticipantsStore()

    store.addParticipant(makeParticipant(1))
    store.removeParticipant(1)

    expect(store.participantList).toHaveLength(0)
  })

  it('does nothing when the id is unknown', async () => {
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const store = useRoomParticipantsStore()

    store.addParticipant(makeParticipant(1))
    expect(() => store.removeParticipant(999)).not.toThrow()
    expect(store.participantList).toHaveLength(1)
  })
})

// ============================================================
// reconcileParticipants
// ============================================================
describe('useRoomParticipantsStore.reconcileParticipants', () => {
  it('result contains exactly the participants in the snapshot', async () => {
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const store = useRoomParticipantsStore()

    store.reconcileParticipants([makeParticipant(1), makeParticipant(2)])

    const ids = store.participantList.map((p) => p.id).sort((a, b) => a - b)
    expect(ids).toEqual([1, 2])
  })

  it('prunes participants absent from the snapshot', async () => {
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const store = useRoomParticipantsStore()

    store.addParticipant(makeParticipant(1))
    store.addParticipant(makeParticipant(2))
    store.reconcileParticipants([makeParticipant(1)])

    const ids = store.participantList.map((p) => p.id)
    expect(ids).toContain(1)
    expect(ids).not.toContain(2)
  })

  it('preserves keepSelfId participant even when absent from snapshot', async () => {
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const store = useRoomParticipantsStore()

    store.addParticipant(makeParticipant(1))
    store.addParticipant(makeParticipant(2))
    store.reconcileParticipants([makeParticipant(1)], 2)

    expect(store.participants.get(2)).toBeDefined()
  })

  it('preserves object identity for an existing participant', async () => {
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const store = useRoomParticipantsStore()

    const p = makeParticipant(1)
    store.addParticipant(p)
    const originalRef = store.participants.get(1)

    store.reconcileParticipants([makeParticipant(1)])

    expect(store.participants.get(1)).toBe(originalRef)
  })
})

// ============================================================
// updateParticipantProfile
// ============================================================
describe('useRoomParticipantsStore.updateParticipantProfile', () => {
  it('patches only the provided fields, leaving others unchanged', async () => {
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const store = useRoomParticipantsStore()

    store.addParticipant(makeParticipant(1, { name: 'Alice', avatar: 'a.png' }))
    store.updateParticipantProfile(1, { name: 'Alice Updated' })

    expect(store.participants.get(1)?.name).toBe('Alice Updated')
    expect(store.participants.get(1)?.avatar).toBe('a.png')
  })

  it('is a no-op when the userId is unknown', async () => {
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const store = useRoomParticipantsStore()

    expect(() => store.updateParticipantProfile(999, { name: 'Ghost' })).not.toThrow()
  })
})

// ============================================================
// clear
// ============================================================
describe('useRoomParticipantsStore.clear', () => {
  it('empties participantList', async () => {
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const store = useRoomParticipantsStore()

    store.addParticipant(makeParticipant(1))
    store.addParticipant(makeParticipant(2))
    store.clear()

    expect(store.participantList).toHaveLength(0)
  })
})
