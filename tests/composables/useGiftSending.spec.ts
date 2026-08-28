/**
 * Unit tests for useGiftSending — burst send + per-batch refund reconciliation
 * (gift-burst-send 09).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed, watch, toRef } from 'vue'
import type { GiftSendAck } from '../../app/types/room/audio'
import {
  GIFT_COMBO_COALESCE_MS,
  GIFT_FAILURE_TOAST_COOLDOWN_MS,
  GIFT_REFUSAL_TOAST_GENERIC,
  GIFT_REFUSAL_TOAST_MESSAGES,
} from '../../app/constants/gift'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)
vi.stubGlobal('toRef', toRef)
vi.stubGlobal('createLogger', () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }))
vi.stubGlobal('useGiftPreload', vi.fn())
// Stable across `useLuckyFly()` calls so self-gifting fly assertions below
// can inspect a single fixed mock instance rather than a fresh one per call.
const triggerFly = vi.fn()
vi.stubGlobal('useLuckyFly', () => ({ triggerFly }))
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

async function setup(
  sendGiftMock: ReturnType<typeof vi.fn>,
  options: { connected?: boolean; ackBalance?: boolean } = {},
) {
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
  vi.stubGlobal('useServerCapabilitiesStore', () => ({ ackBalance: options.ackBalance ?? false, giftBatch: false }))
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
    // (gift-combo-coalesce) 20 taps this fast now merge into a SINGLE
    // gift:send burst (see the coalescing describe block below) — one
    // rejected burst, one toast, which is an even stronger form of the
    // original "not one per tap" guarantee.
    const sendGiftMock = vi.fn().mockResolvedValue(
      { success: false, error: 'No recipients seated' } satisfies GiftSendAck
    )
    vi.useFakeTimers()
    try {
      const { useGiftSending: sending, comboStore, toastAdd } = await setup(sendGiftMock)

      // Freeze the clock inside one cooldown window — this is the reported case:
      // twenty taps landing far faster than GIFT_FAILURE_TOAST_COOLDOWN_MS.
      const frozen = 1_700_000_000_000
      vi.spyOn(Date, 'now').mockReturnValue(frozen)

      comboStore.setNormalContext({ gift: GIFT, senderId: 1, recipientIds: [2], quantity: 1 })

      for (let tap = 0; tap < 20; tap++) {
        await sending.combo()
      }

      // All 20 taps landed inside one coalesce window — flush it now.
      await vi.advanceTimersByTimeAsync(GIFT_COMBO_COALESCE_MS)

      expect(sendGiftMock).toHaveBeenCalledTimes(1)
      const [, , quantity] = sendGiftMock.mock.calls[0] as [number, number[], number, string]
      expect(quantity).toBe(20)
      expect(toastAdd).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('toasts again once the cooldown has elapsed', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue(
      { success: false, error: 'No recipients seated' } satisfies GiftSendAck
    )
    vi.useFakeTimers()
    try {
      const { useGiftSending: sending, comboStore, toastAdd } = await setup(sendGiftMock)

      const start = 1_700_000_000_000
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(start)

      comboStore.setNormalContext({ gift: GIFT, senderId: 1, recipientIds: [2], quantity: 1 })

      await sending.combo()
      // Let this tap's burst flush on its own before the next one starts, so
      // it lands as its own separate (rejected) emit.
      await vi.advanceTimersByTimeAsync(GIFT_COMBO_COALESCE_MS)
      expect(toastAdd).toHaveBeenCalledTimes(1)

      // One millisecond past the window — the sender is told again, so a problem
      // that persists across separate attempts never goes quiet forever.
      nowSpy.mockReturnValue(start + GIFT_FAILURE_TOAST_COOLDOWN_MS + 1)

      await sending.combo()
      await vi.advanceTimersByTimeAsync(GIFT_COMBO_COALESCE_MS)
      expect(toastAdd).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('useGiftSending.combo / luckyCombo', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('combo() carries a batchId on its (coalesced) burst emit', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, acceptedRecipientIds: [2, 3] } satisfies GiftSendAck)
    vi.useFakeTimers()
    try {
      const { useGiftSending: sending, comboStore } = await setup(sendGiftMock)

      comboStore.setNormalContext({ gift: GIFT, senderId: 1, recipientIds: [2, 3], quantity: 1 })

      await sending.combo()
      await vi.advanceTimersByTimeAsync(GIFT_COMBO_COALESCE_MS)

      expect(sendGiftMock).toHaveBeenCalledTimes(1)
      const [, recipientIds, , batchId] = sendGiftMock.mock.calls[0] as [number, number[], number, string]
      expect(recipientIds).toEqual([2, 3])
      expect(typeof batchId).toBe('string')
      expect(batchId.length).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('luckyCombo() carries a batchId on its (non-coalesced, per-tap) emit', async () => {
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

/**
 * gift-combo-coalesce: rapid combo/luckyCombo taps merge into ONE `gift:send`
 * burst instead of one emit per tap — on low-end phones a 100-200 tap combo
 * run of raw emits jams the main thread and drops the socket to server ping
 * timeouts. Coins debit and the visual combo counter still move per tap;
 * only the network emit + its refund tracking are batched.
 */
