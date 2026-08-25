/**
 * Unit tests for useRoomGifts.sendGift — single burst emit + sender-side
 * optimistic accumulation (daily-room-xp 03: daily_xp must mirror the
 * existing room_xp bump; gift-burst-send 09: one emit per multi-recipient send).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed, type Ref } from 'vue'
import { seatGiftValue } from '../../app/utils/gift'
import type { AudioSocket } from '../../app/types/room/audio'

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

describe('useRoomGifts.sendGift', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  async function setup(gift: { category: string; price: number }, seatedRecipientIds: number[]) {
    const { useRoomGifts } = await import('../../app/composables/room/useRoomGifts')
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useRoomStore } = await import('../../app/stores/room')

    const seatsStore = useRoomSeatsStore()
    const roomStore = useRoomStore()
    roomStore.setCurrentRoom({ id: 1, room_xp: '500', daily_xp: '100' } as never)
    seatedRecipientIds.forEach((id, index) => seatsStore.updateSeat(index, id, false))

    vi.stubGlobal('useRoomSeatsStore', () => seatsStore)
    vi.stubGlobal('useRoomStore', () => roomStore)
    vi.stubGlobal('useGiftData', () => ({ getGiftById: vi.fn().mockReturnValue(gift) }))

    const emit = vi.fn((_event: string, _payload: unknown, ack: (response: unknown) => void) => {
      ack({ success: true, acceptedRecipientIds: seatedRecipientIds })
    })
    const socket = ref({ emit, once: vi.fn(), off: vi.fn(), on: vi.fn() }) as unknown as Ref<AudioSocket | null>
    const { sendGift } = useRoomGifts({ socket, getCurrentRoomId: () => 'room-1' })

    return { sendGift, roomStore, emit }
  }

  it('emits exactly ONE gift:send burst for a multi-recipient send', async () => {
    const { sendGift, emit } = await setup({ category: 'normal', price: 50 }, [42, 43, 44])

    await sendGift(9, [42, 43, 44], 1)

    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit.mock.calls[0]?.[0]).toBe('gift:send')
    expect(emit.mock.calls[0]?.[1]).toMatchObject({
      roomId: 'room-1',
      giftId: 9,
      recipientIds: [42, 43, 44],
      quantity: 1,
    })
  })

  it('drops unseated recipients from the burst payload before emitting', async () => {
    const { sendGift, emit } = await setup({ category: 'normal', price: 50 }, [42])

    await sendGift(9, [42, 99], 1)

    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit.mock.calls[0]?.[1]).toMatchObject({ recipientIds: [42] })
  })

  it('resolves with the server ack', async () => {
    const { sendGift } = await setup({ category: 'normal', price: 50 }, [42])

    const ack = await sendGift(9, [42], 1)

    expect(ack).toEqual({ success: true, acceptedRecipientIds: [42] })
  })

  it('bumps daily_xp by seatGiftValue × seated-recipient-count for a normal gift, mirroring room_xp', async () => {
    const { sendGift, roomStore } = await setup({ category: 'normal', price: 50 }, [42, 43])

    await sendGift(9, [42, 43], 1)

    expect(roomStore.currentRoom?.daily_xp).toBe('200')
    expect(roomStore.currentRoom?.room_xp).toBe('600')
  })

  it('bumps daily_xp by the split-base amount for a lucky gift, matching room_xp', async () => {
    const { sendGift, roomStore } = await setup({ category: 'lucky', price: 100 }, [42])

    await sendGift(9, [42], 1)

    // Lucky gift: seatGiftValue = split base = floor(100 * 0.10) = 10.
    expect(roomStore.currentRoom?.daily_xp).toBe('110')
    expect(roomStore.currentRoom?.room_xp).toBe('510')
  })

  it('does not emit or bump daily_xp when no recipient is seated', async () => {
    const { sendGift, roomStore, emit } = await setup({ category: 'normal', price: 50 }, [])

    const ack = await sendGift(9, [99], 1)

    expect(emit).not.toHaveBeenCalled()
    expect(ack).toBeNull()
    expect(roomStore.currentRoom?.daily_xp).toBe('100')
  })
})
