/**
 * aws-app-affinity/14 — the displacement-key race.
 *
 * Sibling of `useMediasoupStreamingSingleFlight.spec.ts`, which covers the SAME
 * `producerId` arriving twice. This file covers the collision that one cannot
 * see: **different** `producerId`s sharing a `${userId}:${source}` displacement
 * key — a speaker's stale and fresh mic producers.
 *
 * `consumeProducer()` reads `consumerProducerByKey` to decide what to displace
 * and writes it two awaits later. Concurrently, both read an empty slot, neither
 * stops the other, and the loser's `<audio>` element keeps playing while being
 * unreachable by `stopConsumer()`. Heard as ONE SPEAKER TWICE.
 *
 * Reachable in production because the live `audio:newProducer` handler is
 * registered (`useRoomAudio.ts:512`) before the join-time catch-up loop runs
 * (`:731`), so a snapshot entry and a live announce overlap.
 *
 * 🔴 Every test starts both calls WITHOUT awaiting the first. Awaiting call #1
 * first exercises the plain map read and proves nothing about the race.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref, computed } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { setupNuxtMocks, cleanupNuxtMocks, createMockAuthStore } from '../helpers/nuxtMocks'

vi.stubGlobal('computed', computed)
vi.stubGlobal('onUnmounted', vi.fn())
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

const removeSpy = vi.fn()

vi.stubGlobal('Audio', vi.fn().mockImplementation(() => ({
  srcObject: null,
  volume: 1,
  autoplay: false,
  setAttribute: vi.fn(),
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  remove: removeSpy,
})))
vi.stubGlobal('MediaStream', vi.fn().mockImplementation((tracks: unknown[]) => ({ tracks })))

/** A latch the test opens when it chooses, so two calls overlap for real. */
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
 * Socket whose `audio:consume` replies are held until the test releases them.
 *
 * `resumeFailsFor` makes `consumer:resume` answer `{ success: false }` for one
 * consumer — a distinct failure branch from a rejected `transport.consume()`,
 * because it tears the half-built consumer down INSIDE `buildConsumer` and
 * resolves quietly rather than throwing.
 */
function makeGatedSocket(resumeFailsFor?: string) {
  const gate = openableGate()
  const consumedProducerIds: string[] = []

  const socket = ref({
    once: vi.fn(),
    off: vi.fn(),
    emit: vi.fn((event: string, payload: unknown, callback?: (response: unknown) => void) => {
      if (!callback) return

      if (event === 'audio:consume') {
        const { producerId } = payload as { producerId: string }
        consumedProducerIds.push(producerId)
        void gate.opened.then(() => {
          callback({
            success: true,
            data: { id: `consumer-for-${producerId}`, producerId, kind: 'audio', rtpParameters: {} },
          })
        })
      }
      else if (event === 'consumer:resume') {
        const { consumerId } = payload as { consumerId: string }
        callback({ success: consumerId !== `consumer-for-${resumeFailsFor}` })
      }
    }),
  })

  return { socket, release: gate.open, consumedProducerIds }
}