describe('useGiftSending — combo tap coalescing', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('5 taps within the coalesce window merge into ONE emit with quantity 5', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, acceptedRecipientIds: [2] } satisfies GiftSendAck)
    const { useGiftSending: sending, comboStore } = await setup(sendGiftMock)

    comboStore.setNormalContext({ gift: GIFT, senderId: 1, recipientIds: [2], quantity: 1 })

    // All 5 taps land inside a single 300ms window (50ms apart, total 200ms).
    for (let tap = 0; tap < 5; tap++) {
      await sending.combo()
      await vi.advanceTimersByTimeAsync(50)
    }
    await vi.advanceTimersByTimeAsync(GIFT_COMBO_COALESCE_MS)

    expect(sendGiftMock).toHaveBeenCalledTimes(1)
    const [giftId, recipientIds, quantity] = sendGiftMock.mock.calls[0] as [number, number[], number, string]
    expect(giftId).toBe(9)
    expect(recipientIds).toEqual([2])
    expect(quantity).toBe(5)
  })

  it('a continuous tap stream flushes every window instead of waiting for taps to stop (THROTTLE, not debounce)', async () => {
    // 20 taps, 50ms apart (t = 0, 50, 100, ..., 950ms). Each burst's timer is
    // armed by its FIRST tap and never reset, so it fires at a fixed
    // (firstTapTime + GIFT_COMBO_COALESCE_MS) boundary regardless of later taps
    // landing inside the window. With the loop spanning 1000ms, every full
    // window boundary inside that span fires DURING the stream; the final
    // partial window fires after. Counts are derived from the constant so a
    // retune of GIFT_COMBO_COALESCE_MS does not silently break this test.
    // A debounce (timer reset per tap) would never flush until the taps
    // stopped — this asserts the opposite: flushes happen DURING the stream.
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, acceptedRecipientIds: [2] } satisfies GiftSendAck)
    const { useGiftSending: sending, comboStore } = await setup(sendGiftMock)

    comboStore.setNormalContext({ gift: GIFT, senderId: 1, recipientIds: [2], quantity: 1 })

    const TAP_COUNT = 20
    for (let tap = 0; tap < TAP_COUNT; tap++) {
      await sending.combo()
      await vi.advanceTimersByTimeAsync(50)
    }

    // Every full window inside the 1000ms stream has already fired — this is
    // the key throttle assertion: flushes happened mid-stream.
    const STREAM_MS = TAP_COUNT * 50
    const midStreamFlushes = Math.floor(STREAM_MS / GIFT_COMBO_COALESCE_MS)
    expect(midStreamFlushes).toBeGreaterThan(0)
    expect(sendGiftMock).toHaveBeenCalledTimes(midStreamFlushes)

    // Drain the final partial window so every tap is accounted for.
    await vi.advanceTimersByTimeAsync(GIFT_COMBO_COALESCE_MS)
    expect(sendGiftMock).toHaveBeenCalledTimes(Math.ceil(STREAM_MS / GIFT_COMBO_COALESCE_MS))

    const quantities = sendGiftMock.mock.calls.map((call) => call[2] as number)
    // Every window carries the taps that landed inside it (50ms apart).
    const tapsPerWindow = GIFT_COMBO_COALESCE_MS / 50
    expect(quantities.slice(0, -1).every((q) => q === tapsPerWindow)).toBe(true)
    expect(quantities.reduce((sum, q) => sum + q, 0)).toBe(TAP_COUNT)
  })

  it('increments the visual combo counter once per tap, even though the emits are merged', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, acceptedRecipientIds: [2] } satisfies GiftSendAck)
    const { useGiftSending: sending, comboStore, giftStore } = await setup(sendGiftMock)

    comboStore.setNormalContext({ gift: GIFT, senderId: 1, recipientIds: [2], quantity: 1 })
    giftStore.resetCombo()

    for (let tap = 0; tap < 5; tap++) {
      await sending.combo()
      await vi.advanceTimersByTimeAsync(50)
    }

    // The counter moved on every tap — only the network emit was batched.
    expect(giftStore.comboCount).toBe(5)

    await vi.advanceTimersByTimeAsync(GIFT_COMBO_COALESCE_MS)
    expect(sendGiftMock).toHaveBeenCalledTimes(1)
  })

  it('GATE runs on every tap: a tap after the socket drops mid-burst neither joins the batch nor debits', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, acceptedRecipientIds: [2] } satisfies GiftSendAck)
    const isConnected = ref(true)
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
    vi.stubGlobal('useServerCapabilitiesStore', () => ({ ackBalance: false, giftBatch: false }))
    vi.stubGlobal('useGiftStore', () => giftStore)
    vi.stubGlobal('useAuthStore', () => authStore)
    vi.stubGlobal('useRoomSeatsStore', () => seatsStore)
    vi.stubGlobal('useGiftEligibility', () => ({
      canAfford: computed(() => true),
      canSend: computed(() => true),
    }))
    vi.stubGlobal('useRoomAudio', () => ({
      sendGift: sendGiftMock,
      isConnected: computed(() => isConnected.value),
    }))
    seatsStore.updateSeat(0, 2, false)

    const { useGiftSending } = await import('../../app/composables/gift/useGiftSending')
    const sending = useGiftSending()

    comboStore.setNormalContext({ gift: GIFT, senderId: 1, recipientIds: [2], quantity: 1 })

    await sending.combo()
    expect((authStore.user as { coins?: string } | null)?.coins).toBe('950') // one tap's worth debited

    // Socket drops mid-burst — the very next tap must be gated out, not merged in.
    isConnected.value = false
    const result = await sending.combo()

    expect(result).toBe(false)
    expect((authStore.user as { coins?: string } | null)?.coins).toBe('950') // unchanged — gated tap never debited

    await vi.advanceTimersByTimeAsync(GIFT_COMBO_COALESCE_MS)
    // Only the one gated-in tap's worth (quantity 1) ever reached the wire.
    expect(sendGiftMock).toHaveBeenCalledTimes(1)
    const [, , quantity] = sendGiftMock.mock.calls[0] as [number, number[], number, string]
    expect(quantity).toBe(1)
  })

  it('a null/failed ack for the merged batch refunds ALL taps worth of coins, not just one', async () => {
    let resolveAck!: (ack: GiftSendAck | null) => void
    const sendGiftMock = vi.fn().mockImplementation(
      () => new Promise<GiftSendAck | null>((resolve) => { resolveAck = resolve }),
    )
    const { useGiftSending: sending, comboStore, authStore } = await setup(sendGiftMock)

    comboStore.setNormalContext({ gift: GIFT, senderId: 1, recipientIds: [2], quantity: 1 })

    // All 5 taps land inside the SAME fixed 300ms throttle window (spaced
    // 50ms apart, well under the window), so they merge into one batch.
    for (let tap = 0; tap < 5; tap++) {
      await sending.combo()
      await vi.advanceTimersByTimeAsync(50)
    }
    // 5 taps × 50 coins/tap = 250 debited, all before any network emit fired.
    expect(authStore.user?.coins).toBe('750')

    await vi.advanceTimersByTimeAsync(GIFT_COMBO_COALESCE_MS)
    expect(sendGiftMock).toHaveBeenCalledTimes(1)

    resolveAck(null)
    await Promise.resolve()
    await Promise.resolve()

    // Full refund of all 5 taps' coins, not just the last one.
    expect(authStore.user?.coins).toBe('1000')
  })

  it('switching gifts mid-burst flushes the pending batch immediately, then starts a new one', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, acceptedRecipientIds: [2] } satisfies GiftSendAck)
    const OTHER_GIFT = { id: 11, price: 30, category: 'normal', thumbnail_url: 'y.png' } as never
    const { useGiftSending: sending, comboStore } = await setup(sendGiftMock)

    comboStore.setNormalContext({ gift: GIFT, senderId: 1, recipientIds: [2], quantity: 1 })
    await sending.combo()
    await sending.combo()
    // Nothing has flushed yet — both taps are still coalescing.
    expect(sendGiftMock).not.toHaveBeenCalled()

    // Gift changes before the window expires (a real combo repeats the LAST
    // send()'s context, so a fresh send() with a different gift is what
    // changes it mid-burst).
    comboStore.setNormalContext({ gift: OTHER_GIFT, senderId: 1, recipientIds: [2], quantity: 1 })
    await sending.combo()

    // The first (2-tap) batch flushed immediately as its own smaller emit —
    // no waiting for the coalesce timer.
    expect(sendGiftMock).toHaveBeenCalledTimes(1)
    const [firstGiftId, , firstQuantity] = sendGiftMock.mock.calls[0] as [number, number[], number, string]
    expect(firstGiftId).toBe(9)
    expect(firstQuantity).toBe(2)

    // The new gift's tap is queued, not yet flushed.
    await vi.advanceTimersByTimeAsync(GIFT_COMBO_COALESCE_MS)
    expect(sendGiftMock).toHaveBeenCalledTimes(2)
    const [secondGiftId, , secondQuantity] = sendGiftMock.mock.calls[1] as [number, number[], number, string]
    expect(secondGiftId).toBe(11)
    expect(secondQuantity).toBe(1)
  })

  it('recipients changing mid-burst flushes the pending batch immediately, then starts a new one', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, acceptedRecipientIds: [2, 3] } satisfies GiftSendAck)
    const { useGiftSending: sending, comboStore } = await setup(sendGiftMock)

    comboStore.setNormalContext({ gift: GIFT, senderId: 1, recipientIds: [2], quantity: 1 })
    await sending.combo()
    expect(sendGiftMock).not.toHaveBeenCalled()

    comboStore.setNormalContext({ gift: GIFT, senderId: 1, recipientIds: [2, 3], quantity: 1 })
    await sending.combo()

    // Different recipient set flushed the first (1-tap, recipient [2]) batch.
    expect(sendGiftMock).toHaveBeenCalledTimes(1)
    const [, firstRecipients, firstQuantity] = sendGiftMock.mock.calls[0] as [number, number[], number, string]
    expect(firstRecipients).toEqual([2])
    expect(firstQuantity).toBe(1)

    await vi.advanceTimersByTimeAsync(GIFT_COMBO_COALESCE_MS)
    expect(sendGiftMock).toHaveBeenCalledTimes(2)
    const [, secondRecipients] = sendGiftMock.mock.calls[1] as [number, number[], number, string]
    expect(secondRecipients).toEqual([2, 3])
  })

  it('a plain send() flushes any pending combo burst immediately, as its own emit', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, acceptedRecipientIds: [2] } satisfies GiftSendAck)
    const { useGiftSending: sending, comboStore, giftStore } = await setup(sendGiftMock)

    comboStore.setNormalContext({ gift: GIFT, senderId: 1, recipientIds: [2], quantity: 1 })
    await sending.combo()
    await sending.combo()
    expect(sendGiftMock).not.toHaveBeenCalled()

    giftStore.selectGift(GIFT)
    giftStore.setSelectedRecipientIds([2])
    giftStore.setQuantity(1)
    await sending.send()

    // The 2-tap combo burst flushed first, then send()'s own emit followed.
    expect(sendGiftMock).toHaveBeenCalledTimes(2)
    const [, , comboQuantity] = sendGiftMock.mock.calls[0] as [number, number[], number, string]
    expect(comboQuantity).toBe(2)
  })
})

