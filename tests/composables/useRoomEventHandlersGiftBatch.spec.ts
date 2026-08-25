/**
 * Unit tests for setupRoomEventHandlers — `gift:batch` handler
 * (gift-authority-tick-fanout ticket 15).
 *
 * Scope: one merged item → one store write per item type; `count`
 * propagation to the lucky-fly renderer and the playback repeat counter;
 * the legacy `gift:received` path staying untouched when `giftBatch` is
 * false, and going silent (no double count) once it is true. Lucky
 * room-result folding is covered by mocking `handleLuckyRoomResult` and
 * asserting it is called once per `lucky[]` entry — its own store-write
 * behavior is covered by `useLuckyGift.spec.ts`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import { seatGiftValue } from '../../app/utils/gift'
import { MAX_PLAYBACK_REPEATS } from '../../app/constants/gift'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('seatGiftValue', seatGiftValue)
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

// vi.mock factories are hoisted above these consts — vi.hoisted() is
// required so the factory closure and the test's assertions share the SAME
// mock function instance instead of silently diverging.
const { recordLuckyGiftTapMock, handleLuckyRoomResultMock, triggerFlyMock } = vi.hoisted(() => ({
  recordLuckyGiftTapMock: vi.fn(),
  handleLuckyRoomResultMock: vi.fn(),
  triggerFlyMock: vi.fn(),
}))

vi.mock('../../app/composables/lucky/useLuckyGift', () => ({
  setupLuckyEventHandlers: vi.fn(),
  cleanupLuckyEventHandlers: vi.fn(),
  recordLuckyGiftTap: recordLuckyGiftTapMock,
  handleLuckyRoomResult: handleLuckyRoomResultMock,
}))

vi.mock('../../app/composables/lucky/useLuckyFly', () => ({
  useLuckyFly: () => ({ triggerFly: triggerFlyMock }),
}))
vi.mock('../../app/services/giftAssetCache', () => ({
  preloadGift: vi.fn(),
  preloadSvga: vi.fn(),
}))
vi.mock('../../app/utils/prop', () => ({
  propToEntryAnimationGift: vi.fn(),
}))

function createMockSocket() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  return {
    handlers,
    on: vi.fn((event: string, cb: (...args: unknown[]) => unknown) => {
      handlers.set(event, cb)
    }),
    off: vi.fn(),
  }
}

const NORMAL_GIFT = { id: 9, name: 'Golden Rose', label: null, price: 500, category: 'normal' }
const LUCKY_GIFT = { id: 11, name: 'Lucky Coin', label: null, price: 100, category: 'lucky', thumbnail_url: 'lucky.png' }

describe('setupRoomEventHandlers — gift:batch', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()

    vi.stubGlobal('usePropLookup', () => ({ resolvePropAsync: vi.fn().mockResolvedValue(null) }))
    vi.stubGlobal('useSlidePlayback', () => ({ playEntrySlide: vi.fn() }))
    vi.stubGlobal('useGiftComboStore', () => ({ consumePendingRefund: vi.fn().mockReturnValue(0) }))
    vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
  })

  async function setup(options: { gift?: typeof NORMAL_GIFT; giftBatch?: boolean } = {}) {
    const gift = options.gift ?? NORMAL_GIFT
    vi.stubGlobal('useGiftData', () => ({ getGiftById: vi.fn().mockReturnValue(gift) }))
    vi.stubGlobal('useServerCapabilitiesStore', () => ({ giftBatch: options.giftBatch ?? true, ackBalance: false }))

    const { setupRoomEventHandlers } = await import('../../app/composables/room/useRoomEventHandlers')
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const { useAuthStore } = await import('../../app/stores/auth')
    const { useRoomStore } = await import('../../app/stores/room')
    const { useRoomAudioStore } = await import('../../app/stores/roomAudio')
    const { useGiftStore } = await import('../../app/stores/gift')

    const seatsStore = useRoomSeatsStore()
    const participantsStore = useRoomParticipantsStore()
    const authStore = useAuthStore()
    const roomStore = useRoomStore()
    const audioStore = useRoomAudioStore()
    const giftStore = useGiftStore()
    roomStore.setCurrentRoom({ id: 1, room_xp: '0', daily_xp: '0' } as never)
    authStore.user = { id: 1 } as never

    participantsStore.addParticipant({ id: 2, name: 'Ali' } as never)
    participantsStore.addParticipant({ id: 3, name: 'Sara' } as never)

    vi.stubGlobal('useRoomSeatsStore', () => seatsStore)
    vi.stubGlobal('useRoomParticipantsStore', () => participantsStore)
    vi.stubGlobal('useAuthStore', () => authStore)
    vi.stubGlobal('useRoomStore', () => roomStore)
    vi.stubGlobal('useRoomAudioStore', () => audioStore)
    vi.stubGlobal('useGiftStore', () => giftStore)
    vi.stubGlobal('useRoomSessionStore', () => ({ previousRoute: '/' }))
    vi.stubGlobal('useRoomSession', () => ({ leaveRoom: vi.fn(), setCurrentRoom: vi.fn(), minimizeRoom: vi.fn(), maximizeRoom: vi.fn(), touchActiveRoom: vi.fn(), clearActiveRoom: vi.fn() }))

    const socket = createMockSocket()
    const toast = { add: vi.fn() } as unknown as ReturnType<typeof useToast>
    const actions = {
      leaveRoom: vi.fn(),
      stopAudio: vi.fn(),
      consumeProducer: vi.fn(),
      stopConsumer: vi.fn(),
      acceptInvite: vi.fn(),
      declineInvite: vi.fn(),
      startAudio: vi.fn(),
    }
    setupRoomEventHandlers(socket as never, actions, toast)
    return { socket, audioStore, participantsStore, authStore, roomStore, giftStore }
  }

  it('registers a gift:batch listener', async () => {
    const { socket } = await setup()
    expect(socket.handlers.get('gift:batch')).toBeDefined()
  })

  it('normal gift item: one XP write, one chat bubble, one playback enqueue — repeats = count (one per merged tap)', async () => {
    const { socket, audioStore, roomStore, giftStore } = await setup()
    const enqueueSpy = vi.spyOn(giftStore, 'enqueuePlayback')

    socket.handlers.get('gift:batch')?.({
      seq: 1,
      roomId: '1',
      items: [
        { senderId: 2, giftId: 9, recipientIds: [3], quantity: 3, count: 4, transactionIds: ['norm-1', 'norm-2', 'norm-3', 'norm-4'] },
      ],
      lucky: [],
    })
    await Promise.resolve() // useRoomXpAccumulator flushes on the next frame/microtask

    // XP: seatGiftValue(normal, quantity=3) = 3 * 500 = 1500, folded × count (4) = 6000, once.
    expect(roomStore.currentRoom?.daily_xp).toBe('6000')

    // Chat bubble: one message, quantity folded to quantity × count = 12.
    expect(audioStore.messages).toHaveLength(1)
    expect(audioStore.messages[0]?.content).toBe('Ali sent Golden Rose ×12 to Sara — 6,000 coins')

    // Playback: one enqueue call, repeats = count (legacy coalesces one repeat per tap event).
    expect(enqueueSpy).toHaveBeenCalledTimes(1)
    expect(enqueueSpy).toHaveBeenCalledWith(expect.objectContaining({ quantity: 3, repeats: 4 }))
  })

  it('clamps repeats at MAX_PLAYBACK_REPEATS, matching where the legacy coalescer stops', async () => {
    const { socket, giftStore } = await setup()
    const enqueueSpy = vi.spyOn(giftStore, 'enqueuePlayback')

    socket.handlers.get('gift:batch')?.({
      seq: 1,
      roomId: '1',
      items: [
        { senderId: 2, giftId: 9, recipientIds: [3], quantity: 1, count: MAX_PLAYBACK_REPEATS + 5, transactionIds: Array.from({ length: MAX_PLAYBACK_REPEATS + 5 }, (_, i) => `cap-${i}`) },
      ],
      lucky: [],
    })

    expect(enqueueSpy).toHaveBeenCalledWith(expect.objectContaining({ repeats: MAX_PLAYBACK_REPEATS }))
  })

  it('lucky gift item: one tap-activity record and one fly request per recipient, both carrying count', async () => {
    const { socket } = await setup({ gift: LUCKY_GIFT })

    socket.handlers.get('gift:batch')?.({
      seq: 1,
      roomId: '1',
      items: [
        { senderId: 2, giftId: 11, recipientIds: [3, 4], quantity: 2, count: 5, transactionIds: ['lucky-1', 'lucky-2', 'lucky-3', 'lucky-4', 'lucky-5'] },
      ],
      lucky: [],
    })

    expect(recordLuckyGiftTapMock).toHaveBeenCalledTimes(1)
    expect(recordLuckyGiftTapMock).toHaveBeenCalledWith(expect.objectContaining({ quantity: 2, count: 5, recipientIds: [3, 4] }))

    // One fly request per recipient, each carrying count=5.
    expect(triggerFlyMock).toHaveBeenCalledTimes(2)
    expect(triggerFlyMock).toHaveBeenNthCalledWith(1, LUCKY_GIFT.thumbnail_url, 2, 3, 5)
    expect(triggerFlyMock).toHaveBeenNthCalledWith(2, LUCKY_GIFT.thumbnail_url, 2, 4, 5)
  })

  it('skips an item whose senderId is the local user entirely (already booked locally on send)', async () => {
    const { socket, audioStore, roomStore, giftStore, authStore } = await setup()
    authStore.user = { id: 2 } as never
    const enqueueSpy = vi.spyOn(giftStore, 'enqueuePlayback')

    socket.handlers.get('gift:batch')?.({
      seq: 1,
      roomId: '1',
      items: [
        { senderId: 2, giftId: 9, recipientIds: [3], quantity: 1, count: 1, transactionIds: ['skip-self-1'] },
      ],
      lucky: [],
    })
    await Promise.resolve()

    expect(roomStore.currentRoom?.daily_xp).toBe('0')
    expect(audioStore.messages).toHaveLength(0)
    expect(enqueueSpy).not.toHaveBeenCalled()
  })

  it('folds every lucky[] entry through the existing lucky:room-result handler, once each', async () => {
    const { socket } = await setup()

    const luckyA = { sender_id: 2, gift_id: 11, gift_name: 'Lucky Coin', multiplier: 5, coins_won: 500, tier_name: 'T', room_id: 1, has_slide: false }
    const luckyB = { sender_id: 3, gift_id: 11, gift_name: 'Lucky Coin', multiplier: 10, coins_won: 1000, tier_name: 'T', room_id: 1, has_slide: false }

    socket.handlers.get('gift:batch')?.({ seq: 1, roomId: '1', items: [], lucky: [luckyA, luckyB] })

    expect(handleLuckyRoomResultMock).toHaveBeenCalledTimes(2)
    expect(handleLuckyRoomResultMock).toHaveBeenNthCalledWith(1, luckyA)
    expect(handleLuckyRoomResultMock).toHaveBeenNthCalledWith(2, luckyB)
  })

  it('a duplicate gift:batch delivery (same transaction ids) is not double-booked', async () => {
    const { socket, roomStore } = await setup()
    const item = { senderId: 2, giftId: 9, recipientIds: [3], quantity: 1, count: 1, transactionIds: ['dup-1'] }

    socket.handlers.get('gift:batch')?.({ seq: 1, roomId: '1', items: [item], lucky: [] })
    socket.handlers.get('gift:batch')?.({ seq: 2, roomId: '1', items: [item], lucky: [] })
    await Promise.resolve()

    // seatGiftValue(normal, 1) = 500, once — not 1000.
    expect(roomStore.currentRoom?.daily_xp).toBe('500')
  })

  describe('legacy/batch overlap — capability gate', () => {
    it('gift:received is ignored once giftBatch is true, so an overlapping legacy emit never double counts', async () => {
      const { socket, audioStore, roomStore } = await setup({ giftBatch: true })

      socket.handlers.get('gift:batch')?.({
        seq: 1,
        roomId: '1',
        items: [{ senderId: 2, giftId: 9, recipientIds: [3], quantity: 1, count: 1, transactionIds: ['overlap-tx-1'] }],
        lucky: [],
      })
      // The same tap's legacy shadow, delivered during rollout.
      socket.handlers.get('gift:received')?.({ senderId: 2, roomId: '1', giftId: 9, recipientId: 3, recipientIds: [3], quantity: 1, batchId: 'legacy-overlap-1' })
      await Promise.resolve()

      expect(roomStore.currentRoom?.daily_xp).toBe('500') // batch only, legacy ignored
      expect(audioStore.messages).toHaveLength(1)
    })

    it('without the capability, gift:received behaves exactly as before (legacy path untouched)', async () => {
      const { socket, audioStore, roomStore } = await setup({ giftBatch: false })

      socket.handlers.get('gift:received')?.({ senderId: 2, roomId: '1', giftId: 9, recipientId: 3, recipientIds: [3], quantity: 1, batchId: 'legacy-2' })
      await Promise.resolve()

      expect(roomStore.currentRoom?.daily_xp).toBe('500')
      expect(audioStore.messages).toHaveLength(1)
    })
  })
})
