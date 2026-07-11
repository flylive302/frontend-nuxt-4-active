/**
 * Unit tests for useRoomGifts.sendGift — sender-side optimistic accumulation
 * (daily-room-xp 03: daily_xp must mirror the existing room_xp bump).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import { seatGiftValue } from '../../app/utils/gift'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
// seatGiftValue is a Nuxt auto-import in the composable under test; stub the
// global with the real implementation so the split-base math is exercised.
vi.stubGlobal('seatGiftValue', seatGiftValue)
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

describe('useRoomGifts.sendGift — daily XP bump', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  async function setup(gift: { category: string; price: number }) {
    const { useRoomGifts, clearGiftQueue } = await import('../../app/composables/room/useRoomGifts')
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useRoomStore } = await import('../../app/stores/room')

    clearGiftQueue()

    const seatsStore = useRoomSeatsStore()
    const roomStore = useRoomStore()
    roomStore.setCurrentRoom({ id: 1, room_xp: '500', daily_xp: '100' } as never)
    // Seat the recipient (send path requires the recipient to be seated).
    seatsStore.updateSeat(0, 42, false)

    vi.stubGlobal('useRoomSeatsStore', () => seatsStore)
    vi.stubGlobal('useRoomStore', () => roomStore)
    vi.stubGlobal('useGiftData', () => ({ getGiftById: vi.fn().mockReturnValue(gift) }))

    const socket = ref({ emit: vi.fn() })
    const { sendGift } = useRoomGifts({ socket, getCurrentRoomId: () => 'room-1' })

    return { sendGift, roomStore }
  }

  it('bumps daily_xp by the seat-gift-value amount for a normal gift, mirroring room_xp', async () => {
    const { sendGift, roomStore } = await setup({ category: 'normal', price: 50 })

    sendGift(9, 42, 1)

    expect(roomStore.currentRoom?.daily_xp).toBe('150')
    expect(roomStore.currentRoom?.room_xp).toBe('550')
  })

  it('bumps daily_xp by the split-base amount for a lucky gift, matching room_xp', async () => {
    const { sendGift, roomStore } = await setup({ category: 'lucky', price: 100 })

    sendGift(9, 42, 1)

    // Lucky gift: seatGiftValue = split base = floor(100 * 0.10) = 10.
    expect(roomStore.currentRoom?.daily_xp).toBe('110')
    expect(roomStore.currentRoom?.room_xp).toBe('510')
  })

  it('does not bump daily_xp when the recipient is not seated', async () => {
    const { useRoomGifts, clearGiftQueue } = await import('../../app/composables/room/useRoomGifts')
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useRoomStore } = await import('../../app/stores/room')
    clearGiftQueue()

    const seatsStore = useRoomSeatsStore()
    const roomStore = useRoomStore()
    roomStore.setCurrentRoom({ id: 1, room_xp: '500', daily_xp: '100' } as never)
    vi.stubGlobal('useRoomSeatsStore', () => seatsStore)
    vi.stubGlobal('useRoomStore', () => roomStore)
    vi.stubGlobal('useGiftData', () => ({ getGiftById: vi.fn().mockReturnValue({ category: 'normal', price: 50 }) }))

    const socket = ref({ emit: vi.fn() })
    const { sendGift } = useRoomGifts({ socket, getCurrentRoomId: () => 'room-1' })

    // Recipient 99 is not on any seat.
    sendGift(9, 99, 1)

    expect(roomStore.currentRoom?.daily_xp).toBe('100')
  })
})
