/**
 * Unit Tests for useAudioSocket Composable
 *
 * These tests mock Nuxt auto-imports and external dependencies to test
 * the socket connection logic in isolation.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref, computed, shallowRef } from 'vue'

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

// Mock useAuthStore - needs to be a function that returns the store
let mockAuthStore = { token: null as string | null }
vi.stubGlobal('useAuthStore', () => mockAuthStore)

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
    mockAuthStore = { token: null }
    
    // Re-stub all globals after module reset
    vi.stubGlobal('useRuntimeConfig', () => mockRuntimeConfig)
    vi.stubGlobal('useToast', () => mockToast)
    vi.stubGlobal('onUnmounted', vi.fn())
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('shallowRef', shallowRef)
    vi.stubGlobal('useAuthStore', () => mockAuthStore)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('connect()', () => {
    it('should fail if no auth token', async () => {
      mockAuthStore.token = null

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect, status, error } = useAudioSocket()
      connect()

      expect(error.value).toBe('Authentication required')
      expect(status.value).toBe('error')
    })

    it('should set status to connecting with valid auth token', async () => {
      mockAuthStore.token = 'valid-token'

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect, status } = useAudioSocket()
      connect()

      expect(status.value).toBe('connecting')
    })

    it('should register all event handlers', async () => {
      mockAuthStore.token = 'valid-token'

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect } = useAudioSocket()
      connect()

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
      mockAuthStore.token = 'valid-token'

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect, disconnect, status } = useAudioSocket()
      connect()
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
      mockAuthStore.token = 'valid-token'

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect, status, error } = useAudioSocket()
      connect()

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
      mockAuthStore.token = 'valid-token'

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect, status } = useAudioSocket()
      connect()

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
      mockAuthStore.token = 'valid-token'

      const { useAudioSocket } = await import('../../app/composables/room/useAudioSocket')
      const { connect, status, error } = useAudioSocket()
      connect()

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
})
