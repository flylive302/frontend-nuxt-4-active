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
    vi.stubGlobal('useGiftComboStore', () => ({ pendingRefund: 0 }))
    vi.stubGlobal('useRoomAudioStore', () => ({ setActiveSpeakers: vi.fn() }))
    vi.stubGlobal('useGiftStore', () => ({ enqueuePlayback: vi.fn(), removeRecipient: vi.fn() }))
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
    vi.stubGlobal('useGiftComboStore', () => ({ pendingRefund: 0 }))
    vi.stubGlobal('useRoomAudioStore', () => ({ setActiveSpeakers: vi.fn() }))
    vi.stubGlobal('useGiftStore', () => ({ enqueuePlayback: vi.fn(), removeRecipient: vi.fn() }))
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

  it("a reason:'grace' sweep clear IS swallowed when the same user re-claimed the seat within the window", async () => {
    const { socket, seatsStore } = await setupCleared()
    seatsStore.updateSeat(3, 7, false)

    socket.handlers.get('seat:cleared')?.({ seatIndex: 3, userId: 7, reason: 'grace' })

    // The delayed retention-sweep release must not evict a self-retaken seat.
    expect(seatsStore.seats[3]?.occupantId).toBe(7)
  })

  it("a reason:'grace' clear applies normally when there is no recent re-claim", async () => {
    const { socket, seatsStore } = await setupCleared()
    seatsStore.updateSeat(3, 7, false)
    // Age the claim past the 10s window.
    const realNow = Date.now
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 11_000)

    socket.handlers.get('seat:cleared')?.({ seatIndex: 3, userId: 7, reason: 'grace' })
    vi.restoreAllMocks()

    expect(seatsStore.seats[3]?.occupantId).toBeNull()
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
    vi.stubGlobal('useGiftComboStore', () => ({ pendingRefund: 0 }))
    vi.stubGlobal('useRoomAudioStore', () => ({ setActiveSpeakers: vi.fn() }))
    vi.stubGlobal('useGiftStore', () => ({ enqueuePlayback: vi.fn(), removeRecipient: vi.fn() }))
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

  it("a seat:cleared WITHOUT reason:'shrink' still shows the generic own-seat toast (regression guard)", async () => {
    const { socket, seatsStore, actions, toast } = await setupEviction()
    seatsStore.updateSeat(3, 7, false)

    socket.handlers.get('seat:cleared')?.({ seatIndex: 3, userId: 7 })

    expect(seatsStore.seats[3]?.occupantId).toBeNull()
    expect(actions.stopAudio).toHaveBeenCalledTimes(1)
    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Removed from seat' }),
    )
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
    vi.stubGlobal('useGiftComboStore', () => ({ pendingRefund: 0 }))
    vi.stubGlobal('useRoomAudioStore', () => ({ setActiveSpeakers: vi.fn() }))
    vi.stubGlobal('useGiftStore', () => ({ enqueuePlayback: vi.fn(), removeRecipient: vi.fn() }))
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
