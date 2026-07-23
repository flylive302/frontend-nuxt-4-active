/**
 * Unit tests for useGiftSending — burst send + per-batch refund reconciliation
 * (gift-burst-send 09).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed, watch, toRef } from 'vue'
import type { GiftSendAck } from '../../app/types/room/audio'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)
vi.stubGlobal('toRef', toRef)
vi.stubGlobal('createLogger', () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }))
vi.stubGlobal('useGiftPreload', vi.fn())
vi.stubGlobal('useLuckyFly', () => ({ triggerFly: vi.fn() }))
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

const GIFT = { id: 9, price: 50, category: 'normal', thumbnail_url: 'x.png' } as never

async function setup(sendGiftMock: ReturnType<typeof vi.fn>) {
  const { useGiftComboStore } = await import('../../app/stores/giftCombo')
  const { useGiftStore } = await import('../../app/stores/gift')
  const { useAuthStore } = await import('../../app/stores/auth')
  const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')

  const comboStore = useGiftComboStore()
  const giftStore = useGiftStore()
  const authStore = useAuthStore()
  const seatsStore = useRoomSeatsStore()

  authStore.user = { id: 1, name: 'Sender', coins: '1000' } as never

  vi.stubGlobal('useGiftComboStore', () => comboStore)
  vi.stubGlobal('useGiftStore', () => giftStore)
  vi.stubGlobal('useAuthStore', () => authStore)
  vi.stubGlobal('useRoomSeatsStore', () => seatsStore)
  vi.stubGlobal('useGiftEligibility', () => ({
    canAfford: computed(() => true),
    canSend: computed(() => true),
  }))
  vi.stubGlobal('useRoomAudio', () => ({ sendGift: sendGiftMock }))

  // Seat every recipient the tests select so the auto-end-combo watcher's
  // seat scan doesn't clear combo context out from under the assertions.
  seatsStore.updateSeat(0, 2, false)
  seatsStore.updateSeat(1, 3, false)
  seatsStore.updateSeat(2, 4, false)

  const { useGiftSending } = await import('../../app/composables/gift/useGiftSending')
  return { useGiftSending: useGiftSending(), comboStore, giftStore, authStore }
}

describe('useGiftSending.send', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('emits exactly one gift:send burst for a multi-select send', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, acceptedRecipientIds: [2, 3, 4] } satisfies GiftSendAck)
    const { useGiftSending: sending, giftStore } = await setup(sendGiftMock)

    giftStore.selectGift(GIFT)
    giftStore.setSelectedRecipientIds([2, 3, 4])
    giftStore.setQuantity(1)

    await sending.send()

    expect(sendGiftMock).toHaveBeenCalledTimes(1)
    const [giftId, recipientIds, quantity, batchId] = sendGiftMock.mock.calls[0] as [number, number[], number, string]
    expect(giftId).toBe(9)
    expect(recipientIds).toEqual([2, 3, 4])
    expect(quantity).toBe(1)
    expect(typeof batchId).toBe('string')
  })

  it('an ack with fewer acceptedRecipientIds refunds the dropped legs', async () => {
    // 3 recipients × 50 = 150 debited; server only accepted 2 → 1 leg refunded (50).
    let resolveAck!: (ack: GiftSendAck) => void
    const sendGiftMock = vi.fn().mockImplementation(() => new Promise<GiftSendAck>((resolve) => { resolveAck = resolve }))
    const { useGiftSending: sending, authStore } = await setup(sendGiftMock)
    const { useGiftStore } = await import('../../app/stores/gift')
    const giftStore = useGiftStore()

    giftStore.selectGift(GIFT)
    giftStore.setSelectedRecipientIds([2, 3, 4])
    giftStore.setQuantity(1)

    await sending.send()
    expect(authStore.user?.coins).toBe('850') // 1000 - 150 (optimistic debit, ack still pending)

    resolveAck({ success: true, acceptedRecipientIds: [2, 3] })
    // Let the ack .then() reconciliation microtask flush.
    await Promise.resolve()
    await Promise.resolve()

    expect(authStore.user?.coins).toBe('900') // 850 + 50 refund for the dropped leg
  })

  it('a full failure (success:false) refunds the whole batch', async () => {
    let resolveAck!: (ack: GiftSendAck) => void
    const sendGiftMock = vi.fn().mockImplementation(() => new Promise<GiftSendAck>((resolve) => { resolveAck = resolve }))
    const { useGiftSending: sending, authStore } = await setup(sendGiftMock)
    const { useGiftStore } = await import('../../app/stores/gift')
    const giftStore = useGiftStore()

    giftStore.selectGift(GIFT)
    giftStore.setSelectedRecipientIds([2])
    giftStore.setQuantity(1)

    await sending.send()
    expect(authStore.user?.coins).toBe('950') // 1000 - 50 (optimistic debit, ack still pending)

    resolveAck({ success: false })
    await Promise.resolve()
    await Promise.resolve()

    expect(authStore.user?.coins).toBe('1000') // fully refunded
  })

  it('overlapping sends each reconcile their own refund independently (regression: scalar last-write-wins bug)', async () => {
    let resolveFirst!: (ack: GiftSendAck) => void
    let resolveSecond!: (ack: GiftSendAck) => void
    const sendGiftMock = vi.fn()
      .mockImplementationOnce(() => new Promise<GiftSendAck>((resolve) => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise<GiftSendAck>((resolve) => { resolveSecond = resolve }))

    const { useGiftSending: sending, authStore } = await setup(sendGiftMock)
    const { useGiftStore } = await import('../../app/stores/gift')
    const giftStore = useGiftStore()

    // First send: 2 recipients × 50 = 100.
    giftStore.selectGift(GIFT)
    giftStore.setSelectedRecipientIds([2, 3])
    giftStore.setQuantity(1)
    await sending.send()

    // Second (overlapping) send before the first ack resolves: 1 recipient × 50 = 50.
    giftStore.setSelectedRecipientIds([4])
    await sending.send()

    expect(authStore.user?.coins).toBe('850') // 1000 - 100 - 50

    // Second batch fails entirely — refund its full 50, must NOT touch the first batch's tracking.
    resolveSecond({ success: false })
    await Promise.resolve()
    await Promise.resolve()
    expect(authStore.user?.coins).toBe('900') // 850 + 50

    // First batch: server dropped recipient 3 — refund 50.
    resolveFirst({ success: true, acceptedRecipientIds: [2] })
    await Promise.resolve()
    await Promise.resolve()
    expect(authStore.user?.coins).toBe('950') // 900 + 50
  })
})

describe('useGiftSending.combo / luckyCombo', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('combo() carries a batchId on its burst emit', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, acceptedRecipientIds: [2, 3] } satisfies GiftSendAck)
    const { useGiftSending: sending, comboStore } = await setup(sendGiftMock)

    comboStore.setNormalContext({ gift: GIFT, senderId: 1, recipientIds: [2, 3], quantity: 1 })

    await sending.combo()

    expect(sendGiftMock).toHaveBeenCalledTimes(1)
    const [, recipientIds, , batchId] = sendGiftMock.mock.calls[0] as [number, number[], number, string]
    expect(recipientIds).toEqual([2, 3])
    expect(typeof batchId).toBe('string')
    expect(batchId.length).toBeGreaterThan(0)
  })

  it('luckyCombo() carries a batchId on its burst emit', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, acceptedRecipientIds: [2] } satisfies GiftSendAck)
    const { useGiftSending: sending, comboStore } = await setup(sendGiftMock)

    comboStore.setLuckyContext({ gift: GIFT, senderId: 1, recipientIds: [2], quantity: 1 })

    await sending.luckyCombo()

    expect(sendGiftMock).toHaveBeenCalledTimes(1)
    const [, recipientIds, , batchId] = sendGiftMock.mock.calls[0] as [number, number[], number, string]
    expect(recipientIds).toEqual([2])
    expect(typeof batchId).toBe('string')
    expect(batchId.length).toBeGreaterThan(0)
  })
})