/**
 * luckyCombo() deliberately does NOT coalesce — see the function's own
 * comment in useGiftSending.ts. Laravel runs one lucky draw per constituent
 * burst per `gift:send` emit (GiftTransactionService.php:222-228), so merging
 * taps would change the stake-to-draw ratio, not just the network shape.
 */
describe('useGiftSending — luckyCombo per-tap emit (no coalescing)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('5 rapid taps emit 5 separate gift:send calls, each quantity 1', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, acceptedRecipientIds: [2] } satisfies GiftSendAck)
    const { useGiftSending: sending, comboStore } = await setup(sendGiftMock)

    comboStore.setLuckyContext({ gift: GIFT, senderId: 1, recipientIds: [2], quantity: 1 })

    for (let tap = 0; tap < 5; tap++) {
      await sending.luckyCombo()
    }

    expect(sendGiftMock).toHaveBeenCalledTimes(5)
    for (const call of sendGiftMock.mock.calls) {
      const [giftId, recipientIds, quantity] = call as [number, number[], number, string]
      expect(giftId).toBe(9)
      expect(recipientIds).toEqual([2])
      expect(quantity).toBe(1)
    }
    // Each tap carries its own batchId — never merged into a shared batch.
    const batchIds = sendGiftMock.mock.calls.map((call) => call[3] as string)
    expect(new Set(batchIds).size).toBe(5)
  })

  it('deducts coins per tap and refunds only that tap on a failed ack', async () => {
    let resolveAck!: (ack: GiftSendAck) => void
    const sendGiftMock = vi.fn().mockImplementationOnce(
      () => new Promise<GiftSendAck>((resolve) => { resolveAck = resolve }),
    )
    const { useGiftSending: sending, comboStore, authStore } = await setup(sendGiftMock)

    comboStore.setLuckyContext({ gift: GIFT, senderId: 1, recipientIds: [2], quantity: 1 })

    await sending.luckyCombo()
    expect(authStore.user?.coins).toBe('950') // 1000 - 50, this tap's own debit

    resolveAck({ success: false })
    await Promise.resolve()
    await Promise.resolve()

    expect(authStore.user?.coins).toBe('1000') // fully refunded, this tap only
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

/**
 * ackBalance (gift-authority-tick-fanout ticket 13): the server is the sole
 * source of the balance — no optimistic subtract on tap, no local refund
 * add-back. The ack's `balance`/`seq` apply through `authStore.applyBalance`
 * (sequence-guarded), and a refusal maps `code` to one of the constants'
 * messages.
 */
describe('useGiftSending — ackBalance path', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('send() does NOT optimistically subtract — the balance only moves once the ack applies it', async () => {
    let resolveAck!: (ack: GiftSendAck) => void
    const sendGiftMock = vi.fn().mockImplementation(() => new Promise<GiftSendAck>((resolve) => { resolveAck = resolve }))
    const { useGiftSending: sending, giftStore, authStore } = await setup(sendGiftMock, { ackBalance: true })

    giftStore.selectGift(GIFT)
    giftStore.setSelectedRecipientIds([2, 3])
    giftStore.setQuantity(1)

    await sending.send()
    // No optimistic debit at all — balance is exactly what it started as.
    expect(authStore.user?.coins).toBe('1000')

    resolveAck({ success: true, ok: true, acceptedRecipientIds: [2, 3], balance: '900', seq: 1 } as GiftSendAck)
    await Promise.resolve()
    await Promise.resolve()

    expect(authStore.user?.coins).toBe('900')
  })

  it('a refusal applies the refused balance/seq and shows the mapped toast — no local refund math', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue(
      { success: false, ok: false, code: 'INSUFFICIENT', reason: 'insufficient', balance: '1000', seq: 1 } as GiftSendAck,
    )
    const { useGiftSending: sending, giftStore, authStore, toastAdd } = await setup(sendGiftMock, { ackBalance: true })

    giftStore.selectGift(GIFT)
    giftStore.setSelectedRecipientIds([2])
    giftStore.setQuantity(1)

    await sending.send()
    await Promise.resolve()
    await Promise.resolve()

    expect(authStore.user?.coins).toBe('1000') // unchanged — never subtracted, refusal balance re-applies the same number
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastArg(0).title).toBe('Gift not sent')
    expect(toastArg(0).description).toBe(GIFT_REFUSAL_TOAST_MESSAGES.INSUFFICIENT)
  })

  it('an unmapped refusal code falls back to the generic message', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue(
      { success: false, ok: false, code: 'SOMETHING_NEW', balance: '1000', seq: 1 } as GiftSendAck,
    )
    const { useGiftSending: sending, giftStore } = await setup(sendGiftMock, { ackBalance: true })

    giftStore.selectGift(GIFT)
    giftStore.setSelectedRecipientIds([2])
    giftStore.setQuantity(1)

    await sending.send()
    await Promise.resolve()
    await Promise.resolve()

    expect(toastArg(0).description).toBe(GIFT_REFUSAL_TOAST_GENERIC)
  })

  it('one toast per distinct refusal code (cooldown advanced between taps)', async () => {
    const codes = Object.keys(GIFT_REFUSAL_TOAST_MESSAGES)
    let callIndex = 0
    const sendGiftMock = vi.fn().mockImplementation(() => Promise.resolve(
      { success: false, ok: false, code: codes[callIndex++], balance: '1000', seq: callIndex } as GiftSendAck,
    ))
    vi.useFakeTimers()
    try {
      const { useGiftSending: sending, giftStore, toastAdd } = await setup(sendGiftMock, { ackBalance: true })
      giftStore.selectGift(GIFT)
      giftStore.setSelectedRecipientIds([2])
      giftStore.setQuantity(1)

      for (let i = 0; i < codes.length; i++) {
        await sending.send()
        await Promise.resolve()
        await Promise.resolve()
        // Clear the refusal-toast throttle between taps so each code gets its
        // own toast — the throttle itself is covered separately below.
        vi.advanceTimersByTime(GIFT_FAILURE_TOAST_COOLDOWN_MS + 1)
      }

      expect(toastAdd).toHaveBeenCalledTimes(codes.length)
      const descriptions = toastAdd.mock.calls.map((call) => (call[0] as { description: string }).description)
      expect(descriptions).toEqual(codes.map((code) => GIFT_REFUSAL_TOAST_MESSAGES[code]))
    } finally {
      vi.useRealTimers()
    }
  })

  it('a run of rejected combo taps against a low balance produces ONE refusal toast, not one per tap', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue(
      { success: false, ok: false, code: 'INSUFFICIENT', balance: '5', seq: 1 } as GiftSendAck,
    )
    vi.useFakeTimers()
    try {
      const { useGiftSending: sending, comboStore, toastAdd } = await setup(sendGiftMock, { ackBalance: true })
      const frozen = 1_700_000_000_000
      vi.spyOn(Date, 'now').mockReturnValue(frozen)

      comboStore.setNormalContext({ gift: GIFT, senderId: 1, recipientIds: [2], quantity: 1 })

      for (let tap = 0; tap < 20; tap++) {
        await sending.combo()
      }
      await vi.advanceTimersByTimeAsync(GIFT_COMBO_COALESCE_MS)
      await Promise.resolve()
      await Promise.resolve()

      expect(toastAdd).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('combo counter and local on-tap render stay per-tap under ackBalance — no balance movement', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, ok: true, acceptedRecipientIds: [2], balance: '1000', seq: 1 } as GiftSendAck)
    vi.useFakeTimers()
    try {
      const { useGiftSending: sending, comboStore, giftStore, authStore } = await setup(sendGiftMock, { ackBalance: true })

      comboStore.setNormalContext({ gift: GIFT, senderId: 1, recipientIds: [2], quantity: 1 })
      giftStore.resetCombo()

      for (let tap = 0; tap < 5; tap++) {
        await sending.combo()
        await vi.advanceTimersByTimeAsync(50)
      }

      // Visual streak still moves once per tap...
      expect(giftStore.comboCount).toBe(5)
      // ...even though no coins were ever optimistically subtracted.
      expect(authStore.user?.coins).toBe('1000')
    } finally {
      vi.useRealTimers()
    }
  })

  it('legacy path (capability absent) is untouched: optimistic subtract + refund-on-failure still happen', async () => {
    // Same scenario as the plain (non-ackBalance) `send()` full-failure test —
    // proves ackBalance:false takes the ORIGINAL code path, not a shared one.
    let resolveAck!: (ack: GiftSendAck) => void
    const sendGiftMock = vi.fn().mockImplementation(() => new Promise<GiftSendAck>((resolve) => { resolveAck = resolve }))
    const { useGiftSending: sending, giftStore, authStore } = await setup(sendGiftMock, { ackBalance: false })

    giftStore.selectGift(GIFT)
    giftStore.setSelectedRecipientIds([2])
    giftStore.setQuantity(1)

    await sending.send()
    expect(authStore.user?.coins).toBe('950') // optimistic debit still happens

    resolveAck({ success: false })
    await Promise.resolve()
    await Promise.resolve()

    expect(authStore.user?.coins).toBe('1000') // legacy full refund still happens
  })
})

