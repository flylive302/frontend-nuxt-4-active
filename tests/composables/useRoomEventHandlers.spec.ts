/**
 * Unit tests for setupRoomEventHandlers — seat:reaction wiring (ADR 0015 /
 * seat-reactions slice 04 — lifecycle hardening).
 *
 * Scope is intentionally narrow: the `seat:reaction` → store mapping, and a
 * no-replay assertion that joining a room (`room:userJoined`) never touches
 * `activeReactions`. All non-reaction composables/stores used by the handler
 * file are stubbed — this file does not re-test gift/lucky/slide behavior.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import { seatGiftValue } from '../../app/utils/gift'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('nextTick', nextTick)
// seatGiftValue is a Nuxt auto-import in the handler file under test; stub
// the global with the real implementation for the daily-XP-bump suite below.
vi.stubGlobal('seatGiftValue', seatGiftValue)
// authStore's persist config calls this at store-definition time
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

// ============================================
// Mock explicit-import dependencies (not Nuxt auto-imports)
// ============================================
vi.mock('../../app/composables/lucky/useLuckyGift', () => ({
  setupLuckyEventHandlers: vi.fn(),
  cleanupLuckyEventHandlers: vi.fn(),
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

// ============================================
// Mock socket
// ============================================
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

describe('setupRoomEventHandlers — seat reactions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Non-reaction Nuxt auto-import globals — stubbed, not exercised here.
    vi.stubGlobal('useGiftData', () => ({ getGiftById: vi.fn() }))
    vi.stubGlobal('usePropLookup', () => ({ resolvePropAsync: vi.fn().mockResolvedValue(null) }))
    vi.stubGlobal('useSlidePlayback', () => ({ playEntrySlide: vi.fn() }))
    vi.stubGlobal('useGiftComboStore', () => ({ consumePendingRefund: vi.fn().mockReturnValue(0) }))
    vi.stubGlobal('useRoomAudioStore', () => ({ setActiveSpeakers: vi.fn() }))
    vi.stubGlobal('useGiftStore', () => ({ enqueuePlayback: vi.fn(), removeRecipient: vi.fn() }))
    vi.stubGlobal('useServerCapabilitiesStore', () => ({ giftBatch: false, ackBalance: false }))
    vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
  })

  async function setup() {
    const { setupRoomEventHandlers } = await import('../../app/composables/room/useRoomEventHandlers')
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const { useAuthStore } = await import('../../app/stores/auth')
    const { useRoomStore } = await import('../../app/stores/room')

    // These are real Pinia stores, referenced via Nuxt auto-import globals
    // inside the handler file — stub the globals to return the real store
    // instances so state mutations are observable in the test.
    const seatsStore = useRoomSeatsStore()
    const participantsStore = useRoomParticipantsStore()
    const authStore = useAuthStore()
    const roomStore = useRoomStore()
    vi.stubGlobal('useRoomSeatsStore', () => seatsStore)
    vi.stubGlobal('useRoomParticipantsStore', () => participantsStore)
    vi.stubGlobal('useAuthStore', () => authStore)
    vi.stubGlobal('useRoomStore', () => roomStore)
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

    return { socket, seatsStore, participantsStore, roomStore }
  }

  it('registers a seat:reaction listener that maps directly to setReaction — no persistence, no other side effect', async () => {
    const { socket, seatsStore } = await setup()

    const handler = socket.handlers.get('seat:reaction')
    expect(handler).toBeDefined()

    handler?.({ userId: 7, code: '1f602' })

    expect(seatsStore.activeReactions.get(7)?.code).toBe('1f602')
  })

  it('no-replay: room:userJoined never populates or touches activeReactions for the joiner', async () => {
    const { socket, seatsStore } = await setup()

    const joinHandler = socket.handlers.get('room:userJoined')
    expect(joinHandler).toBeDefined()

    await joinHandler?.({ user: { id: 99, name: 'Late Joiner' } })

    // A mid-animation joiner sees nothing — the join path never calls
    // setReaction/clearReaction, and no reaction is retroactively replayed.
    expect(seatsStore.activeReactions.has(99)).toBe(false)
  })

  it('a reaction active before a user rejoins is not cleared or replayed by room:userJoined', async () => {
    const { socket, seatsStore } = await setup()
    seatsStore.setReaction(5, '1f923')

    const joinHandler = socket.handlers.get('room:userJoined')
    await joinHandler?.({ user: { id: 5, name: 'Rejoiner' } })

    // room:userJoined must not clear an unrelated in-flight reaction either —
    // it is not a vacate path.
    expect(seatsStore.activeReactions.get(5)?.code).toBe('1f923')
  })
})

describe('setupRoomEventHandlers — seat:cleared self-retake guard (F-24)', () => {
  // Reuses the reaction suite's setup/mocks via the shared beforeEach below.
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.stubGlobal('useGiftData', () => ({ getGiftById: vi.fn() }))
    vi.stubGlobal('usePropLookup', () => ({ resolvePropAsync: vi.fn().mockResolvedValue(null) }))
    vi.stubGlobal('useSlidePlayback', () => ({ playEntrySlide: vi.fn() }))
    vi.stubGlobal('useGiftComboStore', () => ({ consumePendingRefund: vi.fn().mockReturnValue(0) }))
    vi.stubGlobal('useRoomAudioStore', () => ({ setActiveSpeakers: vi.fn() }))
    vi.stubGlobal('useGiftStore', () => ({ enqueuePlayback: vi.fn(), removeRecipient: vi.fn() }))
    vi.stubGlobal('useServerCapabilitiesStore', () => ({ giftBatch: false, ackBalance: false }))
    vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
  })

  async function setupCleared() {
    const { setupRoomEventHandlers } = await import('../../app/composables/room/useRoomEventHandlers')
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const { useAuthStore } = await import('../../app/stores/auth')
    const { useRoomStore } = await import('../../app/stores/room')

    const seatsStore = useRoomSeatsStore()
    vi.stubGlobal('useRoomSeatsStore', () => seatsStore)
    vi.stubGlobal('useRoomParticipantsStore', () => useRoomParticipantsStore())
    vi.stubGlobal('useAuthStore', () => useAuthStore())
    vi.stubGlobal('useRoomStore', () => useRoomStore())
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
    return { socket, seatsStore }
  }

  it('an untagged (explicit-leave) seat:cleared always clears, even right after the same user claimed the seat', async () => {
    const { socket, seatsStore } = await setupCleared()
    // User 7 takes seat 3, then explicitly leaves within the 10s claim window.
    seatsStore.updateSeat(3, 7, false)

    socket.handlers.get('seat:cleared')?.({ seatIndex: 3, userId: 7 })

    // Regression: the guard used to swallow this and leave a ghost occupant.
    expect(seatsStore.seats[3]?.occupantId).toBeNull()
  })

  it('a stale clear for a DIFFERENT user than the current occupant is ignored', async () => {
    const { socket, seatsStore } = await setupCleared()
    // Seat 3 was reused by user 9 after user 7 left; a delayed clear for 7
    // must not evict 9.
    seatsStore.updateSeat(3, 9, false)

    socket.handlers.get('seat:cleared')?.({ seatIndex: 3, userId: 7 })

    expect(seatsStore.seats[3]?.occupantId).toBe(9)
  })
})

// ============================================================
// room-seat-caps/02 — Seat Eviction (shrink)
// ============================================================
describe('setupRoomEventHandlers — seat eviction (shrink) (room-seat-caps/02)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.stubGlobal('useGiftData', () => ({ getGiftById: vi.fn() }))
    vi.stubGlobal('usePropLookup', () => ({ resolvePropAsync: vi.fn().mockResolvedValue(null) }))
    vi.stubGlobal('useSlidePlayback', () => ({ playEntrySlide: vi.fn() }))
    vi.stubGlobal('useGiftComboStore', () => ({ consumePendingRefund: vi.fn().mockReturnValue(0) }))
    vi.stubGlobal('useRoomAudioStore', () => ({ setActiveSpeakers: vi.fn() }))
    vi.stubGlobal('useGiftStore', () => ({ enqueuePlayback: vi.fn(), removeRecipient: vi.fn() }))
    vi.stubGlobal('useServerCapabilitiesStore', () => ({ giftBatch: false, ackBalance: false }))
  })

  async function setupEviction() {
    const { setupRoomEventHandlers } = await import('../../app/composables/room/useRoomEventHandlers')
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const { useAuthStore } = await import('../../app/stores/auth')
    const { useRoomStore } = await import('../../app/stores/room')

    const seatsStore = useRoomSeatsStore()
    const authStore = useAuthStore()
    authStore.user = { id: 7 } as never
    vi.stubGlobal('useRoomSeatsStore', () => seatsStore)
    vi.stubGlobal('useRoomParticipantsStore', () => useRoomParticipantsStore())
    vi.stubGlobal('useAuthStore', () => authStore)
    vi.stubGlobal('useRoomStore', () => useRoomStore())
    vi.stubGlobal('useRoomSessionStore', () => ({ previousRoute: '/' }))
    vi.stubGlobal('useRoomSession', () => ({ leaveRoom: vi.fn(), setCurrentRoom: vi.fn(), minimizeRoom: vi.fn(), maximizeRoom: vi.fn(), touchActiveRoom: vi.fn(), clearActiveRoom: vi.fn() }))

    const socket = createMockSocket()
    const toast = { add: vi.fn() }
    vi.stubGlobal('useToast', () => toast)
    const actions = {
      leaveRoom: vi.fn(),
      stopAudio: vi.fn(),
      consumeProducer: vi.fn(),
      stopConsumer: vi.fn(),
      acceptInvite: vi.fn(),
      declineInvite: vi.fn(),
      startAudio: vi.fn(),
    }
    setupRoomEventHandlers(socket as never, actions, toast as unknown as ReturnType<typeof useToast>)
    return { socket, seatsStore, actions, toast }
  }

  it('registers a seat:evicted listener', async () => {
    const { socket } = await setupEviction()
    expect(socket.handlers.get('seat:evicted')).toBeDefined()
  })

  it('seat:evicted tears down local speaker state (stopAudio) and shows the exact reduction toast', async () => {
    const { socket, actions, toast } = await setupEviction()

    socket.handlers.get('seat:evicted')?.({ roomId: '1', seatIndex: 12, newSeatCount: 10 })

    expect(actions.stopAudio).toHaveBeenCalledTimes(1)
    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "The room seat count was reduced — you've been moved to the audience",
      }),
    )
  })

  it("a seat:cleared with reason:'shrink' clears the store but skips the generic own-seat toast/teardown (dedicated seat:evicted owns it)", async () => {
    const { socket, seatsStore, actions, toast } = await setupEviction()
    seatsStore.updateSeat(3, 7, false)

    socket.handlers.get('seat:cleared')?.({ seatIndex: 3, userId: 7, reason: 'shrink' })

    expect(seatsStore.seats[3]?.occupantId).toBeNull()
    expect(actions.stopAudio).not.toHaveBeenCalled()
    expect(toast.add).not.toHaveBeenCalled()
  })

  it("a seat:cleared with reason:'removed' (owner/admin kick) shows the removed-from-seat toast", async () => {
    const { socket, seatsStore, actions, toast } = await setupEviction()
    seatsStore.updateSeat(3, 7, false)

    socket.handlers.get('seat:cleared')?.({ seatIndex: 3, userId: 7, reason: 'removed' })

    expect(seatsStore.seats[3]?.occupantId).toBeNull()
    expect(actions.stopAudio).toHaveBeenCalledTimes(1)
    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Removed from seat' }),
    )
  })

  it("an untagged seat:cleared (voluntary self-leave) tears down audio but stays toast-silent", async () => {
    const { socket, seatsStore, actions, toast } = await setupEviction()
    seatsStore.updateSeat(3, 7, false)

    socket.handlers.get('seat:cleared')?.({ seatIndex: 3, userId: 7 })

    expect(seatsStore.seats[3]?.occupantId).toBeNull()
    expect(actions.stopAudio).toHaveBeenCalledTimes(1)
    expect(toast.add).not.toHaveBeenCalled()
  })
})

// ============================================================
// daily-room-xp 03 — gift:received optimistic daily_xp bump
// ============================================================
describe('setupRoomEventHandlers — gift:received daily XP bump', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.stubGlobal('usePropLookup', () => ({ resolvePropAsync: vi.fn().mockResolvedValue(null) }))
    vi.stubGlobal('useSlidePlayback', () => ({ playEntrySlide: vi.fn() }))
    vi.stubGlobal('useGiftComboStore', () => ({ consumePendingRefund: vi.fn().mockReturnValue(0) }))
    vi.stubGlobal('useRoomAudioStore', () => ({ setActiveSpeakers: vi.fn() }))
    vi.stubGlobal('useGiftStore', () => ({ enqueuePlayback: vi.fn(), removeRecipient: vi.fn() }))
    vi.stubGlobal('useServerCapabilitiesStore', () => ({ giftBatch: false, ackBalance: false }))
    vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
  })

  async function setupGiftReceived(gift: { category: string; price: number } | null) {
    const { setupRoomEventHandlers } = await import('../../app/composables/room/useRoomEventHandlers')
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const { useAuthStore } = await import('../../app/stores/auth')
    const { useRoomStore } = await import('../../app/stores/room')

    const seatsStore = useRoomSeatsStore()
    const participantsStore = useRoomParticipantsStore()
    const authStore = useAuthStore()
    const roomStore = useRoomStore()
    roomStore.setCurrentRoom({ id: 1, room_xp: '500', daily_xp: '100' } as never)

    vi.stubGlobal('useRoomSeatsStore', () => seatsStore)
    vi.stubGlobal('useRoomParticipantsStore', () => participantsStore)
    vi.stubGlobal('useAuthStore', () => authStore)
    vi.stubGlobal('useRoomStore', () => roomStore)
    vi.stubGlobal('useRoomSessionStore', () => ({ previousRoute: '/' }))
    vi.stubGlobal('useRoomSession', () => ({ leaveRoom: vi.fn(), setCurrentRoom: vi.fn(), minimizeRoom: vi.fn(), maximizeRoom: vi.fn(), touchActiveRoom: vi.fn(), clearActiveRoom: vi.fn() }))
    vi.stubGlobal('useGiftData', () => ({ getGiftById: vi.fn().mockReturnValue(gift) }))

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
    return { socket, roomStore }
  }

  it('bumps daily_xp by the seat-gift-value amount for a normal gift', async () => {
    const { socket, roomStore } = await setupGiftReceived({ category: 'normal', price: 50 })

    socket.handlers.get('gift:received')?.({
      senderId: 2,
      recipientId: 3,
      giftId: 9,
      quantity: 1,
    })

    // XP writes are batched per frame (useRoomXpAccumulator); node has no
    // requestAnimationFrame so the batch flushes on the microtask queue.
    await Promise.resolve()
    // Normal gift: seatGiftValue = full GCV = 50.
    expect(roomStore.currentRoom?.daily_xp).toBe('150')
    // Lifetime room_xp bumps by the same amount, unaffected by this change.
    expect(roomStore.currentRoom?.room_xp).toBe('550')
  })

  it('bumps daily_xp by the split-base amount for a lucky gift, matching room_xp', async () => {
    const { socket, roomStore } = await setupGiftReceived({ category: 'lucky', price: 100 })

    socket.handlers.get('gift:received')?.({
      senderId: 2,
      recipientId: 3,
      giftId: 9,
      quantity: 1,
    })

    await Promise.resolve()
    // Lucky gift: seatGiftValue = split base = floor(100 * 0.10) = 10.
    expect(roomStore.currentRoom?.daily_xp).toBe('110')
    expect(roomStore.currentRoom?.room_xp).toBe('510')
  })

  it('does not bump daily_xp when the gift cannot be resolved', async () => {
    const { socket, roomStore } = await setupGiftReceived(null)

    socket.handlers.get('gift:received')?.({
      senderId: 2,
      recipientId: 3,
      giftId: 9,
      quantity: 1,
    })

    expect(roomStore.currentRoom?.daily_xp).toBe('100')
  })
})

/**
 * gift:error after acceptance, ackBalance path (gift-authority-tick-fanout
 * ticket 13). With ackBalance the refund itself arrives via balance.updated —
 * this handler must show a throttled toast WITHOUT touching the balance.
 * Without the capability the legacy consumePendingRefund add-back is
 * untouched (covered separately in useGiftSending.spec.ts's legacy tests and
 * implicitly by every other describe block in this file, which all default
 * the capability to false).
 */
