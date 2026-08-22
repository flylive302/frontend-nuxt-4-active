/**
 * Concurrency tests for useMediasoupStreaming's single-flight guards
 * (see docs/pending-issues/audio-pipe-observability/15-prodbug-headphone-voice-doubling.md).
 *
 * Both `startAudio()` and `consumeProducer()` used to check "do I already have
 * one?" and only write the answer several awaits later. Two callers that passed
 * the check together each built a producer / consumer, and the second write
 * overwrote the first — orphaning a live stream that kept playing and was no
 * longer reachable by `stopAudio()` / `stopConsumer()`. Heard as doubled voice.
 *
 * 🔴 Every test here starts both calls WITHOUT awaiting the first. A test that
 * awaits call #1 before call #2 exercises the plain map check and proves
 * nothing about the race.
 *
 * The rejection tests matter as much as the dedup ones: an early-returning
 * guard would make a concurrent caller skip the work believing it was handled,
 * so a failed first call would leave that producer permanently unheard —
 * trading doubled audio for silence. Callers must share the rejection.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref, computed } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { setupNuxtMocks, cleanupNuxtMocks, createMockAuthStore } from '../helpers/nuxtMocks'

vi.stubGlobal('computed', computed)
vi.stubGlobal('onUnmounted', vi.fn())
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

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

/** A promise whose settlement the test controls, so two callers overlap for real. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Value-less variant of `deferred` — a latch the test opens when it chooses. */
function openableGate() {
  let open!: () => void
  const opened = new Promise<void>((resolve) => {
    open = () => resolve()
  })
  return { opened, open }
}

function makeStubConsumer(id: string, producerId: string) {
  return {
    id,
    producerId,
    track: { kind: 'audio' },
    closed: false,
    close: vi.fn(),
    on: vi.fn(),
  }
}

/**
 * Socket whose `audio:consume` reply is held open until the test releases it.
 * `consumer:resume` answers immediately — the window under test opens at
 * `audio:consume` and closes when the consumer is recorded.
 */
function makeGatedSocket() {
  const gate = openableGate()
  let consumeCalls = 0

  const socket = ref({
    once: vi.fn(),
    off: vi.fn(),
    emit: vi.fn((event: string, payload: unknown, callback?: (response: unknown) => void) => {
      if (!callback) return

      if (event === 'audio:consume') {
        consumeCalls += 1
        const { producerId } = payload as { producerId: string }
        void gate.opened.then(() => {
          callback({
            success: true,
            data: { id: `consumer-for-${producerId}`, producerId, kind: 'audio', rtpParameters: {} },
          })
        })
      }
      else if (event === 'consumer:resume') {
        callback({ success: true })
      }
    }),
  })

  return { socket, release: gate.open, consumeCalls: () => consumeCalls }
}

// ============================================
// Tests
// ============================================