/**
 * Self-gifting (self-gifting epic ticket 04): once useGiftEligibility allows
 * the seated sender to be a valid recipient, send()/combo()/luckyCombo() must
 * already give a self leg the exact same FX as any other recipient — the fly
 * animation for lucky gifts, the playback modal for normal gifts — with no
 * double-fire and no separate "self echo" path (see useGiftSending.ts's
 * self-gifting comments at the 3 call sites: these loops are unconditional
 * over the recipient array, self included).
 */
describe('useGiftSending — self-gifting FX (self-gifting epic ticket 04)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('send() to [self] (lucky gift) triggers the fly animation exactly once', async () => {
    const LUCKY_GIFT = { id: 5, price: 20, category: 'lucky', thumbnail_url: 'lucky.png' } as never
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, acceptedRecipientIds: [1] } satisfies GiftSendAck)
    const { useGiftSending: sending, giftStore, seatsStore } = await setup(sendGiftMock)

    // Sender (user 1) is seated, and is the sole recipient.
    seatsStore.updateSeat(3, 1, false)
    giftStore.selectGift(LUCKY_GIFT)
    giftStore.setSelectedRecipientIds([1])
    giftStore.setQuantity(1)

    await sending.send()

    expect(triggerFly).toHaveBeenCalledTimes(1)
    expect(triggerFly).toHaveBeenCalledWith('lucky.png', 1, 1)
  })

  it('send() to [self] (normal gift) enqueues the playback modal exactly once, XP accumulated once', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, acceptedRecipientIds: [1] } satisfies GiftSendAck)
    const { useGiftSending: sending, giftStore, seatsStore } = await setup(sendGiftMock)

    seatsStore.updateSeat(3, 1, false)
    giftStore.selectGift(GIFT)
    giftStore.setSelectedRecipientIds([1])
    giftStore.setQuantity(1)

    expect(giftStore.currentPlayback).toBeNull()
    await sending.send()

    // Exactly one playback for this self-send (auto-started, nothing left
    // queued behind it) — no duplicate enqueue.
    expect(giftStore.currentPlayback?.recipientIds).toEqual([1])
    expect(giftStore.playbackQueue).toHaveLength(0)

    // XP accumulation is useRoomGifts.sendGift's job (covered with the real
    // composable in useRoomGifts.spec.ts's self-gifting test) — here `sendGift`
    // is mocked, so the only useGiftSending-owned assertion is "exactly one
    // emit, exactly one local enqueue", i.e. no double-booking for self.
    expect(sendGiftMock).toHaveBeenCalledTimes(1)
  })

  it('luckyCombo() to [self] triggers the fly animation exactly once', async () => {
    const sendGiftMock = vi.fn().mockResolvedValue({ success: true, acceptedRecipientIds: [1] } satisfies GiftSendAck)
    const { useGiftSending: sending, comboStore, seatsStore } = await setup(sendGiftMock)

    seatsStore.updateSeat(3, 1, false)
    comboStore.setLuckyContext({ gift: GIFT, senderId: 1, recipientIds: [1], quantity: 1 })

    await sending.luckyCombo()

    expect(triggerFly).toHaveBeenCalledTimes(1)
    expect(triggerFly).toHaveBeenCalledWith('x.png', 1, 1)
  })
})