describe('setupRoomEventHandlers — gift:error refund toast (ackBalance)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    vi.stubGlobal('useGiftData', () => ({ getGiftById: vi.fn() }))
    vi.stubGlobal('usePropLookup', () => ({ resolvePropAsync: vi.fn().mockResolvedValue(null) }))
    vi.stubGlobal('useSlidePlayback', () => ({ playEntrySlide: vi.fn() }))
    vi.stubGlobal('useRoomAudioStore', () => ({ setActiveSpeakers: vi.fn() }))
    vi.stubGlobal('useGiftStore', () => ({ enqueuePlayback: vi.fn(), removeRecipient: vi.fn() }))
  })

  async function setup(ackBalance: boolean) {
    const { setupRoomEventHandlers } = await import('../../app/composables/room/useRoomEventHandlers')
    const { useRoomSeatsStore } = await import('../../app/stores/roomSeats')
    const { useRoomParticipantsStore } = await import('../../app/stores/roomParticipants')
    const { useAuthStore } = await import('../../app/stores/auth')
    const { useRoomStore } = await import('../../app/stores/room')
    const { useGiftComboStore } = await import('../../app/stores/giftCombo')

    const seatsStore = useRoomSeatsStore()
    const participantsStore = useRoomParticipantsStore()
    const authStore = useAuthStore()
    const roomStore = useRoomStore()
    const comboStore = useGiftComboStore()
    authStore.user = { id: 1, coins: '500' } as never
    comboStore.setPendingRefund('batch-1', 200)

    vi.stubGlobal('useRoomSeatsStore', () => seatsStore)
    vi.stubGlobal('useRoomParticipantsStore', () => participantsStore)
    vi.stubGlobal('useAuthStore', () => authStore)
    vi.stubGlobal('useRoomStore', () => roomStore)
    vi.stubGlobal('useGiftComboStore', () => comboStore)
    vi.stubGlobal('useServerCapabilitiesStore', () => ({ ackBalance, giftBatch: false }))
    vi.stubGlobal('useRoomSessionStore', () => ({ previousRoute: '/' }))
    vi.stubGlobal('useRoomSession', () => ({ leaveRoom: vi.fn(), setCurrentRoom: vi.fn(), minimizeRoom: vi.fn(), maximizeRoom: vi.fn(), touchActiveRoom: vi.fn(), clearActiveRoom: vi.fn() }))

    const socket = createMockSocket()
    const toastAdd = vi.fn()
    const toast = { add: toastAdd } as unknown as ReturnType<typeof useToast>
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

    return { socket, authStore, comboStore, toastAdd }
  }

  it('ackBalance: shows the refund toast and does NOT touch the balance', async () => {
    const { socket, authStore, toastAdd } = await setup(true)

    socket.handlers.get('gift:error')?.({ transactionId: 't1', code: 4001, reason: 'refunded', batchId: 'batch-1' })

    expect(authStore.user?.coins).toBe('500') // unchanged — the push, not this handler, moves the balance
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Gift refunded' }))
  })

  it('ackBalance: a burst of gift:error events is throttled to one toast', async () => {
    vi.useFakeTimers()
    try {
      const { socket, toastAdd } = await setup(true)
      const frozen = 1_700_000_000_000
      vi.spyOn(Date, 'now').mockReturnValue(frozen)

      for (let i = 0; i < 10; i++) {
        socket.handlers.get('gift:error')?.({ transactionId: `t${i}`, code: 4001, reason: 'refunded', batchId: 'batch-1' })
      }

      expect(toastAdd).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('legacy (capability absent): the old consumePendingRefund add-back still runs, untouched', async () => {
    const { socket, authStore, comboStore, toastAdd } = await setup(false)

    socket.handlers.get('gift:error')?.({ transactionId: 't1', code: '4002', reason: 'insufficient_balance', batchId: 'batch-1' })

    expect(authStore.user?.coins).toBe('700') // 500 + 200 tracked refund
    expect(comboStore.consumePendingRefund('batch-1')).toBe(0) // already consumed
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Insufficient balance' }))
  })
})
