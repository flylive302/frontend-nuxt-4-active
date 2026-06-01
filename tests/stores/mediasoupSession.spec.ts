import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia, storeToRefs } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { types as mediasoupTypes } from 'mediasoup-client'

type MockConsumer = { id?: string; close: () => void }
type MockProducer = { closed: boolean; close: () => void }
type MockAudioElement = Pick<HTMLAudioElement, 'pause' | 'srcObject' | 'remove'>

vi.stubGlobal('ref', ref)
vi.stubGlobal('shallowRef', shallowRef)

describe('useMediasoupSessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('initialises with null producers, empty maps, isLocalMuted false, currentVolume 1', async () => {
    const { useMediasoupSessionStore } = await import('../../app/stores/mediasoupSession')
    const store = useMediasoupSessionStore()

    expect(store.producer).toBeNull()
    expect(store.musicProducer).toBeNull()
    expect(store.consumers.size).toBe(0)
    expect(store.audioElements.size).toBe(0)
    expect(store.consumerProducerByUserId.size).toBe(0)
    expect(store.isLocalMuted).toBe(false)
    expect(store.currentVolume).toBe(1)
  })

  describe('addConsumer / removeConsumer', () => {
    it('addConsumer stores the consumer keyed by producerId', async () => {
      const { useMediasoupSessionStore } = await import('../../app/stores/mediasoupSession')
      const store = useMediasoupSessionStore()

      const mockConsumer: MockConsumer = { id: 'consumer-1', close: vi.fn() }
      store.addConsumer('producer-1', mockConsumer as mediasoupTypes.Consumer)

      expect(store.consumers.size).toBe(1)
      expect(store.consumers.get('producer-1')).toStrictEqual(mockConsumer)
    })

    it('removeConsumer deletes the entry for the given producerId', async () => {
      const { useMediasoupSessionStore } = await import('../../app/stores/mediasoupSession')
      const store = useMediasoupSessionStore()

      const mockConsumer: MockConsumer = { close: vi.fn() }
      store.addConsumer('producer-1', mockConsumer as mediasoupTypes.Consumer)
      store.removeConsumer('producer-1')

      expect(store.consumers.size).toBe(0)
    })

    it('removeConsumer is a no-op when producerId is not present', async () => {
      const { useMediasoupSessionStore } = await import('../../app/stores/mediasoupSession')
      const store = useMediasoupSessionStore()

      expect(() => store.removeConsumer('nonexistent')).not.toThrow()
    })
  })

  describe('$reset()', () => {
    it('calls pause, nulls srcObject, and calls remove on every audioElement', async () => {
      const { useMediasoupSessionStore } = await import('../../app/stores/mediasoupSession')
      const store = useMediasoupSessionStore()

      const mockAudio: MockAudioElement = { pause: vi.fn(), srcObject: null, remove: vi.fn() }
      store.audioElements.set('producer-1', mockAudio as HTMLAudioElement)

      store.$reset()

      expect(mockAudio.pause).toHaveBeenCalledOnce()
      expect(mockAudio.srcObject).toBeNull()
      expect(mockAudio.remove).toHaveBeenCalledOnce()
    })

    it('clears audioElements map', async () => {
      const { useMediasoupSessionStore } = await import('../../app/stores/mediasoupSession')
      const store = useMediasoupSessionStore()

      const mockAudio: MockAudioElement = { pause: vi.fn(), srcObject: null, remove: vi.fn() }
      store.audioElements.set('producer-1', mockAudio as HTMLAudioElement)
      store.$reset()

      expect(store.audioElements.size).toBe(0)
    })

    it('clears consumers map', async () => {
      const { useMediasoupSessionStore } = await import('../../app/stores/mediasoupSession')
      const store = useMediasoupSessionStore()

      const mockConsumer: MockConsumer = { close: vi.fn() }
      store.addConsumer('producer-1', mockConsumer as mediasoupTypes.Consumer)
      store.$reset()

      expect(store.consumers.size).toBe(0)
    })

    it('clears consumerProducerByUserId map', async () => {
      const { useMediasoupSessionStore } = await import('../../app/stores/mediasoupSession')
      const store = useMediasoupSessionStore()

      store.consumerProducerByUserId.set(42, 'producer-1')
      store.$reset()

      expect(store.consumerProducerByUserId.size).toBe(0)
    })

    it('resets producer and musicProducer to null', async () => {
      const { useMediasoupSessionStore } = await import('../../app/stores/mediasoupSession')
      const store = useMediasoupSessionStore()

      const { producer, musicProducer } = storeToRefs(store)
      const mockProducer: MockProducer = { closed: false, close: vi.fn() }
      const mockMusicProducer: MockProducer = { closed: false, close: vi.fn() }
      producer.value = mockProducer as mediasoupTypes.Producer
      musicProducer.value = mockMusicProducer as mediasoupTypes.Producer

      store.$reset()

      expect(store.producer).toBeNull()
      expect(store.musicProducer).toBeNull()
    })

    it('resets isLocalMuted to false and currentVolume to 1', async () => {
      const { useMediasoupSessionStore } = await import('../../app/stores/mediasoupSession')
      const store = useMediasoupSessionStore()

      store.setVolume(0.3)
      store.$reset()

      expect(store.isLocalMuted).toBe(false)
      expect(store.currentVolume).toBe(1)
    })
  })

  describe('setVolume()', () => {
    it('clamps values below 0 to 0', async () => {
      const { useMediasoupSessionStore } = await import('../../app/stores/mediasoupSession')
      const store = useMediasoupSessionStore()

      store.setVolume(-0.5)
      expect(store.currentVolume).toBe(0)
    })

    it('clamps values above 1 to 1', async () => {
      const { useMediasoupSessionStore } = await import('../../app/stores/mediasoupSession')
      const store = useMediasoupSessionStore()

      store.setVolume(1.5)
      expect(store.currentVolume).toBe(1)
    })

    it('sets currentVolume to an in-range value exactly', async () => {
      const { useMediasoupSessionStore } = await import('../../app/stores/mediasoupSession')
      const store = useMediasoupSessionStore()

      store.setVolume(0.7)
      expect(store.currentVolume).toBe(0.7)
    })
  })
})
