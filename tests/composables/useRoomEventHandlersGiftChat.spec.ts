/**
 * Unit tests for setupRoomEventHandlers — gift-sent chat announcement bubbles
 * (lucky-burst-draw ticket 10).
 *
 * Scope: bubble synthesis off the burst-shaped `gift:received` event only.
 * All non-gift-chat composables/stores used by the handler file are stubbed —
 * this file does not re-test seat/lucky/slide behavior (see
 * useRoomEventHandlers.spec.ts for that coverage).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import { seatGiftValue } from '../../app/utils/gift'
import { CHAT_MESSAGE_TYPE_GIFT } from '../../app/constants/room'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('seatGiftValue', seatGiftValue)
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

vi.mock('../../app/composables/lucky/useLuckyGift', () => ({
  setupLuckyEventHandlers: vi.fn(),
  cleanupLuckyEventHandlers: vi.fn(),
  recordLuckyGiftTap: vi.fn(),
}))
vi.mock('../../app/composables/lucky/useLuckyFly', () => ({
  useLuckyFly: () => ({ triggerFly: vi.fn() }),
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

const GOLDEN_ROSE = { id: 9, name: 'Golden Rose', label: null, price: 500, category: 'normal' }
const LUCKY_GIFT = { id: 11, name: 'Lucky Coin', label: null, price: 100, category: 'lucky' }

describe('setupRoomEventHandlers — gift chat announcement bubbles', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()

    vi.stubGlobal('useGiftData', () => ({ getGiftById: vi.fn().mockReturnValue(GOLDEN_ROSE) }))
    vi.stubGlobal('usePropLookup', () => ({ resolvePropAsync: vi.fn().mockResolvedValue(null) }))
    vi.stubGlobal('useSlidePlayback', () => ({ playEntrySlide: vi.fn() }))
    vi.stubGlobal('useGiftComboStore', () => ({ consumePendingRefund: vi.fn().mockReturnValue(0) }))
    vi.stubGlobal('useGiftStore', () => ({ enqueuePlayback: vi.fn(), removeRecipient: vi.fn() }))
    vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
  })

  async function setup(gift: typeof GOLDEN_ROSE = GOLDEN_ROSE) {
    vi.stubGlobal('useGiftData', () => ({ getGiftById: vi.fn().mockReturnValue(gift) }))
    const { setupRoomEventHandlers } = await import('../../app/composables/room/useRoomEventHandlers')
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const { useAuthStore } = await import('../../app/stores/auth')
    const { useRoomStore } = await import('../../app/stores/room')
    const { useRoomAudioStore } = await import('../../app/stores/roomAudio')

    const seatsStore = useRoomSeatsStore()
    const participantsStore = useRoomParticipantsStore()
    const authStore = useAuthStore()
    const roomStore = useRoomStore()
    const audioStore = useRoomAudioStore()
    roomStore.setCurrentRoom({ id: 1, room_xp: '0', daily_xp: '0' } as never)

    participantsStore.addParticipant({ id: 2, name: 'Ali' } as never)
    participantsStore.addParticipant({ id: 3, name: 'Sara' } as never)

    vi.stubGlobal('useRoomSeatsStore', () => seatsStore)
    vi.stubGlobal('useRoomParticipantsStore', () => participantsStore)
    vi.stubGlobal('useAuthStore', () => authStore)
    vi.stubGlobal('useRoomStore', () => roomStore)
    vi.stubGlobal('useRoomAudioStore', () => audioStore)

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
    return { socket, audioStore, participantsStore, authStore }
  }

  it('single recipient: synthesizes "Ali sent Golden Rose ×3 to Sara — 1,500 coins"', async () => {
    const { socket, audioStore } = await setup()

    socket.handlers.get('gift:received')?.({
      senderId: 2,
      roomId: '1',
      giftId: 9,
      recipientId: 3,
      recipientIds: [3],
      quantity: 3,
      batchId: 'batch-1',
    })

    expect(audioStore.messages).toHaveLength(1)
    expect(audioStore.messages[0]?.type).toBe(CHAT_MESSAGE_TYPE_GIFT)
    expect(audioStore.messages[0]?.content).toBe('Ali sent Golden Rose ×3 to Sara — 1,500 coins')
  })

  it('multi recipient: synthesizes "Ali sent Golden Rose ×3 to 4 seats — 6,000 coins"', async () => {
    const { socket, audioStore } = await setup()

    socket.handlers.get('gift:received')?.({
      senderId: 2,
      roomId: '1',
      giftId: 9,
      recipientId: 3,
      recipientIds: [3, 4, 5, 6],
      quantity: 3,
      batchId: 'batch-2',
    })

    expect(audioStore.messages).toHaveLength(1)
    expect(audioStore.messages[0]?.content).toBe('Ali sent Golden Rose ×3 to 4 seats — 6,000 coins')
  })

  it('does not synthesize a second bubble from the legacy singular siblings of the same burst', async () => {
    const { socket, audioStore } = await setup()
    const handler = socket.handlers.get('gift:received')!

    // Burst-shaped event first (recipientIds present).
    handler({ senderId: 2, roomId: '1', giftId: 9, recipientId: 3, recipientIds: [3, 4], quantity: 1, batchId: 'batch-3' })
    // Then its N legacy singular siblings (recipientIds absent) — must not add another bubble.
    handler({ senderId: 2, roomId: '1', giftId: 9, recipientId: 3, quantity: 1, batchId: 'batch-3' })
    handler({ senderId: 2, roomId: '1', giftId: 9, recipientId: 4, quantity: 1, batchId: 'batch-3' })

    expect(audioStore.messages).toHaveLength(1)
  })

  it('combo streak: 20 taps to the same recipient set (each its own batchId) patch ONE bubble ending at ×20 with the true cumulative total', async () => {
    const { socket, audioStore } = await setup()
    const handler = socket.handlers.get('gift:received')!

    for (let i = 0; i < 20; i++) {
      handler({ senderId: 2, roomId: '1', giftId: 9, recipientId: 3, recipientIds: [3], quantity: 1, batchId: `combo-${i}` })
    }

    expect(audioStore.messages).toHaveLength(1)
    expect(audioStore.messages[0]?.content).toBe('Ali sent Golden Rose ×20 to Sara — 10,000 coins')
  })

  it('a distinct recipient set after a streak times out starts a fresh bubble (does not patch the old one)', async () => {
    const { socket, audioStore } = await setup()
    const handler = socket.handlers.get('gift:received')!

    handler({ senderId: 2, roomId: '1', giftId: 9, recipientId: 3, recipientIds: [3], quantity: 1, batchId: 'a' })
    // Advance past the combo streak's own lifetime — the streak has expired.
    vi.advanceTimersByTime(6000)
    handler({ senderId: 2, roomId: '1', giftId: 9, recipientId: 3, recipientIds: [3], quantity: 1, batchId: 'b' })

    expect(audioStore.messages).toHaveLength(2)
    expect(audioStore.messages[1]?.content).toBe('Ali sent Golden Rose ×1 to Sara — 500 coins')
  })

  it('synthesizes even when the sender is the local user (bubble is for every client, not just recipients)', async () => {
    const { socket, audioStore, authStore } = await setup()
    authStore.user = { id: 2 } as never

    socket.handlers.get('gift:received')?.({
      senderId: 2,
      roomId: '1',
      giftId: 9,
      recipientId: 3,
      recipientIds: [3],
      quantity: 1,
      batchId: 'batch-self',
    })

    expect(audioStore.messages).toHaveLength(1)
  })

  it('never synthesizes a gift-sent bubble for a lucky-category gift (lucky gifts announce only via the lucky-win slide bubble)', async () => {
    const { socket, audioStore } = await setup(LUCKY_GIFT)

    socket.handlers.get('gift:received')?.({
      senderId: 2,
      roomId: '1',
      giftId: 11,
      recipientId: 3,
      recipientIds: [3],
      quantity: 1,
      batchId: 'batch-lucky',
    })

    expect(audioStore.messages).toHaveLength(0)
  })
})
