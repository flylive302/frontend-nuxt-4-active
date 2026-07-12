/**
 * Unit tests for the producer `source` tag on the produce wire path
 * (dj-talk-over slice 01). Confirms `appData.source` set in
 * `useMediasoupStreaming.ts`'s `produce()` calls survives mediasoup-client's
 * `'produce'` transport event (which re-emits `appData` verbatim — see
 * mediasoup-client's `Transport.produce()`) and lands on the `audio:produce`
 * wire payload sent to MSAB.
 *
 * Compat: a `produce()` call made without an explicit `appData.source`
 * (should not happen post-slice-01, but the transports layer defends it)
 * must default to `'mic'`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref, shallowRef, computed } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('shallowRef', shallowRef)
vi.stubGlobal('computed', computed)
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

type ProduceHandler = (
  params: { kind: string; rtpParameters: object; appData?: { source?: string } },
  callback: (p: { id: string }) => void,
  errback: (e: Error) => void,
) => void

function makeMockSocket() {
  const emitted: Array<{ event: string; payload: unknown }> = []
  const socket = ref({
    once: vi.fn(),
    off: vi.fn(),
    emit: vi.fn((event: string, payload: unknown, callback?: (response: unknown) => void) => {
      emitted.push({ event, payload })
      if (!callback) return
      if (event === 'transport:create') {
        callback({
          success: true,
          data: { id: 'transport-1', iceParameters: {}, iceCandidates: [], dtlsParameters: {} },
        })
      } else if (event === 'audio:produce') {
        callback({ success: true, data: { id: 'server-producer-1' } })
      }
    }),
  })
  return { socket, emitted }
}

describe('useMediasoupTransports — produce() appData.source reaches the audio:produce wire payload', () => {
  let produceHandler: ProduceHandler | undefined

  beforeEach(async () => {
    vi.clearAllMocks()
    produceHandler = undefined

    // Wire the module-singleton device ref (shared shallowRef, settable
    // directly — see useMediasoupStreamingSources.spec.ts for the same
    // pattern) with a fake send transport that captures the 'produce'
    // handler exactly like mediasoup-client's real Transport does.
    const { device } = await import('../../app/composables/mediasoup/useMediasoupDevice').then(m => m.useMediasoupDevice())
    device.value = {
      loaded: true,
      createRecvTransport: vi.fn(() => ({
        id: 'transport-1',
        on: vi.fn(),
        close: vi.fn(),
      })),
      createSendTransport: vi.fn(() => ({
        id: 'transport-1',
        on: vi.fn((event: string, handler: unknown) => {
          if (event === 'produce') produceHandler = handler as ProduceHandler
        }),
        close: vi.fn(),
      })),
    } as unknown as typeof device.value

    // useMediasoupTransports' producerTransport/consumerTransport/currentRoomId
    // are module-level singletons shared across tests in this file — reset
    // them so each test starts from a clean transport-less state (mirrors
    // what leaveRoom()/cleanup() does in the real app).
    const { cleanup } = await import('../../app/composables/mediasoup/useMediasoupTransports')
      .then(m => m.useMediasoupTransports(ref({ emit: vi.fn(), once: vi.fn(), off: vi.fn() }) as never))
    cleanup()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('tags the audio:produce payload with source: "music" when produce() is called with appData: { source: "music" }', async () => {
    const { socket, emitted } = makeMockSocket()
    const { useMediasoupTransports } = await import('../../app/composables/mediasoup/useMediasoupTransports')
    const { createTransports, createProducerTransport } = useMediasoupTransports(socket as never)

    await createTransports('room-1')
    await createProducerTransport()
    expect(produceHandler).toBeDefined()

    // Simulate mediasoup-client's real 'produce' emission, which forwards
    // appData verbatim (Transport.produce() -> safeEmit('produce', { kind, rtpParameters, appData })).
    produceHandler!({ kind: 'audio', rtpParameters: {}, appData: { source: 'music' } }, vi.fn(), vi.fn())

    const produceCall = emitted.find(e => e.event === 'audio:produce')
    expect(produceCall?.payload).toMatchObject({ source: 'music' })
  })

  it('tags the audio:produce payload with source: "mic" when produce() is called with appData: { source: "mic" }', async () => {
    const { socket, emitted } = makeMockSocket()
    const { useMediasoupTransports } = await import('../../app/composables/mediasoup/useMediasoupTransports')
    const { createTransports, createProducerTransport } = useMediasoupTransports(socket as never)

    await createTransports('room-1')
    await createProducerTransport()
    produceHandler!({ kind: 'audio', rtpParameters: {}, appData: { source: 'mic' } }, vi.fn(), vi.fn())

    const produceCall = emitted.find(e => e.event === 'audio:produce')
    expect(produceCall?.payload).toMatchObject({ source: 'mic' })
  })

  it('defaults to source: "mic" when appData carries no source (compat)', async () => {
    const { socket, emitted } = makeMockSocket()
    const { useMediasoupTransports } = await import('../../app/composables/mediasoup/useMediasoupTransports')
    const { createTransports, createProducerTransport } = useMediasoupTransports(socket as never)

    await createTransports('room-1')
    await createProducerTransport()
    produceHandler!({ kind: 'audio', rtpParameters: {}, appData: {} }, vi.fn(), vi.fn())

    const produceCall = emitted.find(e => e.event === 'audio:produce')
    expect(produceCall?.payload).toMatchObject({ source: 'mic' })
  })
})
