/**
 * Unit tests for per-source consumer tracking in useMediasoupStreaming
 * (dj-talk-over slice 01 — see docs/issues/dj-talk-over/01-producer-source-identity.md).
 *
 * The composite key `${userId}:${source}` must let a user's mic and music
 * consumers coexist, while preserving the reconnect self-heal *per source*:
 * a fresh mic producer displaces only the stale mic consumer for that user,
 * never their music consumer (and vice versa).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref, computed } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { setupNuxtMocks, cleanupNuxtMocks, createMockAuthStore } from '../helpers/nuxtMocks'

// ============================================
// Mock Nuxt auto-imports used by the streaming composable
// ============================================
vi.stubGlobal('computed', computed)
vi.stubGlobal('onUnmounted', vi.fn())
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

// Mock Audio element and MediaStream (jsdom-free node test environment)
vi.stubGlobal('Audio', vi.fn().mockImplementation(() => ({
  srcObject: null,
  volume: 1,
  autoplay: false,
  setAttribute: vi.fn(),
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  remove: vi.fn(),
})))
vi.stubGlobal('MediaStream', vi.fn().mockImplementation((tracks: unknown[]) => ({ tracks })))

// ============================================
// Test helpers
// ============================================

type StubConsumer = {
  id: string
  producerId: string
  track: { kind: 'audio' }
  closed: boolean
  close: () => void
  on: (event: string, cb: () => void) => void
  _emitTransportClose: () => void
}

function makeStubConsumer(id: string, producerId: string): StubConsumer {
  let transportCloseCb: (() => void) | null = null
  const stub: StubConsumer = {
    id,
    producerId,
    track: { kind: 'audio' },
    closed: false,
    close: vi.fn(() => { stub.closed = true }),
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'transportclose') transportCloseCb = cb
    }),
    _emitTransportClose: () => transportCloseCb?.(),
  }
  return stub
}

function makeMockSocket() {
  return ref({
    once: vi.fn(),
    off: vi.fn(),
    emit: vi.fn((event: string, payload: unknown, callback?: (response: unknown) => void) => {
      if (!callback) return
      if (event === 'audio:consume') {
        const p = payload as { producerId: string }
        callback({
          success: true,
          data: {
            id: `consumer-for-${p.producerId}`,
            producerId: p.producerId,
            kind: 'audio',
            rtpParameters: {},
          },
        })
      } else if (event === 'consumer:resume') {
        callback({ success: true })
      }
    }),
  })
}

describe('useMediasoupStreaming — per-(userId, source) consumer tracking', () => {
  const AUTH_USER_ID = 1
  const DJ_USER_ID = 42

  let mockSocket: ReturnType<typeof makeMockSocket>
  let consumeSpy: ReturnType<typeof vi.fn>
  let issuedConsumers: Map<string, StubConsumer>

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    setupNuxtMocks({ authStore: createMockAuthStore({ user: { id: AUTH_USER_ID } }) })

    issuedConsumers = new Map()
    consumeSpy = vi.fn(async ({ id, producerId }: { id: string; producerId: string }) => {
      const consumer = makeStubConsumer(id, producerId)
      issuedConsumers.set(producerId, consumer)
      return consumer
    })

    mockSocket = makeMockSocket()

    // Wire the module-singleton device/transport refs directly (they are
    // shared shallowRefs returned as-is by the composables — no vi.mock
    // gymnastics needed).
    const { device } = await import('../../app/composables/mediasoup/useMediasoupDevice').then(m => m.useMediasoupDevice())
    device.value = { loaded: true, rtpCapabilities: {} } as unknown as typeof device.value

    const { consumerTransport } = await import('../../app/composables/mediasoup/useMediasoupTransports').then(m => m.useMediasoupTransports(mockSocket as never))
    consumerTransport.value = {
      id: 'consumer-transport-1',
      consume: consumeSpy,
    } as unknown as typeof consumerTransport.value
  })

  afterEach(() => {
    cleanupNuxtMocks()
    vi.clearAllMocks()
  })

  it('mic and music consumers for the same user coexist under distinct composite keys', async () => {
    const { useMediasoupStreaming } = await import('../../app/composables/mediasoup/useMediasoupStreaming')
    const streaming = useMediasoupStreaming(mockSocket as never)

    await streaming.consumeProducer('producer-mic', 'room-1', DJ_USER_ID, 'mic')
    await streaming.consumeProducer('producer-music', 'room-1', DJ_USER_ID, 'music')

    expect(streaming.consumers.value.has('producer-mic')).toBe(true)
    expect(streaming.consumers.value.has('producer-music')).toBe(true)
    expect(streaming.consumers.value.size).toBe(2)
  })

  it('a fresh mic producer displaces only the stale mic consumer, leaving music untouched', async () => {
    const { useMediasoupStreaming } = await import('../../app/composables/mediasoup/useMediasoupStreaming')
    const streaming = useMediasoupStreaming(mockSocket as never)

    await streaming.consumeProducer('producer-mic-old', 'room-1', DJ_USER_ID, 'mic')
    await streaming.consumeProducer('producer-music', 'room-1', DJ_USER_ID, 'music')

    // DJ reconnects: server announces a fresh mic producer for the same user.
    await streaming.consumeProducer('producer-mic-new', 'room-1', DJ_USER_ID, 'mic')

    expect(streaming.consumers.value.has('producer-mic-old')).toBe(false)
    expect(streaming.consumers.value.has('producer-mic-new')).toBe(true)
    // The music consumer must never be touched by a mic-source displacement.
    expect(streaming.consumers.value.has('producer-music')).toBe(true)
    expect(issuedConsumers.get('producer-mic-old')?.closed).toBe(true)
    expect(issuedConsumers.get('producer-music')?.closed).toBe(false)
  })

  it('a fresh music producer displaces only the stale music consumer, leaving mic untouched', async () => {
    const { useMediasoupStreaming } = await import('../../app/composables/mediasoup/useMediasoupStreaming')
    const streaming = useMediasoupStreaming(mockSocket as never)

    await streaming.consumeProducer('producer-mic', 'room-1', DJ_USER_ID, 'mic')
    await streaming.consumeProducer('producer-music-old', 'room-1', DJ_USER_ID, 'music')

    await streaming.consumeProducer('producer-music-new', 'room-1', DJ_USER_ID, 'music')

    expect(streaming.consumers.value.has('producer-music-old')).toBe(false)
    expect(streaming.consumers.value.has('producer-music-new')).toBe(true)
    expect(streaming.consumers.value.has('producer-mic')).toBe(true)
    expect(issuedConsumers.get('producer-music-old')?.closed).toBe(true)
    expect(issuedConsumers.get('producer-mic')?.closed).toBe(false)
  })

  it('producer-closed teardown removes only its own consumer, not other sources for the same user', async () => {
    const { useMediasoupStreaming } = await import('../../app/composables/mediasoup/useMediasoupStreaming')
    const streaming = useMediasoupStreaming(mockSocket as never)

    await streaming.consumeProducer('producer-mic', 'room-1', DJ_USER_ID, 'mic')
    await streaming.consumeProducer('producer-music', 'room-1', DJ_USER_ID, 'music')

    streaming.stopConsumer('producer-mic')

    expect(streaming.consumers.value.has('producer-mic')).toBe(false)
    expect(streaming.consumers.value.has('producer-music')).toBe(true)
  })

  it('a subsequent mic producer for the same user is treated as a fresh displacement even after teardown via transportclose', async () => {
    const { useMediasoupStreaming } = await import('../../app/composables/mediasoup/useMediasoupStreaming')
    const streaming = useMediasoupStreaming(mockSocket as never)

    await streaming.consumeProducer('producer-mic-1', 'room-1', DJ_USER_ID, 'mic')
    await streaming.consumeProducer('producer-music', 'room-1', DJ_USER_ID, 'music')

    // Server tells us the mic producer's underlying transport closed.
    issuedConsumers.get('producer-mic-1')?._emitTransportClose()

    expect(streaming.consumers.value.has('producer-mic-1')).toBe(false)
    expect(streaming.consumers.value.has('producer-music')).toBe(true)

    // A new mic producer for the same user consumes cleanly (no stale key left behind).
    await streaming.consumeProducer('producer-mic-2', 'room-1', DJ_USER_ID, 'mic')
    expect(streaming.consumers.value.has('producer-mic-2')).toBe(true)
    expect(streaming.consumers.value.has('producer-music')).toBe(true)
  })

  it('audio:newProducer / catch-up entries without `source` are consumed as mic (compat)', async () => {
    const { useMediasoupStreaming } = await import('../../app/composables/mediasoup/useMediasoupStreaming')
    const streaming = useMediasoupStreaming(mockSocket as never)

    // Simulates the pre-feature wire shape: no `source` argument at all —
    // the default parameter must resolve it to 'mic'.
    await streaming.consumeProducer('producer-legacy', 'room-1', DJ_USER_ID)

    // A real music producer for the same user must still be tracked
    // independently (not collide with the compat-mic entry).
    await streaming.consumeProducer('producer-music', 'room-1', DJ_USER_ID, 'music')

    expect(streaming.consumers.value.has('producer-legacy')).toBe(true)
    expect(streaming.consumers.value.has('producer-music')).toBe(true)

    // And a subsequent explicit mic producer displaces the compat entry
    // (proving it was tracked under the 'mic' key, not left unkeyed).
    await streaming.consumeProducer('producer-mic-explicit', 'room-1', DJ_USER_ID, 'mic')
    expect(streaming.consumers.value.has('producer-legacy')).toBe(false)
    expect(streaming.consumers.value.has('producer-mic-explicit')).toBe(true)
    expect(streaming.consumers.value.has('producer-music')).toBe(true)
  })
})
