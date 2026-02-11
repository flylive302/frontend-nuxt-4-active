/**
 * Unit Tests for useMediasoup Composable
 *
 * These tests mock Nuxt auto-imports and external dependencies to test
 * the mediasoup device and transport logic in isolation.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ref, shallowRef, computed } from 'vue'

// ============================================
// Mock External Dependencies
// ============================================

// Mock mediasoup-client Device
const mockDevice = {
  loaded: false,
  canProduce: vi.fn(() => true),
  load: vi.fn().mockResolvedValue(undefined),
  rtpCapabilities: { codecs: [], headerExtensions: [] },
}

vi.mock('mediasoup-client', () => ({
  Device: vi.fn().mockImplementation(() => mockDevice),
}))

// ============================================
// Mock Nuxt Auto-imports
// ============================================

vi.stubGlobal('ref', ref)
vi.stubGlobal('shallowRef', shallowRef)
vi.stubGlobal('computed', computed)
vi.stubGlobal('onUnmounted', vi.fn())

// Mock navigator.mediaDevices
const mockMediaStream = {
  getAudioTracks: () => [{ kind: 'audio', stop: vi.fn() }],
}

Object.defineProperty(global, 'navigator', {
  value: {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
    },
  },
  writable: true,
})

// Mock Audio element
vi.stubGlobal('Audio', vi.fn().mockImplementation(() => ({
  srcObject: null,
  play: vi.fn().mockResolvedValue(undefined),
})))

// Mock RTCPeerConnection (not available in Node)
vi.stubGlobal('RTCPeerConnection', vi.fn().mockImplementation(() => ({
  createOffer: vi.fn(),
  createAnswer: vi.fn(),
  setLocalDescription: vi.fn(),
  setRemoteDescription: vi.fn(),
  addTrack: vi.fn(),
  getReceivers: vi.fn(() => []),
  getSenders: vi.fn(() => []),
  close: vi.fn(),
})))

// ============================================
// Tests
// ============================================

describe('useMediasoup', () => {
  const mockSocket = ref({
    emit: vi.fn((event: string, payload: unknown, callback?: (response: unknown) => void) => {
      // Simulate server responses (MSAB wrapped format)
      if (callback) {
        if (event === 'transport:create') {
          callback({
            success: true,
            data: {
              id: 'transport-123',
              iceParameters: {},
              iceCandidates: [],
              dtlsParameters: {},
            },
          })
        } else if (event === 'transport:connect') {
          callback({ success: true })
        } else if (event === 'audio:produce') {
          callback({ success: true, data: { id: 'producer-123' } })
        } else if (event === 'audio:consume') {
          callback({
            success: true,
            data: {
              id: 'consumer-123',
              producerId: 'producer-456',
              kind: 'audio',
              rtpParameters: {},
            },
          })
        } else if (event === 'consumer:resume') {
          callback({ success: true })
        }
      }
    }),
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockDevice.loaded = false
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('device state', () => {
    it('should have initial state as null', async () => {
      const { useMediasoup } = await import('../../app/composables/useMediasoup')
      const mediasoup = useMediasoup(mockSocket as unknown as Parameters<typeof useMediasoup>[0])

      expect(mediasoup.device.value).toBeNull()
      expect(mediasoup.producer.value).toBeNull()
      expect(mediasoup.isProducing.value).toBe(false)
    })
  })

  describe('loadDevice()', () => {
    it('should create device and load RTP capabilities', async () => {
      const { useMediasoup } = await import('../../app/composables/useMediasoup')
      const mediasoup = useMediasoup(mockSocket as unknown as Parameters<typeof useMediasoup>[0])

      const rtpCapabilities = {
        codecs: [{ mimeType: 'audio/opus' }],
        headerExtensions: [],
      }

      await mediasoup.loadDevice(rtpCapabilities as unknown as Parameters<typeof mediasoup.loadDevice>[0])

      expect(mockDevice.load).toHaveBeenCalledWith({
        routerRtpCapabilities: rtpCapabilities,
      })
    })
  })

  describe('cleanup()', () => {
    it('should clean up all resources', async () => {
      const { useMediasoup } = await import('../../app/composables/useMediasoup')
      const mediasoup = useMediasoup(mockSocket as unknown as Parameters<typeof useMediasoup>[0])

      // Setup some state
      await mediasoup.loadDevice({ codecs: [], headerExtensions: [] } as Parameters<typeof mediasoup.loadDevice>[0])
      mediasoup.cleanup()

      // Should reset state
      expect(mediasoup.device.value).toBeNull()
      expect(mediasoup.producer.value).toBeNull()
    })
  })

  describe('audio production', () => {
    it('should check device is loaded before starting audio', async () => {
      const { useMediasoup } = await import('../../app/composables/useMediasoup')
      const mediasoup = useMediasoup(mockSocket as unknown as Parameters<typeof useMediasoup>[0])

      // Try to start audio without loading device - should throw
      await expect(mediasoup.startAudio()).rejects.toThrow()
    })
  })

  describe('stopAudio()', () => {
    it('should be callable when no producer', async () => {
      const { useMediasoup } = await import('../../app/composables/useMediasoup')
      const mediasoup = useMediasoup(mockSocket as unknown as Parameters<typeof useMediasoup>[0])

      // Should not throw
      expect(() => mediasoup.stopAudio()).not.toThrow()
    })
  })

  describe('consumer management', () => {
    it('should track consumers in map', async () => {
      const { useMediasoup } = await import('../../app/composables/useMediasoup')
      const mediasoup = useMediasoup(mockSocket as unknown as Parameters<typeof useMediasoup>[0])

      expect(mediasoup.consumers.value.size).toBe(0)
    })

    it('should stop consumer by producer id', async () => {
      const { useMediasoup } = await import('../../app/composables/useMediasoup')
      const mediasoup = useMediasoup(mockSocket as unknown as Parameters<typeof useMediasoup>[0])

      // Should not throw when consumer doesn't exist
      expect(() => mediasoup.stopConsumer('non-existent')).not.toThrow()
    })
  })
})
