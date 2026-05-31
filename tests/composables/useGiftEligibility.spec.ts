import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import type { RoomParticipant } from '../../app/types/room/audio'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

function makeParticipant(id: number): RoomParticipant {
  return { id, name: `User ${id}` } as RoomParticipant
}

beforeEach(async () => {
  setActivePinia(createPinia())

  const { useGiftStore } = await import('../../app/stores/gift')
  const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')

  // Provide real store factories as Nuxt auto-import globals
  ;(globalThis as Record<string, unknown>).useGiftStore = useGiftStore
  ;(globalThis as Record<string, unknown>).useRoomSeatsStore = useRoomSeatsStore
  // Auth store: plain mock — composable only reads user?.id, no reactivity needed
  ;(globalThis as Record<string, unknown>).useAuthStore = () => ({ user: { id: 1 } })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'useGiftStore')
  Reflect.deleteProperty(globalThis, 'useAuthStore')
  Reflect.deleteProperty(globalThis, 'useRoomSeatsStore')
})

// ============================================================
// eligibleRecipients — null lock
// ============================================================
describe('useGiftEligibility.eligibleRecipients — lockedRecipientId null', () => {
  it('returns all seated non-self users', async () => {
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useGiftEligibility } = await import('../../app/composables/gift/useGiftEligibility')

    useRoomParticipantsStore().addParticipant(makeParticipant(2))
    useRoomParticipantsStore().addParticipant(makeParticipant(3))
    useRoomSeatsStore().updateSeat(0, 2, false)
    useRoomSeatsStore().updateSeat(1, 3, false)

    const { eligibleRecipients } = useGiftEligibility()

    expect(eligibleRecipients.value.map(r => r.id).sort((a, b) => a - b)).toEqual([2, 3])
  })
})

// ============================================================
// eligibleRecipients — locked to a seated non-self user
// ============================================================
describe('useGiftEligibility.eligibleRecipients — lockedRecipientId set', () => {
  it('returns only the locked user', async () => {
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useGiftStore } = await import('../../app/stores/gift')
    const { useGiftEligibility } = await import('../../app/composables/gift/useGiftEligibility')

    useRoomParticipantsStore().addParticipant(makeParticipant(2))
    useRoomParticipantsStore().addParticipant(makeParticipant(3))
    useRoomSeatsStore().updateSeat(0, 2, false)
    useRoomSeatsStore().updateSeat(1, 3, false)
    useGiftStore().setLockedRecipient(2)

    const { eligibleRecipients } = useGiftEligibility()

    expect(eligibleRecipients.value.map(r => r.id)).toEqual([2])
  })

  it('returns empty when locked id is own user id (self-exclusion still applies)', async () => {
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useGiftStore } = await import('../../app/stores/gift')
    const { useGiftEligibility } = await import('../../app/composables/gift/useGiftEligibility')

    // Place self (user 1) on a seat so the lock has something to match
    useRoomParticipantsStore().addParticipant(makeParticipant(1))
    useRoomSeatsStore().updateSeat(0, 1, false)
    useGiftStore().setLockedRecipient(1)

    const { eligibleRecipients } = useGiftEligibility()

    expect(eligibleRecipients.value).toHaveLength(0)
  })

  it('returns empty when locked id has no corresponding seated user', async () => {
    const { useGiftStore } = await import('../../app/stores/gift')
    const { useGiftEligibility } = await import('../../app/composables/gift/useGiftEligibility')

    useGiftStore().setLockedRecipient(99)

    const { eligibleRecipients } = useGiftEligibility()

    expect(eligibleRecipients.value).toHaveLength(0)
  })
})

// ============================================================
// selectAllRecipients — locked mode
// ============================================================
describe('useGiftEligibility.selectAllRecipients — locked mode', () => {
  it('sets selectedRecipients to [X] only', async () => {
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useGiftStore } = await import('../../app/stores/gift')
    const { useGiftEligibility } = await import('../../app/composables/gift/useGiftEligibility')

    useRoomParticipantsStore().addParticipant(makeParticipant(2))
    useRoomParticipantsStore().addParticipant(makeParticipant(3))
    useRoomSeatsStore().updateSeat(0, 2, false)
    useRoomSeatsStore().updateSeat(1, 3, false)
    useGiftStore().setLockedRecipient(2)

    const { selectAllRecipients } = useGiftEligibility()
    selectAllRecipients()

    expect(useGiftStore().selectedRecipients).toEqual([2])
  })
})

// ============================================================
// eligibleRecipients — reactive unlock transition (test 9)
// ============================================================
describe('useGiftEligibility.eligibleRecipients — clearLockedRecipient', () => {
  it('returns all seated non-self users again after clearing the lock', async () => {
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useGiftStore } = await import('../../app/stores/gift')
    const { useGiftEligibility } = await import('../../app/composables/gift/useGiftEligibility')

    useRoomParticipantsStore().addParticipant(makeParticipant(2))
    useRoomParticipantsStore().addParticipant(makeParticipant(3))
    useRoomSeatsStore().updateSeat(0, 2, false)
    useRoomSeatsStore().updateSeat(1, 3, false)

    const giftStore = useGiftStore()
    const { eligibleRecipients } = useGiftEligibility()

    giftStore.setLockedRecipient(2)
    expect(eligibleRecipients.value.map(r => r.id)).toEqual([2])

    giftStore.clearLockedRecipient()
    expect(eligibleRecipients.value.map(r => r.id).sort((a, b) => a - b)).toEqual([2, 3])
  })
})