describe('useMediasoupStreaming — consumeProducer single-flight', () => {
  const AUTH_USER_ID = 1
  const SPEAKER_USER_ID = 42

  let consumeSpy: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    setupNuxtMocks({ authStore: createMockAuthStore({ user: { id: AUTH_USER_ID } }) })

    consumeSpy = vi.fn(async ({ id, producerId }: { id: string; producerId: string }) =>
      makeStubConsumer(id, producerId))
  })

  afterEach(() => {
    cleanupNuxtMocks()
    vi.clearAllMocks()
  })

  async function setupStreaming(socket: ReturnType<typeof makeGatedSocket>['socket']) {
    const { device } = await import('../../app/composables/mediasoup/useMediasoupDevice')
      .then(m => m.useMediasoupDevice())
    device.value = { loaded: true, rtpCapabilities: {} } as unknown as typeof device.value

    const { consumerTransport } = await import('../../app/composables/mediasoup/useMediasoupTransports')
      .then(m => m.useMediasoupTransports(socket as never))
    consumerTransport.value = {
      id: 'consumer-transport-1',
      consume: consumeSpy,
    } as unknown as typeof consumerTransport.value

    const { useMediasoupStreaming } = await import('../../app/composables/mediasoup/useMediasoupStreaming')
    return useMediasoupStreaming(socket as never)
  }

  it('builds ONE consumer when the same producer is delivered twice concurrently', async () => {
    // The production shape: MSAB can hand a joining socket the same producer in
    // its `existingProducers` snapshot AND as an `audio:newProducer` broadcast.
    const gated = makeGatedSocket()
    const streaming = await setupStreaming(gated.socket)
    const session = (await import('../../app/stores/mediasoupSession')).useMediasoupSessionStore()

    // 🔴 Both started before either is awaited — this is the race.
    const first = streaming.consumeProducer('producer-mic', 'room-1', SPEAKER_USER_ID, 'mic')
    const second = streaming.consumeProducer('producer-mic', 'room-1', SPEAKER_USER_ID, 'mic')

    gated.release()
    await Promise.all([first, second])

    expect(gated.consumeCalls()).toBe(1)
    expect(consumeSpy).toHaveBeenCalledTimes(1)
    expect(streaming.consumers.value.size).toBe(1)
    // The orphan the bug produced was an extra <audio> element still playing.
    expect(session.audioElements.size).toBe(1)
  })

  it('still counts BOTH announcements — dedup must not hide a delivery from ticket 13', async () => {
    // observability-audio-quality/13 grades a join by how many producers were
    // announced vs consumed. The guard sits below the counter on purpose.
    const gated = makeGatedSocket()
    const streaming = await setupStreaming(gated.socket)
    const session = (await import('../../app/stores/mediasoupSession')).useMediasoupSessionStore()

    const first = streaming.consumeProducer('producer-mic', 'room-1', SPEAKER_USER_ID, 'mic')
    const second = streaming.consumeProducer('producer-mic', 'room-1', SPEAKER_USER_ID, 'mic')

    gated.release()
    await Promise.all([first, second])

    expect(session.producersAnnounced).toBe(2)
  })

  it('does not over-dedup: two different producers in flight both get consumers', async () => {
    const gated = makeGatedSocket()
    const streaming = await setupStreaming(gated.socket)

    const mic = streaming.consumeProducer('producer-mic', 'room-1', SPEAKER_USER_ID, 'mic')
    const music = streaming.consumeProducer('producer-music', 'room-1', SPEAKER_USER_ID, 'music')

    gated.release()
    await Promise.all([mic, music])

    expect(streaming.consumers.value.size).toBe(2)
    expect(streaming.consumers.value.has('producer-mic')).toBe(true)
    expect(streaming.consumers.value.has('producer-music')).toBe(true)
  })

  it('surfaces a failure to the joining caller too, and stays retryable', async () => {
    // The trap this guards against: if the second caller early-returned and the
    // first then failed, nobody would consume that producer and the speaker
    // would be silent — a worse bug than the doubling.
    const gated = makeGatedSocket()
    consumeSpy.mockRejectedValueOnce(new Error('transport consume failed'))
    const streaming = await setupStreaming(gated.socket)

    const first = streaming.consumeProducer('producer-mic', 'room-1', SPEAKER_USER_ID, 'mic')
    const second = streaming.consumeProducer('producer-mic', 'room-1', SPEAKER_USER_ID, 'mic')

    gated.release()
    await expect(first).rejects.toThrow('transport consume failed')
    await expect(second).rejects.toThrow('transport consume failed')
    expect(streaming.consumers.value.size).toBe(0)

    // Guard released on failure — the caller's catch-and-retry path still works.
    const retryGate = makeGatedSocket()
    const retried = streaming.consumeProducer('producer-mic', 'room-1', SPEAKER_USER_ID, 'mic')
    retryGate.release()
    gated.release()
    await retried

    expect(streaming.consumers.value.has('producer-mic')).toBe(true)
  })
})

describe('useMediasoupStreaming — startAudio single-flight', () => {
  const AUTH_USER_ID = 1

  let produceSpy: ReturnType<typeof vi.fn>
  let getUserMediaGate: ReturnType<typeof deferred<MediaStream>>
  let getUserMediaCalls: number

  function makeStubTrack() {
    return { kind: 'audio', enabled: true, addEventListener: vi.fn(), stop: vi.fn() }
  }

  /** Needs `getTracks` as well as `getAudioTracks`: `stopAudio()` tears the stream down. */
  function makeStubStream() {
    const track = makeStubTrack()
    return { getAudioTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream
  }

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    setupNuxtMocks({ authStore: createMockAuthStore({ user: { id: AUTH_USER_ID } }) })

    getUserMediaCalls = 0
    getUserMediaGate = deferred<MediaStream>()

    // The real window: `getUserMedia` can sit on a permission prompt for
    // seconds, and `producer.value` is not written until after it returns.
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn(() => {
          getUserMediaCalls += 1
          return getUserMediaGate.promise
        }),
      },
    })

    produceSpy = vi.fn(async () => ({
      id: 'producer-1',
      closed: false,
      track: makeStubTrack(),
      close: vi.fn(),
      on: vi.fn(),
    }))
  })

  afterEach(() => {
    cleanupNuxtMocks()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  async function setupStreaming() {
    const socket = ref({ once: vi.fn(), off: vi.fn(), emit: vi.fn() })

    const { producerTransport } = await import('../../app/composables/mediasoup/useMediasoupTransports')
      .then(m => m.useMediasoupTransports(socket as never))
    producerTransport.value = {
      id: 'producer-transport-1',
      produce: produceSpy,
    } as unknown as typeof producerTransport.value

    const { useMediasoupStreaming } = await import('../../app/composables/mediasoup/useMediasoupStreaming')
    return useMediasoupStreaming(socket as never)
  }

  it('produces ONCE when two callers race across the getUserMedia prompt', async () => {
    // Real callers: take-seat tap, accept-seat-invite, seat-reclaim after a
    // reconnect. None is serialised against the others.
    const streaming = await setupStreaming()

    const takeSeat = streaming.startAudio()
    const reclaim = streaming.startAudio()

    getUserMediaGate.resolve(makeStubStream())
    await Promise.all([takeSeat, reclaim])

    expect(getUserMediaCalls).toBe(1)
    expect(produceSpy).toHaveBeenCalledTimes(1)
  })

  it('restartAudio joins a produce already in flight rather than starting a second one', async () => {
    // Pins accepted behaviour, not ideal behaviour. `restartAudio()` tears down
    // and re-produces, and it runs synchronously from `stopAudio()` to
    // `await startAudio()` — so nothing can interleave *within* it. But if an
    // unrelated produce is already in flight when it is called, it joins that
    // one instead of getting the fresh producer it asked for.
    //
    // That is strictly better than the previous behaviour (two live producers,
    // the displaced one left audible to the whole room) and it self-heals: a
    // produce onto a transport `restartAudio` closed simply rejects. If a
    // guaranteed-fresh producer is ever needed here, `restartAudio` must hold
    // the guard across its own teardown — this test will fail and should be
    // updated deliberately, not deleted.
    const streaming = await setupStreaming()

    const reclaim = streaming.startAudio()
    const restart = streaming.restartAudio()

    getUserMediaGate.resolve(makeStubStream())
    await Promise.all([reclaim, restart])

    expect(getUserMediaCalls).toBe(1)
    expect(produceSpy).toHaveBeenCalledTimes(1)
  })

  it('surfaces a mic failure to both callers and releases the guard for a retry', async () => {
    const streaming = await setupStreaming()

    const takeSeat = streaming.startAudio()
    const reclaim = streaming.startAudio()

    getUserMediaGate.reject(new Error('NotAllowedError'))
    await expect(takeSeat).rejects.toThrow('NotAllowedError')
    await expect(reclaim).rejects.toThrow('NotAllowedError')

    getUserMediaGate = deferred<MediaStream>()
    const retried = streaming.startAudio()
    getUserMediaGate.resolve(makeStubStream())
    await retried

    expect(getUserMediaCalls).toBe(2)
    expect(produceSpy).toHaveBeenCalledTimes(1)
  })
})

