/**
 * Tests for setupRoomEventHandlers
 *
 * Verifies the new 3-param interface: (socket, roomActions, toast).
 * Stores are resolved inside the function via useXStore() — not injected.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================
// Module mocks (direct imports in the implementation)
// ============================================

vi.mock('~/composables/lucky/useLuckyGift', () => ({
  setupLuckyEventHandlers: vi.fn(),
  cleanupLuckyEventHandlers: vi.fn(),
}))

// noinspection JSUnusedGlobalSymbols
vi.mock('~/composables/lucky/useLuckyFly', () => ({
  useLuckyFly: () => ({ triggerFly: vi.fn() }),
}))

vi.mock('~/services/giftAssetCache', () => ({
  preloadGift: vi.fn(),
  preloadSvga: vi.fn(),
}))

vi.mock('~/utils/prop', () => ({
  propToEntryAnimationGift: vi.fn(),
}))

// ============================================
// Global stubs (Nuxt auto-imports resolved inside setupRoomEventHandlers)
// ============================================

let mockParticipantsStore: {
  removeParticipant: ReturnType<typeof vi.fn>
  addParticipant: ReturnType<typeof vi.fn>
  updateParticipantProfile: ReturnType<typeof vi.fn>
  participants: Map<number, unknown>
}

let mockAudioStore: {
  audioState: { activeSpeakerIds: number[] }
  addMessage: ReturnType<typeof vi.fn>
  setActiveSpeakers: ReturnType<typeof vi.fn>
}

let mockSeatsStore: {
  clearParticipantFromSeat: ReturnType<typeof vi.fn>
  updateSeat: ReturnType<typeof vi.fn>
  clearSeat: ReturnType<typeof vi.fn>
  setSeatMutedByUserId: ReturnType<typeof vi.fn>
  setSeatLocked: ReturnType<typeof vi.fn>
  syncActiveSpeakers: ReturnType<typeof vi.fn>
  seats: unknown[]
  addSeatGiftValue: ReturnType<typeof vi.fn>
  getRecentClaim: ReturnType<typeof vi.fn>
}

let mockRoomStore: {
  currentRoom: { id: string | number; room_xp?: string; owner?: { id: number } } | null
  isMinimized: boolean
  previousRoute: string | null
  leaveRoom: ReturnType<typeof vi.fn>
  refreshCurrentRoom: ReturnType<typeof vi.fn>
}

const mockAuthStore = {
  user: { id: 1, name: 'Test' },
  patchProfile: vi.fn(),
  patchBalance: vi.fn(),
}

let mockGiftStore: {
  removeRecipient: ReturnType<typeof vi.fn>
  enqueuePlayback: ReturnType<typeof vi.fn>
  restartCurrentPlayback: ReturnType<typeof vi.fn>
  currentPlayback: null
}

vi.stubGlobal('useAuthStore', () => mockAuthStore)
vi.stubGlobal('useGiftData', () => ({ getGiftById: vi.fn().mockReturnValue(null) }))
vi.stubGlobal('usePropLookup', () => ({ resolvePropAsync: vi.fn().mockResolvedValue(null) }))
vi.stubGlobal('useRoomSlideStore', () => ({ addSlide: vi.fn(), clearSlides: vi.fn() }))
vi.stubGlobal('useGiftComboStore', () => ({ pendingRefund: 0 }))
vi.stubGlobal('navigateTo', vi.fn())

// ============================================
// Socket mock helper
// ============================================

function createMockSocket() {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {}
  const socket = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      handlers[event] = handler
    }),
    off: vi.fn(),
    emit: vi.fn(),
  }
  const trigger = (event: string, payload: unknown) => handlers[event]?.(payload)
  return { socket, trigger }
}

// ============================================
// Tests
// ============================================

describe('setupRoomEventHandlers', () => {
  let mockToast: {
    toasts: ReturnType<typeof vi.fn>
    add: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
  }
  let roomActions: {
    leaveRoom: ReturnType<typeof vi.fn>
    stopAudio: ReturnType<typeof vi.fn>
    consumeProducer: ReturnType<typeof vi.fn>
    stopConsumer: ReturnType<typeof vi.fn>
    acceptInvite: ReturnType<typeof vi.fn>
    declineInvite: ReturnType<typeof vi.fn>
    startAudio: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockToast = {
      toasts: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    }

    roomActions = {
      leaveRoom: vi.fn(),
      stopAudio: vi.fn(),
      consumeProducer: vi.fn().mockResolvedValue(undefined),
      stopConsumer: vi.fn(),
      acceptInvite: vi.fn().mockResolvedValue(true),
      declineInvite: vi.fn().mockResolvedValue(true),
      startAudio: vi.fn().mockResolvedValue(undefined),
    }

    mockParticipantsStore = {
      removeParticipant: vi.fn(),
      addParticipant: vi.fn(),
      updateParticipantProfile: vi.fn(),
      participants: new Map(),
    }

    mockAudioStore = {
      audioState: { activeSpeakerIds: [] },
      addMessage: vi.fn(),
      setActiveSpeakers: vi.fn(),
    }

    mockSeatsStore = {
      clearParticipantFromSeat: vi.fn(),
      updateSeat: vi.fn(),
      clearSeat: vi.fn(),
      setSeatMutedByUserId: vi.fn(),
      setSeatLocked: vi.fn(),
      syncActiveSpeakers: vi.fn(),
      seats: [],
      addSeatGiftValue: vi.fn(),
      getRecentClaim: vi.fn().mockReturnValue(null),
    }

    mockRoomStore = {
      currentRoom: null,
      isMinimized: false,
      previousRoute: null,
      leaveRoom: vi.fn(),
      refreshCurrentRoom: vi.fn(),
    }

    mockGiftStore = {
      removeRecipient: vi.fn(),
      enqueuePlayback: vi.fn(),
      restartCurrentPlayback: vi.fn(),
      currentPlayback: null,
    }

    vi.stubGlobal('useRoomParticipantsStore', () => mockParticipantsStore)
    vi.stubGlobal('useRoomAudioStore', () => mockAudioStore)
    vi.stubGlobal('useRoomSeatsStore', () => mockSeatsStore)
    vi.stubGlobal('useRoomStore', () => mockRoomStore)
    vi.stubGlobal('useGiftStore', () => mockGiftStore)
  })

  describe('room:userLeft', () => {
    it('removes participant, clears seat, removes gift recipient', async () => {
      const { socket, trigger } = createMockSocket()

      const { setupRoomEventHandlers } = await import('../../app/composables/room/useRoomEventHandlers')
      setupRoomEventHandlers(socket as unknown as Parameters<typeof setupRoomEventHandlers>[0], roomActions, mockToast as unknown as Parameters<typeof setupRoomEventHandlers>[2])

      trigger('room:userLeft', { userId: 42 })

      expect(mockParticipantsStore.removeParticipant).toHaveBeenCalledWith(42)
      expect(mockSeatsStore.clearParticipantFromSeat).toHaveBeenCalledWith(42)
      expect(mockGiftStore.removeRecipient).toHaveBeenCalledWith(42)
    })
  })

  describe('room:closed', () => {
    it('calls leaveRoom callback and shows a warning toast', async () => {
      const { socket, trigger } = createMockSocket()

      const { setupRoomEventHandlers } = await import('../../app/composables/room/useRoomEventHandlers')
      setupRoomEventHandlers(socket as unknown as Parameters<typeof setupRoomEventHandlers>[0], roomActions, mockToast as unknown as Parameters<typeof setupRoomEventHandlers>[2])

      mockRoomStore.previousRoute = '/home'
      trigger('room:closed', { reason: 'Owner ended' })

      expect(roomActions.leaveRoom).toHaveBeenCalled()
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'warning' }),
      )
    })
  })
})
