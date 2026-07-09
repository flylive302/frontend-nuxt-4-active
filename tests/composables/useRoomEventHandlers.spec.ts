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

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('nextTick', nextTick)
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
