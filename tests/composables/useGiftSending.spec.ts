/**
 * Unit tests for useGiftSending — burst send + per-batch refund reconciliation
 * (gift-burst-send 09).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed, watch, toRef } from 'vue'
import type { GiftSendAck } from '../../app/types/room/audio'
import { GIFT_FAILURE_TOAST_COOLDOWN_MS } from '../../app/constants/gift'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)
vi.stubGlobal('toRef', toRef)
vi.stubGlobal('createLogger', () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }))
vi.stubGlobal('useGiftPreload', vi.fn())
vi.stubGlobal('useLuckyFly', () => ({ triggerFly: vi.fn() }))
// Stable across `useToast()` calls so the burst-failure tests below can assert
// on what the sender was actually told.
const toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: toastAdd }))
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})
// The sender-local chat-bubble wiring (HITL 2026-07-23) is out of scope for
// this file (burst-send + refund reconciliation only) — see
// useGiftSendingChatBubble.spec.ts for that coverage with real stores.
vi.mock('../../app/composables/room/useRoomEventHandlers', () => ({
  announceLocalGiftSend: vi.fn(),
}))

const GIFT = { id: 9, price: 50, category: 'normal', thumbnail_url: 'x.png' } as never

async function setup(sendGiftMock: ReturnType<typeof vi.fn>, options: { connected?: boolean } = {}) {
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
  vi.stubGlobal('useRoomAudio', () => ({
    sendGift: sendGiftMock,
    isConnected: computed(() => options.connected ?? true),
  }))

  // Seat every recipient the tests select so the auto-end-combo watcher's
  // seat scan doesn't clear combo context out from under the assertions.
  seatsStore.updateSeat(0, 2, false)
  seatsStore.updateSeat(1, 3, false)
  seatsStore.updateSeat(2, 4, false)

  const { useGiftSending } = await import('../../app/composables/gift/useGiftSending')
  return { useGiftSending: useGiftSending(), comboStore, giftStore, authStore, seatsStore, toastAdd }
}

/** The `{ title, description, color }` object handed to `toast.add`. */
function toastArg(call: number): { title: string; description: string; color: string } {
  return toastAdd.mock.calls[call]?.[0] as { title: string; description: string; color: string }
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

/**
 * A rejected burst refunded the coins and said nothing at all. Twenty combo
 * taps at an unseated recipient therefore looked exactly like twenty that
 * worked: the animation played, the balance ended where it started, and MSAB's
 * `No recipients seated` never reached the screen.
 *
 * Partial-leg drops must stay silent — that silence is a deliberate HITL call
 * (2026-07-23) about toast spam in busy rooms, and it is only the TOTAL failure
 * branch that gained a message.
 */
describe('useGiftSending — burst rejection feedback', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('names the seat requirement when every leg was unseated', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue(
      { success: false, error: 'No recipients seated' } satisfies GiftSendAck
    )
    const { useGiftSending: sending, giftStore, toastAdd } = await setup(sendGiftMock)

    giftStore.selectGift(GIFT)
    giftStore.setSelectedRecipientIds([2])
    giftStore.setQuantity(1)

    await sending.send()
    await Promise.resolve()
    await Promise.resolve()

    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastArg(0).title).toBe('Gift not sent')
    expect(toastArg(0).color).toBe('error')
    expect(toastArg(0).description).toContain('mic seat')
    expect(toastArg(0).description).toContain('refunded')
  })

  it('falls back to the server text for an unmapped error', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue(
      { success: false, error: 'Room is closed' } satisfies GiftSendAck
    )
    const { useGiftSending: sending, giftStore, toastAdd } = await setup(sendGiftMock)

    giftStore.selectGift(GIFT)
    giftStore.setSelectedRecipientIds([2])
    giftStore.setQuantity(1)

    await sending.send()
    await Promise.resolve()
    await Promise.resolve()

    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastArg(0).description).toContain('Room is closed')
  })

  it('reports a lost connection when the emit rejects outright', async () => {
    const sendGiftMock = vi.fn().mockRejectedValue(new Error('Socket not connected'))
    const { useGiftSending: sending, giftStore, toastAdd } = await setup(sendGiftMock)

    giftStore.selectGift(GIFT)
    giftStore.setSelectedRecipientIds([2])
    giftStore.setQuantity(1)

    await sending.send()
    await Promise.resolve()
    await Promise.resolve()

    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastArg(0).description).toContain('Could not reach the room server')
  })

  it('stays silent when 1 of 5 recipients drops — the send still worked', async () => {
    // The operator's rule: do not interrupt someone whose gift mostly landed.
    // MSAB never errors a partial burst (`errors.ts` NO_RECIPIENTS_SEATED is
    // "raised only when EVERY recipient in a burst was dropped") — it acks
    // success with the accepted subset, which lands in the silent branch.
    const sendGiftMock = vi.fn().mockResolvedValue(
      { success: true, acceptedRecipientIds: [2, 3, 4, 5] } satisfies GiftSendAck
    )
    const { useGiftSending: sending, giftStore, authStore, seatsStore, toastAdd } = await setup(sendGiftMock)

    seatsStore.updateSeat(3, 5, false)
    seatsStore.updateSeat(4, 6, false)

    giftStore.selectGift(GIFT)
    giftStore.setSelectedRecipientIds([2, 3, 4, 5, 6])
    giftStore.setQuantity(1)

    await sending.send()
    await Promise.resolve()
    await Promise.resolve()

    // 5 × 50 debited, 1 dropped leg refunded — quietly.
    expect(authStore.user?.coins).toBe('800')
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('speaks up only when ALL 5 recipients drop', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue(
      { success: false, error: 'No recipients seated' } satisfies GiftSendAck
    )
    const { useGiftSending: sending, giftStore, authStore, seatsStore, toastAdd } = await setup(sendGiftMock)

    seatsStore.updateSeat(3, 5, false)
    seatsStore.updateSeat(4, 6, false)

    giftStore.selectGift(GIFT)
    giftStore.setSelectedRecipientIds([2, 3, 4, 5, 6])
    giftStore.setQuantity(1)

    await sending.send()
    await Promise.resolve()
    await Promise.resolve()

    // Nothing landed — full refund, and the sender is told why.
    expect(authStore.user?.coins).toBe('1000')
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastArg(0).description).toContain('mic seat')
  })

  it('shows ONE toast for a run of rejected combo taps, not one per tap', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue(
      { success: false, error: 'No recipients seated' } satisfies GiftSendAck
    )
    const { useGiftSending: sending, comboStore, toastAdd } = await setup(sendGiftMock)

    // Freeze the clock inside one cooldown window — this is the reported case:
    // twenty taps landing far faster than GIFT_FAILURE_TOAST_COOLDOWN_MS.
    const frozen = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(frozen)

    comboStore.setNormalContext({ gift: GIFT, senderId: 1, recipientIds: [2], quantity: 1 })

    for (let tap = 0; tap < 20; tap++) {
      await sending.combo()
      await Promise.resolve()
      await Promise.resolve()
    }

    expect(sendGiftMock).toHaveBeenCalledTimes(20)
    expect(toastAdd).toHaveBeenCalledTimes(1)
  })

  it('toasts again once the cooldown has elapsed', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue(
      { success: false, error: 'No recipients seated' } satisfies GiftSendAck
    )
    const { useGiftSending: sending, comboStore, toastAdd } = await setup(sendGiftMock)

    const start = 1_700_000_000_000
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(start)

    comboStore.setNormalContext({ gift: GIFT, senderId: 1, recipientIds: [2], quantity: 1 })

    await sending.combo()
    await Promise.resolve()
    await Promise.resolve()
    expect(toastAdd).toHaveBeenCalledTimes(1)

    // One millisecond past the window — the sender is told again, so a problem
    // that persists across separate attempts never goes quiet forever.
    nowSpy.mockReturnValue(start + GIFT_FAILURE_TOAST_COOLDOWN_MS + 1)

    await sending.combo()
    await Promise.resolve()
    await Promise.resolve()
    expect(toastAdd).toHaveBeenCalledTimes(2)
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

describe('useGiftSending — connection gate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('send() while the socket is down: no emit, no debit, one reconnect toast', async () => {
    const sendGiftMock = vi.fn()
    const { useGiftSending: sending, giftStore, authStore } = await setup(sendGiftMock, { connected: false })

    giftStore.selectGift(GIFT)
    giftStore.setSelectedRecipientIds([2])
    giftStore.setQuantity(1)

    const result = await sending.send()

    expect(result).toBe(false)
    expect(sendGiftMock).not.toHaveBeenCalled()
    expect(authStore.user?.coins).toBe('1000')
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastArg(0).title).toBe('Reconnecting to the room')
  })

  it('rapid taps while down: the reconnect toast is throttled to one', async () => {
    const sendGiftMock = vi.fn()
    const { useGiftSending: sending, giftStore } = await setup(sendGiftMock, { connected: false })

    giftStore.selectGift(GIFT)
    giftStore.setSelectedRecipientIds([2])
    giftStore.setQuantity(1)

    await sending.send()
    await sending.send()
    await sending.send()

    expect(sendGiftMock).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledTimes(1)
  })

  it('luckyCombo() while the socket is down: no emit, no debit', async () => {
    const sendGiftMock = vi.fn()
    const { useGiftSending: sending, comboStore, authStore } = await setup(sendGiftMock, { connected: false })

    comboStore.setLuckyContext({ gift: GIFT, senderId: 1, recipientIds: [2], quantity: 1 })

    const result = await sending.luckyCombo()

    expect(result).toBe(false)
    expect(sendGiftMock).not.toHaveBeenCalled()
    expect(authStore.user?.coins).toBe('1000')
  })

  it('combo() while the socket is down: no emit, no debit', async () => {
    const sendGiftMock = vi.fn()
    const { useGiftSending: sending, comboStore, authStore } = await setup(sendGiftMock, { connected: false })

    comboStore.setNormalContext({ gift: GIFT, senderId: 1, recipientIds: [2, 3], quantity: 1 })

    const result = await sending.combo()

    expect(result).toBe(false)
    expect(sendGiftMock).not.toHaveBeenCalled()
    expect(authStore.user?.coins).toBe('1000')
  })
})
