/**
 * Unit Tests for useAudioSocket Composable
 *
 * These tests mock Nuxt auto-imports and external dependencies to test
 * the socket connection logic in isolation.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref, computed, shallowRef, reactive, readonly, watch } from 'vue'

// ============================================
// Mock External Dependencies
// ============================================

// Mock socket.io-client
const mockSocket = {
  id: 'test-socket-id',
  connected: false,
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  removeAllListeners: vi.fn(),
  io: {
    on: vi.fn(),
    off: vi.fn(),
  },
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}))

// Mock useRealtimeEvents to prevent cascade into real Pinia stores
vi.mock('../../app/composables/room/useRealtimeEvents', () => ({
  useRealtimeEvents: vi.fn(() => ({
    registerRealtimeEventHandlers: vi.fn(),
    resetRealtimeHandlers: vi.fn(),
  })),
  resetRealtimeHandlers: vi.fn(),
}))

// ============================================
// Mock Nuxt Auto-imports
// ============================================

// Mock useRuntimeConfig
const mockRuntimeConfig = {
  public: {
    audioServerUrl: 'ws://localhost:3030',
  },
}
vi.stubGlobal('useRuntimeConfig', () => mockRuntimeConfig)

// Mock useToast
const mockToast = { add: vi.fn() }
vi.stubGlobal('useToast', () => mockToast)

// Mock onUnmounted lifecycle hook
vi.stubGlobal('onUnmounted', vi.fn())

// Mock Vue reactivity functions (auto-imported by Nuxt)
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('shallowRef', shallowRef)
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('watch', watch)

// Mock useApi (auto-imported by Nuxt)
const mockApi = { api: vi.fn().mockResolvedValue(null) }
vi.stubGlobal('useApi', () => mockApi)

// Mock useAuthStore - needs to be a function that returns the store
let mockAuthStore = { token: null as string | null, msabToken: null as string | null }
vi.stubGlobal('useAuthStore', () => mockAuthStore)

// Mock useAuthActions (connect() calls refreshMsabToken when no MSAB token)
const mockAuthActions = { refreshMsabToken: vi.fn().mockResolvedValue(false) }
vi.stubGlobal('useAuthActions', () => mockAuthActions)

// Mock useAuthLifecycle (connect() wires the force-disconnect handler)
const mockAuthLifecycle = { handleForceDisconnect: vi.fn() }
vi.stubGlobal('useAuthLifecycle', () => mockAuthLifecycle)

// Mock useUserSync (handleReconnect re-syncs the user to self-heal missed events)
const mockUserSync = { syncUser: vi.fn().mockResolvedValue(undefined) }
vi.stubGlobal('useUserSync', () => mockUserSync)

// Mock useInboxReconcile (handleConnect reconciles inbox on every re-connect)
const mockInboxReconcile = { reconcileInbox: vi.fn().mockResolvedValue(undefined) }
vi.stubGlobal('useInboxReconcile', () => mockInboxReconcile)

// ============================================
// Tests
// ============================================

describe('useAudioSocket', () => {
  beforeEach(() => {
    // CRITICAL: Reset module cache to clear singleton state in the composable
    vi.resetModules()
    
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockSocket.connected = false
    mockAuthStore = { token: null, msabToken: null }
    
    // Re-stub all globals after module reset
    vi.stubGlobal('useRuntimeConfig', () => mockRuntimeConfig)
    vi.stubGlobal('useToast', () => mockToast)
    vi.stubGlobal('onUnmounted', vi.fn())
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('shallowRef', shallowRef)
    vi.stubGlobal('reactive', reactive)
    vi.stubGlobal('readonly', readonly)
    vi.stubGlobal('watch', watch)
    vi.stubGlobal('useAuthStore', () => mockAuthStore)
    vi.stubGlobal('useApi', () => mockApi)
    vi.stubGlobal('useAuthActions', () => mockAuthActions)
    vi.stubGlobal('useAuthLifecycle', () => mockAuthLifecycle)
    vi.stubGlobal('useUserSync', () => mockUserSync)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('connect()', () => {
    it('should fail if no auth token', async () => {
      mockAuthStore.msabToken = null

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect, status, error } = useAudioSocket()
      await connect()

      expect(error.value).toBe('No audio token available')
      expect(status.value).toBe('error')
    })

    it('should set status to connecting with valid auth token', async () => {
      mockAuthStore.msabToken = 'valid-token'

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect, status } = useAudioSocket()
      await connect()

      expect(status.value).toBe('connecting')
    })

    it('should register all event handlers', async () => {
      mockAuthStore.msabToken = 'valid-token'

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect } = useAudioSocket()
      await connect()

      // Check that handlers were registered
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockSocket.io.on).toHaveBeenCalledWith('reconnect_attempt', expect.any(Function))
      expect(mockSocket.io.on).toHaveBeenCalledWith('reconnect', expect.any(Function))
    })
  })

  describe('disconnect()', () => {
    it('should disconnect and cleanup', async () => {
      mockAuthStore.msabToken = 'valid-token'

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect, disconnect, status } = useAudioSocket()
      await connect()
      disconnect()

      expect(mockSocket.removeAllListeners).toHaveBeenCalled()
      expect(mockSocket.disconnect).toHaveBeenCalled()
      expect(status.value).toBe('disconnected')
    })

    it('should handle disconnect when not connected', async () => {
      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { disconnect, status } = useAudioSocket()
      disconnect()

      expect(status.value).toBe('disconnected')
    })
  })

  describe('connection status', () => {
    it('should have initial status as disconnected', async () => {
      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { status, isConnected } = useAudioSocket()

      expect(status.value).toBe('disconnected')
      expect(isConnected.value).toBe(false)
    })
  })

  describe('event handlers', () => {
    it('should update status on connect handler', async () => {
      mockAuthStore.msabToken = 'valid-token'

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect, status, error } = useAudioSocket()
      await connect()

      // Get the connect handler and call it
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'connect'
      )?.[1] as (() => void) | undefined

      if (connectHandler) {
        connectHandler()
        expect(status.value).toBe('connected')
        expect(error.value).toBeNull()
      }
    })

    it('should handle disconnect event', async () => {
      mockAuthStore.msabToken = 'valid-token'

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect, status } = useAudioSocket()
      await connect()

      // Get the disconnect handler and call it
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'disconnect'
      )?.[1] as ((reason: string) => void) | undefined

      if (disconnectHandler) {
        disconnectHandler('io client disconnect')
        expect(status.value).toBe('disconnected')
      }
    })

    it('should handle connect_error event', async () => {
      mockAuthStore.msabToken = 'valid-token'

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect, status, error } = useAudioSocket()
      await connect()

      // Get the connect_error handler and call it
      const errorHandler = mockSocket.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'connect_error'
      )?.[1] as ((err: Error) => void) | undefined

      if (errorHandler) {
        errorHandler(new Error('Connection refused'))
        expect(status.value).toBe('error')
        expect(error.value).toBe('Connection refused')
      }
    })
  })

  describe('reconnect_failed handling (realtime-13 / M8)', () => {
    it('delegates recovery to the registered onReconnectFailed callback without toasting', async () => {
      mockAuthStore.msabToken = 'valid-token'

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect, onReconnectFailed, status } = useAudioSocket()
      await connect()

      const cb = vi.fn()
      onReconnectFailed(cb)

      const handler = mockSocket.io.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'reconnect_failed'
      )?.[1] as (() => void) | undefined

      expect(handler).toBeDefined()
      handler?.()

      expect(cb).toHaveBeenCalledTimes(1)
      expect(status.value).toBe('error')
      expect(mockToast.add).not.toHaveBeenCalled()
    })

    it('falls back to a toast when no recovery owner is registered', async () => {
      mockAuthStore.msabToken = 'valid-token'

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect, status } = useAudioSocket()
      await connect()

      const handler = mockSocket.io.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'reconnect_failed'
      )?.[1] as (() => void) | undefined

      expect(handler).toBeDefined()
      handler?.()

      expect(status.value).toBe('error')
      expect(mockToast.add).toHaveBeenCalled()
    })
  })

  describe('user re-sync on reconnect (self-heal missed events)', () => {
    it('skips the first connect (bootstrap owns it) but re-fetches on every re-connect', async () => {
      mockAuthStore.msabToken = 'valid-token'

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect } = useAudioSocket()
      await connect()

      const connectHandler = mockSocket.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'connect'
      )?.[1] as (() => void) | undefined
      expect(connectHandler).toBeDefined()

      // First connect after boot: bootstrap already hydrated the user → no sync.
      connectHandler?.()
      expect(mockUserSync.syncUser).not.toHaveBeenCalled()
      expect(mockInboxReconcile.reconcileInbox).not.toHaveBeenCalled()

      // Every subsequent (re)connect — auto-reconnect, post-failure rebuild, or
      // PWA-resume all land on `connect` — self-heals via a fresh fetch, and
      // reconciles the inbox (issue 03, dm-realtime-platform).
      connectHandler?.()
      expect(mockUserSync.syncUser).toHaveBeenCalledTimes(1)
      expect(mockInboxReconcile.reconcileInbox).toHaveBeenCalledTimes(1)
      expect(mockInboxReconcile.reconcileInbox).toHaveBeenCalledWith('socket-reconnect')

      connectHandler?.()
      expect(mockUserSync.syncUser).toHaveBeenCalledTimes(2)
      expect(mockInboxReconcile.reconcileInbox).toHaveBeenCalledTimes(2)
    })
  })

  describe('connect(targetUrl) — regional routing', () => {
    it('should connect to the specified URL instead of config URL', async () => {
      mockAuthStore.msabToken = 'valid-token'
      const { io: mockIo } = await import('socket.io-client')

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect, status } = useAudioSocket()
      await connect('wss://mumbai.audio.flyliveapp.com')

      expect(status.value).toBe('connecting')
      expect(mockIo).toHaveBeenCalledWith('wss://mumbai.audio.flyliveapp.com', expect.any(Object))
    })

    it('should skip if already connected to the same URL', async () => {
      mockAuthStore.msabToken = 'valid-token'
      const { io: mockIo } = await import('socket.io-client')

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect } = useAudioSocket()

      // First connect
      await connect('wss://mumbai.audio.flyliveapp.com')
      mockSocket.connected = true

      // Second connect to same URL — should skip
      await connect('wss://mumbai.audio.flyliveapp.com')
      expect(mockIo).toHaveBeenCalledTimes(1)
    })

    it('should force-reconnect when connected to a different URL', async () => {
      mockAuthStore.msabToken = 'valid-token'
      const { io: mockIo } = await import('socket.io-client')

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect } = useAudioSocket()

      // First connect to Mumbai
      await connect('wss://mumbai.audio.flyliveapp.com')
      mockSocket.connected = true

      // Second connect to Frankfurt — should force-reconnect
      await connect('wss://frankfurt.audio.flyliveapp.com')
      expect(mockIo).toHaveBeenCalledTimes(2)
      expect(mockSocket.removeAllListeners).toHaveBeenCalled()
      expect(mockSocket.disconnect).toHaveBeenCalled()
    })

    it('should reset realtime handlers on teardown for URL change', async () => {
      mockAuthStore.msabToken = 'valid-token'
      const { resetRealtimeHandlers } = await import('../../app/composables/room/useRealtimeEvents')

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect } = useAudioSocket()

      // First connect
      await connect('wss://mumbai.audio.flyliveapp.com')
      mockSocket.connected = true

      // Force-reconnect to different URL
      await connect('wss://frankfurt.audio.flyliveapp.com')
      expect(resetRealtimeHandlers).toHaveBeenCalled()
    })

    it('should fall back to config URL when no targetUrl provided', async () => {
      mockAuthStore.msabToken = 'valid-token'
      const { io: mockIo } = await import('socket.io-client')

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect } = useAudioSocket()
      await connect()

      expect(mockIo).toHaveBeenCalledWith('ws://localhost:3030', expect.any(Object))
    })
  })

  // ticket 10: the handshake carries a correlation identifier so a client-side
  // action can be joined to MSAB's server-side logs.
  describe('correlation id on the handshake (ticket 10)', () => {
    /** Pulls the auth payload sent to the server by invoking socket.io's dynamic auth callback. */
    async function capturedAuthPayload(): Promise<{ token: string | null; correlationId: string }> {
      const { io: mockIo } = await import('socket.io-client')
      const lastCall = vi.mocked(mockIo).mock.calls.at(-1)!
      const authOption = (lastCall[1] as { auth: (cb: (data: { token: string | null; correlationId: string }) => void) => void }).auth
      let captured!: { token: string | null; correlationId: string }
      authOption((data) => { captured = data })
      return captured
    }

    it('sends a correlation id alongside the token, matching the MSAB charset contract', async () => {
      mockAuthStore.msabToken = 'valid-token'

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect } = useAudioSocket()
      await connect()

      const payload = await capturedAuthPayload()
      expect(payload.token).toBe('valid-token')
      // Mirrors MSAB's resolveCorrelationId contract exactly: ≤128 chars, [A-Za-z0-9._:-].
      // A base64 id (with '/' or '+') would fail this and get silently discarded server-side.
      expect(payload.correlationId).toMatch(/^[A-Za-z0-9._:-]{1,128}$/)
    })

    it('re-supplies the SAME id across automatic reconnect attempts (AC#5)', async () => {
      mockAuthStore.msabToken = 'valid-token'

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect } = useAudioSocket()
      await connect()

      // Socket.IO re-invokes the dynamic `auth` callback on every reconnect
      // attempt without a new connect() call — the token may rotate, but the
      // correlation id must not, or the reconnect can't be joined to the
      // original session in the server logs.
      const first = await capturedAuthPayload()
      mockAuthStore.msabToken = 'rotated-token'
      const second = await capturedAuthPayload()

      expect(second.token).toBe('rotated-token')
      expect(second.correlationId).toBe(first.correlationId)
    })

    it('mints a NEW id on a fresh connect() — a genuinely new logical session', async () => {
      mockAuthStore.msabToken = 'valid-token'

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect } = useAudioSocket()

      await connect('wss://mumbai.audio.flyliveapp.com')
      const first = await capturedAuthPayload()

      mockSocket.connected = true
      await connect('wss://frankfurt.audio.flyliveapp.com')
      const second = await capturedAuthPayload()

      expect(second.correlationId).not.toBe(first.correlationId)
    })
  })
})