describe('useMediasoupStreaming — displacement-key single-flight', () => {
  const AUTH_USER_ID = 1
  const SPEAKER_USER_ID = 42

  let consumeSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
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

  it('leaves ONE live consumer when a stale and a fresh producer race for the same speaker', async () => {
    // The production shape: `stale-mic` comes from the join snapshot, `fresh-mic`
    // from a live `audio:newProducer` that lands while catch-up is still running.
    // Different producerIds, so `_consumeInFlight` never sees the collision.
    const gated = makeGatedSocket()
    const streaming = await setupStreaming(gated.socket)
    const session = (await import('../../app/stores/mediasoupSession')).useMediasoupSessionStore()

    const stale = streaming.consumeProducer('stale-mic', 'room-1', SPEAKER_USER_ID, 'mic')
    const fresh = streaming.consumeProducer('fresh-mic', 'room-1', SPEAKER_USER_ID, 'mic')

    gated.release()
    await Promise.all([stale, fresh])

    // 🔴 The whole point. Without the guard this is 2, and the extra <audio>
    // element keeps playing — the speaker is heard twice.
    expect(streaming.consumers.value.size).toBe(1)
    expect(session.audioElements.size).toBe(1)
  })

  it('keeps the NEWER producer and stops the older one', async () => {
    // Direction matters as much as the count: keeping the stale producer would
    // trade doubling for silence, since the fresh one is the live stream.
    const gated = makeGatedSocket()
    const streaming = await setupStreaming(gated.socket)

    const stale = streaming.consumeProducer('stale-mic', 'room-1', SPEAKER_USER_ID, 'mic')
    const fresh = streaming.consumeProducer('fresh-mic', 'room-1', SPEAKER_USER_ID, 'mic')

    gated.release()
    await Promise.all([stale, fresh])

    expect(streaming.consumers.value.has('fresh-mic')).toBe(true)
    expect(streaming.consumers.value.has('stale-mic')).toBe(false)
  })

  it('displaces rather than skips — the older consumer is torn down, not orphaned', async () => {
    // An orphan is a consumer removed from the map while its <audio> element
    // keeps playing. Assert the teardown actually ran.
    const gated = makeGatedSocket()
    const streaming = await setupStreaming(gated.socket)

    const stale = streaming.consumeProducer('stale-mic', 'room-1', SPEAKER_USER_ID, 'mic')
    const fresh = streaming.consumeProducer('fresh-mic', 'room-1', SPEAKER_USER_ID, 'mic')

    gated.release()
    await Promise.all([stale, fresh])

    // Both were really built — the guard serialises, it does not skip work.
    expect(gated.consumedProducerIds).toEqual(['stale-mic', 'fresh-mic'])
    expect(removeSpy).toHaveBeenCalled()
  })

  it('does not serialise a speaker mic against their own music producer', async () => {
    // Different displacement keys, so they must stay concurrent. Collapsing the
    // key to userId alone would silence one of the two.
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

  it('does not serialise two different speakers', async () => {
    const gated = makeGatedSocket()
    const streaming = await setupStreaming(gated.socket)

    const one = streaming.consumeProducer('mic-a', 'room-1', 7, 'mic')
    const two = streaming.consumeProducer('mic-b', 'room-1', 8, 'mic')

    gated.release()
    await Promise.all([one, two])

    expect(streaming.consumers.value.size).toBe(2)
  })

  it('lets the newer producer through when the older one FAILS', async () => {
    // The failure mode that would trade doubling for silence: if the waiter
    // inherited the first producer's rejection, a speaker whose stale producer
    // errored would never be heard at all.
    const gated = makeGatedSocket()
    consumeSpy.mockRejectedValueOnce(new Error('transport consume failed'))
    const streaming = await setupStreaming(gated.socket)

    const stale = streaming.consumeProducer('stale-mic', 'room-1', SPEAKER_USER_ID, 'mic')
    const fresh = streaming.consumeProducer('fresh-mic', 'room-1', SPEAKER_USER_ID, 'mic')

    gated.release()
    await expect(stale).rejects.toThrow('transport consume failed')
    await fresh

    expect(streaming.consumers.value.has('fresh-mic')).toBe(true)
  })

  it('survives the older producer failing at consumer:resume — the third door', async () => {
    // A distinct branch from a rejected `transport.consume()`: this one tears
    // the half-built consumer down INSIDE `buildConsumer` (`:671`) and resolves
    // QUIETLY, so the waiter is not warned by a rejection. `stopConsumer` there
    // also clears the displacement key, meaning the waiter finds nothing to
    // displace — and must still consume cleanly rather than double or skip.
    const gated = makeGatedSocket('stale-mic')
    const streaming = await setupStreaming(gated.socket)
    const session = (await import('../../app/stores/mediasoupSession')).useMediasoupSessionStore()

    const stale = streaming.consumeProducer('stale-mic', 'room-1', SPEAKER_USER_ID, 'mic')
    const fresh = streaming.consumeProducer('fresh-mic', 'room-1', SPEAKER_USER_ID, 'mic')

    gated.release()
    await Promise.all([stale, fresh])

    // The newer speaker is audible, the failed one left nothing behind.
    expect(streaming.consumers.value.has('fresh-mic')).toBe(true)
    expect(streaming.consumers.value.has('stale-mic')).toBe(false)
    expect(streaming.consumers.value.size).toBe(1)
    expect(session.audioElements.size).toBe(1)
  })

  it('releases the key so a later consume for the same speaker still works', async () => {
    // A leaked key entry would wedge that speaker for the life of the page.
    const gated = makeGatedSocket()
    const streaming = await setupStreaming(gated.socket)

    const first = streaming.consumeProducer('mic-1', 'room-1', SPEAKER_USER_ID, 'mic')
    gated.release()
    await first

    const later = makeGatedSocket()
    const second = streaming.consumeProducer('mic-2', 'room-1', SPEAKER_USER_ID, 'mic')
    later.release()
    gated.release()
    await second

    expect(streaming.consumers.value.has('mic-2')).toBe(true)
    expect(streaming.consumers.value.size).toBe(1)
  })

  it('collapses three racing producers for one speaker down to the last', async () => {
    // More than two waiters is where a single `await` instead of a loop breaks:
    // the second and third resume together and race each other.
    const gated = makeGatedSocket()
    const streaming = await setupStreaming(gated.socket)

    const a = streaming.consumeProducer('mic-a', 'room-1', SPEAKER_USER_ID, 'mic')
    const b = streaming.consumeProducer('mic-b', 'room-1', SPEAKER_USER_ID, 'mic')
    const c = streaming.consumeProducer('mic-c', 'room-1', SPEAKER_USER_ID, 'mic')

    gated.release()
    await Promise.all([a, b, c])

    expect(streaming.consumers.value.size).toBe(1)
    expect(streaming.consumers.value.has('mic-c')).toBe(true)
  })

  it('still consumes a producer announced without a user id', async () => {
    // No userId means no displacement key, so the guard must not park it.
    const gated = makeGatedSocket()
    const streaming = await setupStreaming(gated.socket)

    const anon = streaming.consumeProducer('anon-mic', 'room-1')

    gated.release()
    await anon

    expect(streaming.consumers.value.has('anon-mic')).toBe(true)
  })
})
