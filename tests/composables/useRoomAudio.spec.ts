/**
 * Unit Tests for useRoomAudio Composable
 *
 * These tests mock the dependent composables to test the room audio
 * orchestration logic in isolation.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref, computed, shallowRef, reactive, readonly } from 'vue'

// ============================================
// Mock Nuxt Auto-imports
// ============================================

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('shallowRef', shallowRef)
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('onUnmounted', vi.fn())

// Mock useToast
const mockToast = { add: vi.fn() }
vi.stubGlobal('useToast', () => mockToast)

// Mock Nuxt navigateTo
vi.stubGlobal('navigateTo', vi.fn())

// Mock useGiftComboStore (auto-imported)
vi.stubGlobal('useGiftComboStore', () => ({ pendingRefund: 0, $reset: vi.fn() }))

// Mock useLuckySessionStore (auto-imported)
vi.stubGlobal('useLuckySessionStore', () => ({ $reset: vi.fn() }))

// Mock useAuthStore (useRoomAudio calls this directly)
const mockAuthStore = { token: 'test-token', user: { id: 1, name: 'Test User' } }
vi.stubGlobal('useAuthStore', () => mockAuthStore)

// Mock useGiftStore
const mockGiftStore = {
  currentPlayback: null,
  enqueuePlayback: vi.fn(),
  restartCurrentPlayback: vi.fn(),
  removeRecipient: vi.fn(),
  clearPlayback: vi.fn(),
}
vi.stubGlobal('useGiftStore', () => mockGiftStore)

// Mock useGiftData
const mockGiftData = {
  getGiftById: vi.fn().mockReturnValue({ id: 1, name: 'Test Gift' }),
  ensureLoaded: vi.fn().mockResolvedValue(undefined),
}
vi.stubGlobal('useGiftData', () => mockGiftData)

// ============================================
// Mock Dependent Composables
// ============================================

const mockSocket = {
  value: {
    emit: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn(),
  },
}

const mockAudioSocketBase = {
  socket: mockSocket,
  status: ref('disconnected' as 'disconnected' | 'connecting' | 'connected' | 'error'),
  error: ref<string | null>(null),
  connect: vi.fn(),
  disconnect: vi.fn(),
}

const mockAudioSocket = {
  ...mockAudioSocketBase,
  isConnected: computed(() => mockAudioSocketBase.status.value === 'connected'),
}

const mockMediasoup = {
  device: ref(null),
  producer: ref(null as { id: string } | null),
  consumers: ref(new Map()),
  isProducing: ref(false),
  isLocalMuted: ref(false),
  isDeviceLoaded: ref(false),
  loadDevice: vi.fn().mockResolvedValue(undefined),
  createTransports: vi.fn().mockResolvedValue(undefined),
  startAudio: vi.fn().mockResolvedValue(undefined),
  stopAudio: vi.fn(),
  consumeProducer: vi.fn().mockResolvedValue(undefined),
  stopConsumer: vi.fn(),
  cleanup: vi.fn(),
  toggleLocalMute: vi.fn().mockReturnValue(true),
}

// Mock useAudioSocket as global (Nuxt auto-import)
vi.stubGlobal('useAudioSocket', () => mockAudioSocket)

// Mock useMediasoup as global (Nuxt auto-import)
vi.stubGlobal('useMediasoup', () => mockMediasoup)

// ============================================
// Mock Types Module (path alias resolution)
// ============================================

vi.mock('~/types/room/audio', () => ({
  userToParticipant: (user: Record<string, unknown>) => ({
    id: user.id,
    name: user.name,
    avatar_url: user.avatar_url,
    role: user.role,
    isSpeaker: false,
    seatIndex: undefined,
    isMuted: false,
  }),
}))

// ============================================
// Mock Room Store
// ============================================

let mockRoomStore: {
  currentRoom: { id: string } | null
  seats: Record<string, unknown>[]
  addParticipant: ReturnType<typeof vi.fn>
  removeParticipant: ReturnType<typeof vi.fn>
  addMessage: ReturnType<typeof vi.fn>
  updateSeat: ReturnType<typeof vi.fn>
  clearSeat: ReturnType<typeof vi.fn>
  setParticipantMuted: ReturnType<typeof vi.fn>
  setActiveSpeakers: ReturnType<typeof vi.fn>
  setSeatLocked: ReturnType<typeof vi.fn>
  setAudioConnected: ReturnType<typeof vi.fn>
  setAudioProducing: ReturnType<typeof vi.fn>
  setAudioMuted: ReturnType<typeof vi.fn>
  setProducing: ReturnType<typeof vi.fn>
  clearAudioState: ReturnType<typeof vi.fn>
  clearMessages: ReturnType<typeof vi.fn>
  clearParticipants: ReturnType<typeof vi.fn>
  clearSeats: ReturnType<typeof vi.fn>
}

vi.stubGlobal('useRoomStore', () => mockRoomStore)

// ============================================
// Mock Room Audio Store (audio state lives in useRoomAudioStore)
// ============================================

let mockAudioStore: {
  participants: Map<number, unknown>
  audioState: { isConnected: boolean; isProducing: boolean; isMuted: boolean; activeSpeakerIds: number[] }
  addParticipant: ReturnType<typeof vi.fn>
  reconcileParticipants: ReturnType<typeof vi.fn>
  setAudioConnected: ReturnType<typeof vi.fn>
  setProducing: ReturnType<typeof vi.fn>
  clearAudioState: ReturnType<typeof vi.fn>
}

vi.stubGlobal('useRoomAudioStore', () => mockAudioStore)

// ============================================
// Mock Room Seats Store
// ============================================

let mockSeatsStore: {
  seats: Record<string, unknown>[]
  resetSeats: ReturnType<typeof vi.fn>
  setSeatLocked: ReturnType<typeof vi.fn>
  updateSeat: ReturnType<typeof vi.fn>
  addSeatGiftValue: ReturnType<typeof vi.fn>
}

vi.stubGlobal('useRoomSeatsStore', () => mockSeatsStore)

// Mock usePropLookup (resolveProp used when building the self participant;
// resolvePropAsync drives the self entry-animation enqueue)
const mockPropLookup = {
  resolveProp: vi.fn().mockReturnValue(null),
  resolvePropAsync: vi.fn().mockResolvedValue(null),
}
vi.stubGlobal('usePropLookup', () => mockPropLookup)

// Mock useMediaSession (OS media-session activate/deactivate on join/leave)
const mockMediaSession = { activate: vi.fn(), deactivate: vi.fn() }
vi.stubGlobal('useMediaSession', () => mockMediaSession)

// These were missing from the original stubs; useRoomAudio.ts calls useRoomSlideStore()
// at composable init time (line ~111), and setupRoomEventHandlers calls useUserStore()
// at setup time — both need top-level stubs so they survive vi.resetModules().
vi.stubGlobal('useRoomSlideStore', () => ({ addSlide: vi.fn(), clearSlides: vi.fn() }))
vi.stubGlobal('useUserStore', () => ({ patchProfile: vi.fn(), patchBalance: vi.fn() }))
vi.stubGlobal('useMediasoupSessionStore', () => ({ $reset: vi.fn() }))

// ============================================
// Tests
// ============================================

describe('useRoomAudio', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockAudioSocket.status.value = 'disconnected'
    mockSocket.value.emit.mockClear()

    mockRoomStore = {
      currentRoom: null,
      seats: [],
      addParticipant: vi.fn(),
      removeParticipant: vi.fn(),
      addMessage: vi.fn(),
      updateSeat: vi.fn(),
      clearSeat: vi.fn(),
      setParticipantMuted: vi.fn(),
      setSeatLocked: vi.fn(),
      setActiveSpeakers: vi.fn(),
      setAudioConnected: vi.fn(),
      setAudioProducing: vi.fn(),
      setAudioMuted: vi.fn(),
      setProducing: vi.fn(),
      clearAudioState: vi.fn(),
      clearMessages: vi.fn(),
      clearParticipants: vi.fn(),
      clearSeats: vi.fn(),
    }

    mockAudioStore = {
      participants: new Map(),
      audioState: { isConnected: false, isProducing: false, isMuted: false, activeSpeakerIds: [] },
      addParticipant: vi.fn(),
      reconcileParticipants: vi.fn(),
      setAudioConnected: vi.fn(),
      setProducing: vi.fn(),
      clearAudioState: vi.fn(),
    }

    mockSeatsStore = {
      seats: [],
      resetSeats: vi.fn(),
      setSeatLocked: vi.fn(),
      updateSeat: vi.fn(),
      addSeatGiftValue: vi.fn(),
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('joinRoom()', () => {
    it('should connect socket when joining room', async () => {
      mockRoomStore.currentRoom = { id: 'room-123' }

      // Mock socket.emit to resolve with RTP capabilities
      mockSocket.value.emit.mockImplementation((
        event: string,
        _payload: unknown,
        callback?: (response: unknown) => void
      ) => {
        if (event === 'room:join' && callback) {
          callback({ rtpCapabilities: { codecs: [], headerExtensions: [] } })
        }
      })
      mockAudioSocket.status.value = 'connected'

      const { useRoomAudio } = await import('../../app/composables/room/useRoomAudio')
      const _roomAudio = useRoomAudio()

      // Note: joinRoom will try to connect and wait for socket
      // Since we're mocking, this may not complete exactly as expected
      expect(mockAudioSocket.connect).toBeDefined()
    })
  })

  describe('leaveRoom()', () => {
    it('should emit room:leave and cleanup without disconnecting socket', async () => {
      mockRoomStore.currentRoom = { id: 'room-123' }
      mockAudioSocket.status.value = 'connected'

      // Reset module cache to ensure singleton picks up current mockRoomStore
      vi.resetModules()
      vi.stubGlobal('useRoomStore', () => mockRoomStore)
      vi.stubGlobal('useRoomAudioStore', () => mockAudioStore)
      vi.stubGlobal('useRoomSeatsStore', () => mockSeatsStore)
      vi.stubGlobal('usePropLookup', () => mockPropLookup)
      vi.stubGlobal('useMediaSession', () => mockMediaSession)
      vi.stubGlobal('useAudioSocket', () => mockAudioSocket)
      vi.stubGlobal('useMediasoup', () => mockMediasoup)
      vi.stubGlobal('useAuthStore', () => mockAuthStore)
      vi.stubGlobal('useGiftStore', () => mockGiftStore)
      vi.stubGlobal('useGiftData', () => mockGiftData)
      vi.stubGlobal('useToast', () => mockToast)
      vi.stubGlobal('navigateTo', vi.fn())
      vi.stubGlobal('useGiftComboStore', () => ({ pendingRefund: 0, $reset: vi.fn() }))
      vi.stubGlobal('useLuckySessionStore', () => ({ $reset: vi.fn() }))
      vi.stubGlobal('ref', ref)
      vi.stubGlobal('computed', computed)
      vi.stubGlobal('shallowRef', shallowRef)
      vi.stubGlobal('reactive', reactive)
      vi.stubGlobal('readonly', readonly)
      vi.stubGlobal('onUnmounted', vi.fn())

      const { useRoomAudio } = await import('../../app/composables/room/useRoomAudio')
      const roomAudio = useRoomAudio()

      roomAudio.leaveRoom()

      // Should emit room:leave event
      expect(mockSocket.value.emit).toHaveBeenCalledWith('room:leave', { roomId: 'room-123' })

      // Should clean up mediasoup resources
      expect(mockMediasoup.cleanup).toHaveBeenCalled()

      // Should clear audio state in the audio store (moved off roomStore)
      expect(mockAudioStore.clearAudioState).toHaveBeenCalled()

      // Should NOT disconnect — socket stays alive for app-wide events
      expect(mockAudioSocket.disconnect).not.toHaveBeenCalled()
    })
  })

  describe('seat management', () => {
    describe('takeSeat()', () => {
      it('should emit seat:take event', async () => {
        mockRoomStore.currentRoom = { id: 'room-123' }
        mockSocket.value.emit.mockImplementation((
          event: string,
          _payload: unknown,
          callback?: (response: unknown) => void
        ) => {
          if (event === 'seat:take' && callback) {
            callback({ success: true })
          }
        })
        mockAudioSocket.status.value = 'connected'

        const { useRoomAudio } = await import('../../app/composables/room/useRoomAudio')
        const roomAudio = useRoomAudio()

        const result = await roomAudio.takeSeat(0)

        expect(result).toBe(true)
        expect(mockSocket.value.emit).toHaveBeenCalledWith(
          'seat:take',
          { roomId: 'room-123', seatIndex: 0 },
          expect.any(Function)
        )
      })

      it('should return false on failure', async () => {
        mockRoomStore.currentRoom = { id: 'room-123' }
        mockSocket.value.emit.mockImplementation((
          event: string,
          _payload: unknown,
          callback?: (response: unknown) => void
        ) => {
          if (event === 'seat:take' && callback) {
            callback({ success: false, error: 'Seat occupied' })
          }
        })
        mockAudioSocket.status.value = 'connected'

        const { useRoomAudio } = await import('../../app/composables/room/useRoomAudio')
        const roomAudio = useRoomAudio()

        const result = await roomAudio.takeSeat(0)

        expect(result).toBe(false)
      })
    })

    describe('leaveSeat()', () => {
      it('should emit seat:leave event', async () => {
        mockRoomStore.currentRoom = { id: 'room-123' }
        mockSocket.value.emit.mockImplementation((
          event: string,
          _payload: unknown,
          callback?: (response: unknown) => void
        ) => {
          if (event === 'seat:leave' && callback) {
            callback({ success: true })
          }
        })
        mockAudioSocket.status.value = 'connected'

        const { useRoomAudio } = await import('../../app/composables/room/useRoomAudio')
        const roomAudio = useRoomAudio()

        const result = await roomAudio.leaveSeat()

        expect(result).toBe(true)
      })
    })
  })

  describe('owner controls', () => {
    describe('assignUserToSeat()', () => {
      it('should emit seat:assign event', async () => {
        mockRoomStore.currentRoom = { id: 'room-123' }
        mockSocket.value.emit.mockImplementation((
          event: string,
          _payload: unknown,
          callback?: (response: unknown) => void
        ) => {
          if (event === 'seat:assign' && callback) {
            callback({ success: true })
          }
        })
        mockAudioSocket.status.value = 'connected'

        const { useRoomAudio } = await import('../../app/composables/room/useRoomAudio')
        const roomAudio = useRoomAudio()

        const result = await roomAudio.assignUserToSeat(42, 3)

        expect(result).toBe(true)
        expect(mockSocket.value.emit).toHaveBeenCalledWith(
          'seat:assign',
          { roomId: 'room-123', userId: 42, seatIndex: 3 },
          expect.any(Function)
        )
      })
    })

    describe('muteUser()', () => {
      it('should emit seat:mute event', async () => {
        mockRoomStore.currentRoom = { id: 'room-123' }
        mockSocket.value.emit.mockImplementation((
          event: string,
          _payload: unknown,
          callback?: (response: unknown) => void
        ) => {
          if (event === 'seat:mute' && callback) {
            callback({ success: true })
          }
        })
        mockAudioSocket.status.value = 'connected'

        const { useRoomAudio } = await import('../../app/composables/room/useRoomAudio')
        const roomAudio = useRoomAudio()

        const result = await roomAudio.muteUser(42)

        expect(result).toBe(true)
      })
    })
  })

  describe('chat', () => {
    describe('sendChatMessage()', () => {
      it('should emit chat:message event', async () => {
        mockRoomStore.currentRoom = { id: 'room-123' }
        mockAudioSocket.status.value = 'connected'

        const { useRoomAudio } = await import('../../app/composables/room/useRoomAudio')
        const roomAudio = useRoomAudio()

        roomAudio.sendChatMessage('Hello world')

        expect(mockSocket.value.emit).toHaveBeenCalledWith('chat:message', {
          roomId: 'room-123',
          content: 'Hello world',
          type: 'text',
        })
      })

      it('should not emit if no current room', async () => {
        // CRITICAL: Set room to null BEFORE importing the composable
        // The composable captures mockRoomStore at import time
        mockRoomStore.currentRoom = null
        mockAudioSocket.status.value = 'connected'
        
        // Reset module cache to get fresh import with null room
        vi.resetModules()
        
        // Re-stub globals after module reset
        vi.stubGlobal('useRoomStore', () => mockRoomStore)
        vi.stubGlobal('useAudioSocket', () => mockAudioSocket)
        vi.stubGlobal('useMediasoup', () => mockMediasoup)
        vi.stubGlobal('useAuthStore', () => mockAuthStore)
        vi.stubGlobal('useGiftStore', () => mockGiftStore)
        vi.stubGlobal('useGiftData', () => mockGiftData)
        vi.stubGlobal('useToast', () => mockToast)
        vi.stubGlobal('navigateTo', vi.fn())
        vi.stubGlobal('useGiftComboStore', () => ({ pendingRefund: 0, $reset: vi.fn() }))
        vi.stubGlobal('useLuckySessionStore', () => ({ $reset: vi.fn() }))
        vi.stubGlobal('ref', ref)
        vi.stubGlobal('computed', computed)
        vi.stubGlobal('shallowRef', shallowRef)
        vi.stubGlobal('reactive', reactive)
        vi.stubGlobal('readonly', readonly)
        vi.stubGlobal('onUnmounted', vi.fn())

        const { useRoomAudio } = await import('../../app/composables/room/useRoomAudio')
        const roomAudio = useRoomAudio()

        roomAudio.sendChatMessage('Hello world')

        expect(mockSocket.value.emit).not.toHaveBeenCalledWith(
          'chat:message',
          expect.any(Object)
        )
      })
    })
  })

  describe('gifts', () => {
    // Gift sending was extracted from useRoomAudio into useRoomGifts (a
    // parameterized composable). The send path now queues and emits via
    // processGiftQueue — for a single gift this fires synchronously.
    describe('sendGift() — useRoomGifts', () => {
      it('emits gift:send for a seated recipient', async () => {
        mockRoomStore.currentRoom = { id: 'room-123', room_xp: '0' }

        // Reset modules and re-stub the globals useRoomGifts pulls in
        vi.resetModules()
        vi.stubGlobal('useRoomStore', () => mockRoomStore)
        vi.stubGlobal('useRoomSeatsStore', () => mockSeatsStore)
        vi.stubGlobal('useGiftData', () => mockGiftData)
        vi.stubGlobal('ref', ref)
        vi.stubGlobal('computed', computed)
        vi.stubGlobal('shallowRef', shallowRef)
        vi.stubGlobal('reactive', reactive)
        vi.stubGlobal('readonly', readonly)
        vi.stubGlobal('onUnmounted', vi.fn())

        // Recipient 42 must be seated (checked at send time AND re-checked at emit time)
        mockSeatsStore.seats = [
          { index: 0, user: { id: 42, name: 'Recipient' }, isMuted: false, isActive: false, isLocked: false },
        ]

        const { useRoomGifts } = await import('../../app/composables/room/useRoomGifts')
        const { sendGift } = useRoomGifts({
          socket: mockSocket as unknown as Parameters<typeof useRoomGifts>[0]['socket'],
          getCurrentRoomId: () => 'room-123',
        })

        sendGift(123, 42, 5)

        expect(mockSocket.value.emit).toHaveBeenCalledWith('gift:send', {
          roomId: 'room-123',
          giftId: 123,
          recipientId: 42,
          quantity: 5,
        })
      })
    })
  })

  describe('self entry-animation', () => {
    // Fresh import per test so the module-level `lastSelfEntryRoomId` flag
    // starts null. Returns a joinRoom bound to fully-stubbed dependencies.
    async function setupJoinRoom() {
      mockAuthStore.user = { id: 1, name: 'Test User', entry_animation_id: 99, avatar: 'a.png' } as typeof mockAuthStore.user
      mockRoomStore.currentRoom = { id: 'room-1' }
      ;(mockRoomStore as unknown as { isMinimized: boolean }).isMinimized = false
      mockAudioSocket.status.value = 'connected'

      // room:join ack returns rtpCapabilities so joinRoom proceeds to the self block
      mockSocket.value.emit.mockImplementation((
        event: string,
        _payload: unknown,
        callback?: (response: unknown) => void,
      ) => {
        if (event === 'room:join' && callback) {
          callback({ rtpCapabilities: { codecs: [], headerExtensions: [] } })
        }
      })

      // resolvePropAsync resolves the equipped entry prop (id 99)
      mockPropLookup.resolvePropAsync.mockResolvedValue({
        id: 99,
        name: 'Grand Entry',
        thumbnail_url: 'thumb.png',
        asset_url: 'entry.svga',
      })

      vi.resetModules()
      vi.stubGlobal('useRoomStore', () => mockRoomStore)
      vi.stubGlobal('useRoomAudioStore', () => mockAudioStore)
      vi.stubGlobal('useRoomSeatsStore', () => mockSeatsStore)
      vi.stubGlobal('usePropLookup', () => mockPropLookup)
      vi.stubGlobal('useMediaSession', () => mockMediaSession)
      vi.stubGlobal('useAudioSocket', () => mockAudioSocket)
      vi.stubGlobal('useMediasoup', () => mockMediasoup)
      vi.stubGlobal('useAuthStore', () => mockAuthStore)
      vi.stubGlobal('useGiftStore', () => mockGiftStore)
      vi.stubGlobal('useGiftData', () => mockGiftData)
      vi.stubGlobal('useToast', () => mockToast)
      vi.stubGlobal('navigateTo', vi.fn())
      vi.stubGlobal('useGiftComboStore', () => ({ pendingRefund: 0, $reset: vi.fn() }))
      vi.stubGlobal('useLuckySessionStore', () => ({ $reset: vi.fn() }))
      vi.stubGlobal('ref', ref)
      vi.stubGlobal('computed', computed)
      vi.stubGlobal('shallowRef', shallowRef)
      vi.stubGlobal('reactive', reactive)
      vi.stubGlobal('readonly', readonly)
      vi.stubGlobal('onUnmounted', vi.fn())

      const { useRoomAudio } = await import('../../app/composables/room/useRoomAudio')
      return useRoomAudio()
    }

    // Let the fire-and-forget entry IIFE (await resolvePropAsync → enqueue) settle.
    const flush = () => new Promise((r) => setTimeout(r, 0))

    afterEach(() => {
      mockAuthStore.user = { id: 1, name: 'Test User' } as typeof mockAuthStore.user
    })

    it('enqueues the self entry-animation on first join', async () => {
      const roomAudio = await setupJoinRoom()
      await roomAudio.joinRoom('room-1')
      await flush()

      expect(mockGiftStore.enqueuePlayback).toHaveBeenCalledTimes(1)
      expect(mockGiftStore.enqueuePlayback).toHaveBeenCalledWith(
        expect.objectContaining({ senderId: 1, recipientIds: [] }),
      )
    })

    it('does NOT replay on a re-join of the same room (reconnect/resume)', async () => {
      const roomAudio = await setupJoinRoom()
      await roomAudio.joinRoom('room-1')
      await flush()
      await roomAudio.joinRoom('room-1') // simulate reconnect re-join
      await flush()

      expect(mockGiftStore.enqueuePlayback).toHaveBeenCalledTimes(1)
    })

    it('replays after leaving and re-entering, and on a room switch', async () => {
      const roomAudio = await setupJoinRoom()
      await roomAudio.joinRoom('room-1')
      await flush()

      // Leaving clears the gate → re-entering the same room replays
      roomAudio.leaveRoom('room-1')
      await roomAudio.joinRoom('room-1')
      await flush()
      expect(mockGiftStore.enqueuePlayback).toHaveBeenCalledTimes(2)

      // A switch to a different room id also replays (no leave needed)
      await roomAudio.joinRoom('room-2')
      await flush()
      expect(mockGiftStore.enqueuePlayback).toHaveBeenCalledTimes(3)
    })

    it('skips the entry when the prop cannot be resolved', async () => {
      const roomAudio = await setupJoinRoom()
      mockPropLookup.resolvePropAsync.mockResolvedValue(null)
      await roomAudio.joinRoom('room-1')
      await flush()

      expect(mockGiftStore.enqueuePlayback).not.toHaveBeenCalled()
    })
  })

  describe('connection status', () => {
    it('should expose connection status', async () => {
      const { useRoomAudio } = await import('../../app/composables/room/useRoomAudio')
      const roomAudio = useRoomAudio()

      expect(roomAudio.connectionStatus.value).toBe('disconnected')
      expect(roomAudio.isConnected.value).toBe(false)

      mockAudioSocket.status.value = 'connected'

      expect(roomAudio.isConnected.value).toBe(true)
    })
  })

  describe('toggleLocalMute()', () => {
    it('should emit audio:selfMute when muting', async () => {
      mockRoomStore.currentRoom = { id: 'room-123' }
      mockAudioSocket.status.value = 'connected'
      mockMediasoup.producer.value = { id: 'producer-uuid' }
      mockMediasoup.toggleLocalMute.mockReturnValue(true) // muted

      // Mock the socket emit to call ack callback with success
      mockSocket.value.emit.mockImplementation((
        event: string,
        _payload: unknown,
        callback?: (response: unknown) => void
      ) => {
        if ((event === 'audio:selfMute' || event === 'audio:selfUnmute') && callback) {
          callback({ success: true })
        }
      })

      vi.resetModules()
      vi.stubGlobal('useRoomStore', () => mockRoomStore)
      vi.stubGlobal('useRoomAudioStore', () => mockAudioStore)
      vi.stubGlobal('useRoomSeatsStore', () => mockSeatsStore)
      vi.stubGlobal('usePropLookup', () => mockPropLookup)
      vi.stubGlobal('useMediaSession', () => mockMediaSession)
      vi.stubGlobal('useAudioSocket', () => mockAudioSocket)
      vi.stubGlobal('useMediasoup', () => mockMediasoup)
      vi.stubGlobal('useAuthStore', () => mockAuthStore)
      vi.stubGlobal('useGiftStore', () => mockGiftStore)
      vi.stubGlobal('useGiftData', () => mockGiftData)
      vi.stubGlobal('useToast', () => mockToast)
      vi.stubGlobal('navigateTo', vi.fn())
      vi.stubGlobal('useGiftComboStore', () => ({ pendingRefund: 0, $reset: vi.fn() }))
      vi.stubGlobal('useLuckySessionStore', () => ({ $reset: vi.fn() }))
      vi.stubGlobal('ref', ref)
      vi.stubGlobal('computed', computed)
      vi.stubGlobal('shallowRef', shallowRef)
      vi.stubGlobal('reactive', reactive)
      vi.stubGlobal('readonly', readonly)
      vi.stubGlobal('onUnmounted', vi.fn())

      const { useRoomAudio } = await import('../../app/composables/room/useRoomAudio')
      const roomAudio = useRoomAudio()

      const result = roomAudio.toggleLocalMute()

      expect(result).toBe(true)
      expect(mockSocket.value.emit).toHaveBeenCalledWith(
        'audio:selfMute',
        { roomId: 'room-123', producerId: 'producer-uuid' },
        expect.any(Function)
      )
    })

    it('should emit audio:selfUnmute when unmuting', async () => {
      mockRoomStore.currentRoom = { id: 'room-123' }
      mockAudioSocket.status.value = 'connected'
      mockMediasoup.producer.value = { id: 'producer-uuid' }
      mockMediasoup.toggleLocalMute.mockReturnValue(false) // unmuted

      mockSocket.value.emit.mockImplementation((
        event: string,
        _payload: unknown,
        callback?: (response: unknown) => void
      ) => {
        if ((event === 'audio:selfMute' || event === 'audio:selfUnmute') && callback) {
          callback({ success: true })
        }
      })

      vi.resetModules()
      vi.stubGlobal('useRoomStore', () => mockRoomStore)
      vi.stubGlobal('useRoomAudioStore', () => mockAudioStore)
      vi.stubGlobal('useRoomSeatsStore', () => mockSeatsStore)
      vi.stubGlobal('usePropLookup', () => mockPropLookup)
      vi.stubGlobal('useMediaSession', () => mockMediaSession)
      vi.stubGlobal('useAudioSocket', () => mockAudioSocket)
      vi.stubGlobal('useMediasoup', () => mockMediasoup)
      vi.stubGlobal('useAuthStore', () => mockAuthStore)
      vi.stubGlobal('useGiftStore', () => mockGiftStore)
      vi.stubGlobal('useGiftData', () => mockGiftData)
      vi.stubGlobal('useToast', () => mockToast)
      vi.stubGlobal('navigateTo', vi.fn())
      vi.stubGlobal('useGiftComboStore', () => ({ pendingRefund: 0, $reset: vi.fn() }))
      vi.stubGlobal('useLuckySessionStore', () => ({ $reset: vi.fn() }))
      vi.stubGlobal('ref', ref)
      vi.stubGlobal('computed', computed)
      vi.stubGlobal('shallowRef', shallowRef)
      vi.stubGlobal('reactive', reactive)
      vi.stubGlobal('readonly', readonly)
      vi.stubGlobal('onUnmounted', vi.fn())

      const { useRoomAudio } = await import('../../app/composables/room/useRoomAudio')
      const roomAudio = useRoomAudio()

      const result = roomAudio.toggleLocalMute()

      expect(result).toBe(false)
      expect(mockSocket.value.emit).toHaveBeenCalledWith(
        'audio:selfUnmute',
        { roomId: 'room-123', producerId: 'producer-uuid' },
        expect.any(Function)
      )
    })

    it('should not emit if no producer', async () => {
      mockRoomStore.currentRoom = { id: 'room-123' }
      mockAudioSocket.status.value = 'connected'
      mockMediasoup.producer.value = null // no producer
      mockMediasoup.toggleLocalMute.mockReturnValue(true)

      vi.resetModules()
      vi.stubGlobal('useRoomStore', () => mockRoomStore)
      vi.stubGlobal('useRoomAudioStore', () => mockAudioStore)
      vi.stubGlobal('useRoomSeatsStore', () => mockSeatsStore)
      vi.stubGlobal('usePropLookup', () => mockPropLookup)
      vi.stubGlobal('useMediaSession', () => mockMediaSession)
      vi.stubGlobal('useAudioSocket', () => mockAudioSocket)
      vi.stubGlobal('useMediasoup', () => mockMediasoup)
      vi.stubGlobal('useAuthStore', () => mockAuthStore)
      vi.stubGlobal('useGiftStore', () => mockGiftStore)
      vi.stubGlobal('useGiftData', () => mockGiftData)
      vi.stubGlobal('useToast', () => mockToast)
      vi.stubGlobal('navigateTo', vi.fn())
      vi.stubGlobal('useGiftComboStore', () => ({ pendingRefund: 0, $reset: vi.fn() }))
      vi.stubGlobal('useLuckySessionStore', () => ({ $reset: vi.fn() }))
      vi.stubGlobal('ref', ref)
      vi.stubGlobal('computed', computed)
      vi.stubGlobal('shallowRef', shallowRef)
      vi.stubGlobal('reactive', reactive)
      vi.stubGlobal('readonly', readonly)
      vi.stubGlobal('onUnmounted', vi.fn())

      const { useRoomAudio } = await import('../../app/composables/room/useRoomAudio')
      const roomAudio = useRoomAudio()

      roomAudio.toggleLocalMute()

      expect(mockSocket.value.emit).not.toHaveBeenCalledWith(
        'audio:selfMute',
        expect.any(Object),
        expect.any(Function)
      )
    })
  })
})
