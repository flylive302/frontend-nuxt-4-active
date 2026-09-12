/**
 * Unit tests for setupRoomEventHandlers — Lucky Number socket → store
 * mapping (lucky-number/01).
 *
 * Scope: 'luckyNumber:started' / 'luckyNumber:result' handlers and the
 * module-level reveal timer only. All non-lucky-number composables/stores
 * used by the handler file are stubbed, mirroring
 * useRoomEventHandlersGiftChat.spec.ts. Uses the real roomSeats store.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import { seatGiftValue } from '../../app/utils/gift'
import { useUserBlocksStore } from '../../app/stores/userBlocks'
import { LUCKY_NUMBER } from '../../app/constants/lucky-number'

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

describe('setupRoomEventHandlers — Lucky Number', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.stubGlobal('useUserBlocksStore', () => useUserBlocksStore())
    vi.useFakeTimers()

    vi.stubGlobal('useGiftData', () => ({ getGiftById: vi.fn().mockReturnValue(GOLDEN_ROSE) }))
    vi.stubGlobal('usePropLookup', () => ({ resolvePropAsync: vi.fn().mockResolvedValue(null) }))
    vi.stubGlobal('useSlidePlayback', () => ({ playEntrySlide: vi.fn() }))
    vi.stubGlobal('useGiftComboStore', () => ({ consumePendingRefund: vi.fn().mockReturnValue(0) }))
    vi.stubGlobal('useServerCapabilitiesStore', () => ({ ackBalance: false, giftBatch: false }))
    vi.stubGlobal('useGiftStore', () => ({ enqueuePlayback: vi.fn(), removeRecipient: vi.fn() }))
    vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
  })

  async function setup() {
    const { setupRoomEventHandlers, cleanupRoomEventHandlers } = await import('../../app/composables/room/useRoomEventHandlers')
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

    vi.stubGlobal('useRoomSeatsStore', () => seatsStore)
    vi.stubGlobal('useRoomParticipantsStore', () => participantsStore)
    vi.stubGlobal('useAuthStore', () => authStore)
    vi.stubGlobal('useRoomStore', () => roomStore)
    vi.stubGlobal('useRoomAudioStore', () => audioStore)
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
    return { socket, seatsStore, cleanupRoomEventHandlers }
  }

  it("'luckyNumber:started' sets seatsStore.luckyNumberRound and clears a previous reveal", async () => {
    const { socket, seatsStore } = await setup()
    seatsStore.setLuckyNumberReveal(
      { roundId: 'old', drawn: 3, picks: {}, winners: [] },
      LUCKY_NUMBER.cooldownMs,
    )
    expect(seatsStore.luckyNumberReveal).not.toBeNull()

    const endsAt = Date.now() + 10000
    socket.handlers.get('luckyNumber:started')?.({ roundId: 'r1', endsAt })

    expect(seatsStore.luckyNumberRound).toEqual({ roundId: 'r1', endsAt })
    expect(seatsStore.luckyNumberReveal).toBeNull()
  })

  it("'luckyNumber:result' clears the round, sets the reveal, arms cooldown, and clears the reveal after revealDurationMs", async () => {
    const { socket, seatsStore } = await setup()
    socket.handlers.get('luckyNumber:started')?.({ roundId: 'r1', endsAt: Date.now() + 10000 })

    socket.handlers.get('luckyNumber:result')?.({ roundId: 'r1', drawn: 5, picks: {}, winners: [] })

    expect(seatsStore.luckyNumberRound).toBeNull()
    expect(seatsStore.luckyNumberReveal?.drawn).toBe(5)
    expect(seatsStore.luckyNumberReveal?.winners).toEqual([])
    expect(seatsStore.luckyNumberCooldownUntil).toBeGreaterThan(Date.now())

    vi.advanceTimersByTime(LUCKY_NUMBER.revealDurationMs)

    expect(seatsStore.luckyNumberReveal).toBeNull()
  })

  it('a new started round does not let the old reveal timer clear the new reveal', async () => {
    const { socket, seatsStore } = await setup()

    // Round r1 finishes and its reveal timer is armed.
    socket.handlers.get('luckyNumber:started')?.({ roundId: 'r1', endsAt: Date.now() + 10000 })
    socket.handlers.get('luckyNumber:result')?.({ roundId: 'r1', drawn: 1, picks: {}, winners: [] })

    // Halfway through r1's reveal window, round r2 starts and finishes too —
    // this re-arms the single module-level timer for r2's reveal.
    vi.advanceTimersByTime(LUCKY_NUMBER.revealDurationMs / 2)
    socket.handlers.get('luckyNumber:started')?.({ roundId: 'r2', endsAt: Date.now() + 10000 })
    socket.handlers.get('luckyNumber:result')?.({ roundId: 'r2', drawn: 2, picks: {}, winners: [] })

    // r1's original timer would have fired here — it must not touch r2's reveal.
    vi.advanceTimersByTime(LUCKY_NUMBER.revealDurationMs / 2)
    expect(seatsStore.luckyNumberReveal?.roundId).toBe('r2')

    // r2's own timer clears it after its full window.
    vi.advanceTimersByTime(LUCKY_NUMBER.revealDurationMs / 2)
    expect(seatsStore.luckyNumberReveal).toBeNull()
  })

  it('cleanupRoomEventHandlers calls socket.off for luckyNumber:started and luckyNumber:result', async () => {
    const { socket, cleanupRoomEventHandlers } = await setup()

    cleanupRoomEventHandlers(socket as never)

    expect(socket.off).toHaveBeenCalledWith('luckyNumber:started')
    expect(socket.off).toHaveBeenCalledWith('luckyNumber:result')
  })

  it("'luckyNumber:picked' during a live round adds the userId to luckyNumberPickedUserIds", async () => {
    const { socket, seatsStore } = await setup()
    socket.handlers.get('luckyNumber:started')?.({ roundId: 'r1', endsAt: Date.now() + 10000 })

    socket.handlers.get('luckyNumber:picked')?.({ roundId: 'r1', userId: 7 })

    expect(seatsStore.luckyNumberPickedUserIds.has(7)).toBe(true)
  })

  it("'luckyNumber:picked' with a stale roundId is ignored", async () => {
    const { socket, seatsStore } = await setup()
    socket.handlers.get('luckyNumber:started')?.({ roundId: 'r1', endsAt: Date.now() + 10000 })

    socket.handlers.get('luckyNumber:picked')?.({ roundId: 'stale', userId: 7 })

    expect(seatsStore.luckyNumberPickedUserIds.size).toBe(0)
  })

  it("'luckyNumber:picked' is registered as a handled room event", async () => {
    const { socket } = await setup()
    expect(socket.handlers.has('luckyNumber:picked')).toBe(true)
  })

  describe('round-ended-without-result fallback (lucky-number/03)', () => {
    it('clears the round after endsAt + resultGraceMs when no result arrives', async () => {
      const { socket, seatsStore } = await setup()
      const endsAt = Date.now() + 10000
      socket.handlers.get('luckyNumber:started')?.({ roundId: 'r1', endsAt })

      vi.advanceTimersByTime(10000 + LUCKY_NUMBER.resultGraceMs - 1)
      expect(seatsStore.luckyNumberRound?.roundId).toBe('r1')

      vi.advanceTimersByTime(1)
      expect(seatsStore.luckyNumberRound).toBeNull()
      expect(seatsStore.luckyNumberReveal).toBeNull()
      expect(seatsStore.luckyNumberCooldownUntil).toBe(0)
    })

    it("a 'luckyNumber:result' arriving before the grace window cancels the fallback", async () => {
      const { socket, seatsStore } = await setup()
      const endsAt = Date.now() + 10000
      socket.handlers.get('luckyNumber:started')?.({ roundId: 'r1', endsAt })

      vi.advanceTimersByTime(10000)
      socket.handlers.get('luckyNumber:result')?.({ roundId: 'r1', drawn: 5, picks: {}, winners: [] })

      vi.advanceTimersByTime(LUCKY_NUMBER.resultGraceMs)

      expect(seatsStore.luckyNumberReveal?.roundId).toBe('r1')
      expect(seatsStore.luckyNumberReveal?.drawn).toBe(5)
    })

    it('a second started round re-arms the fallback for the new round', async () => {
      const { socket, seatsStore } = await setup()
      socket.handlers.get('luckyNumber:started')?.({ roundId: 'r1', endsAt: Date.now() + 10000 })

      vi.advanceTimersByTime(5000)
      socket.handlers.get('luckyNumber:started')?.({ roundId: 'r2', endsAt: Date.now() + 10000 })

      // r1's original fallback would have fired here — must not touch r2.
      vi.advanceTimersByTime(5000 + LUCKY_NUMBER.resultGraceMs)
      expect(seatsStore.luckyNumberRound?.roundId).toBe('r2')

      // r2's own fallback fires after its full window.
      vi.advanceTimersByTime(5000)
      expect(seatsStore.luckyNumberRound).toBeNull()
    })

    it('cleanupRoomEventHandlers clears the fallback timer', async () => {
      const { socket, seatsStore, cleanupRoomEventHandlers } = await setup()
      const endsAt = Date.now() + 10000
      socket.handlers.get('luckyNumber:started')?.({ roundId: 'r1', endsAt })

      cleanupRoomEventHandlers(socket as never)
      vi.advanceTimersByTime(10000 + LUCKY_NUMBER.resultGraceMs + 1000)

      // Fallback was cleared, so the round set before cleanup is untouched.
      expect(seatsStore.luckyNumberRound?.roundId).toBe('r1')
    })

    it('armLuckyNumberEndFallback (the join-snapshot path) behaves the same as the started-listener path', async () => {
      const { seatsStore } = await setup()
      const { armLuckyNumberEndFallback } = await import('../../app/composables/room/useRoomEventHandlers')
      const endsAt = Date.now() + 10000
      seatsStore.hydrateLuckyNumber({ roundId: 'r1', endsAt, pickedUserIds: [] })

      armLuckyNumberEndFallback('r1', endsAt)

      vi.advanceTimersByTime(10000 + LUCKY_NUMBER.resultGraceMs - 1)
      expect(seatsStore.luckyNumberRound?.roundId).toBe('r1')

      vi.advanceTimersByTime(1)
      expect(seatsStore.luckyNumberRound).toBeNull()
    })
  })
})