describe('useMediasoupStreaming — RNNoise mic filter wiring', () => {
  const AUTH_USER_ID = 1

  let produceSpy: ReturnType<typeof vi.fn>

  function makeStubTrack() {
    return { kind: 'audio', enabled: true, addEventListener: vi.fn(), stop: vi.fn() }
  }

  function makeStubStream() {
    const track = makeStubTrack()
    return { getAudioTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream
  }

  let getUserMediaSpy: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    setupNuxtMocks({ authStore: createMockAuthStore({ user: { id: AUTH_USER_ID } }) })

    getUserMediaSpy = vi.fn(async () => makeStubStream())
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: getUserMediaSpy } })

    // import.meta.client is falsy under plain `vitest` (node env, no Nuxt
    // build macro), so `wireMicThroughAudioContext` always takes its
    // no-AudioContext fallback path here — these tests only need to prove
    // what `getUserMedia` was asked for, which happens before that branch.
    produceSpy = vi.fn(async () => ({
      id: 'producer-1',
      closed: false,
      track: makeStubTrack(),
      close: vi.fn(),
      on: vi.fn(),
    }))
  })

  afterEach(() => {
    cleanupNuxtMocks()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  async function setupStreaming() {
    const socket = ref({ once: vi.fn(), off: vi.fn(), emit: vi.fn() })

    const { producerTransport } = await import('../../app/composables/mediasoup/useMediasoupTransports')
      .then(m => m.useMediasoupTransports(socket as never))
    producerTransport.value = {
      id: 'producer-transport-1',
      produce: produceSpy,
    } as unknown as typeof producerTransport.value

    const { useMediasoupStreaming } = await import('../../app/composables/mediasoup/useMediasoupStreaming')
    return useMediasoupStreaming(socket as never)
  }

  it('requests browser noiseSuppression:true when the filter is off (no worklet support)', async () => {
    // No AudioWorkletNode/AudioContext stubbed → isAudioWorkletSupported() is
    // false → resolveNoiseFilter() is false in every mode except a
    // meaningless 'on' (still false, unsupported) — browser DSP stays on.
    const { useAudioPreferencesStore } = await import('../../app/stores/audioPreferences')
    useAudioPreferencesStore().setNoiseFilterMode('on')

    const streaming = await setupStreaming()
    await streaming.startAudio()

    expect(getUserMediaSpy).toHaveBeenCalledWith({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    expect(streaming.isNoiseFilterActive.value).toBe(false)
  })

  it('requests browser noiseSuppression:false when the filter is forced on and supported', async () => {
    function FakeAudioWorkletNode() { /* noop stub */ }
    function FakeAudioContext() { /* noop stub */ }
    Object.defineProperty(FakeAudioContext.prototype, 'audioWorklet', { get: () => ({}) })
    vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode)
    vi.stubGlobal('AudioContext', FakeAudioContext)

    const { useAudioPreferencesStore } = await import('../../app/stores/audioPreferences')
    useAudioPreferencesStore().setNoiseFilterMode('on')

    const streaming = await setupStreaming()
    await streaming.startAudio()

    expect(getUserMediaSpy).toHaveBeenCalledWith({
      audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true },
    })
  })
})
