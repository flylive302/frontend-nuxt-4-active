/**
 * Unit tests for useRoomAudioPlayer's drawer tap-to-play (slice 05).
 *
 * Mocks Nuxt auto-imports (reactivity primitives + stores) and the deep
 * modules (`audioPlaybackEngine`, `useMediasoupStreaming`, socket emit) the
 * same way `useMediasoup.spec.ts` does, so the orchestrator's own
 * GATE → EXECUTE → REACT logic runs for real. Behavior only — no DOM/gesture
 * assertions; the drawer component only binds a tap to `playTrack`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, reactive, computed, readonly, watch, nextTick } from 'vue'

// ============================================
// Mock Nuxt auto-imports
// ============================================
vi.stubGlobal('ref', ref)
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('watch', watch)
vi.stubGlobal('nextTick', nextTick)

const mockUser = { id: 'user-1' }
vi.stubGlobal('useAuthStore', () => ({ user: mockUser }))
vi.stubGlobal('useRoomStore', () => ({ currentRoom: { id: 'room-1' } }))
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

const produceTrack = vi.fn().mockResolvedValue(undefined)
const stopMusicProducer = vi.fn()
vi.stubGlobal('useMediasoupStreaming', () => ({ produceTrack, stopMusicProducer }))

// ============================================
// Mock deep modules
// ============================================

/** A fake playback engine — no real Web Audio graph, just enough to drive the orchestrator. */
function createMockEngine() {
  return {
    play: vi.fn().mockResolvedValue({ duration: 120 }),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    seek: vi.fn(),
    setOnEnded: vi.fn(),
    setVolume: vi.fn(),
    duck: vi.fn(),
    releaseDuck: vi.fn(),
    prefetch: vi.fn(),
    getPosition: vi.fn().mockReturnValue(0),
    getOutputTrack: vi.fn().mockReturnValue({} as MediaStreamTrack),
    dispose: vi.fn(),
  }
}

vi.mock('~/services/audioPlaybackEngine', () => ({
  createAudioPlaybackEngine: vi.fn(() => createMockEngine()),
  AudioPlaybackError: class AudioPlaybackError extends Error {},
}))

// `emitAsync` — always grants the slot and acks the stop, mirroring MSAB success responses.
vi.mock('~/utils/socket', () => ({
  createEmitAsync: () => vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

/** Build an `audio/*` File handle the way the uploader would hand it over. */
function audioFile(name: string): File {
  return new File([new Uint8Array([0, 1, 2])], name, { type: 'audio/mpeg' })
}

describe('useRoomAudioPlayer — drawer tap-to-play (playTrack)', () => {
  const mockSocket = ref({ emit: vi.fn(), on: vi.fn(), off: vi.fn() })

  beforeEach(() => {
    vi.clearAllMocks()
    // The orchestrator intentionally keeps module-level singleton state (one
    // DJ session per tab). Reset the module registry so each test gets a
    // fresh queue/player instead of leaking the previous test's session.
    vi.resetModules()
  })

  it('re-opens the deck and starts the tapped track after the deck was closed with ✕', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    const [trackA, trackB] = player.addTracks([audioFile('a.mp3'), audioFile('b.mp3')])
    await player.play('room-1')
    player.closePlayer('room-1') // ✕: stops + hides the deck, queue is kept

    expect(player.isPlayerVisible.value).toBe(false)
    expect(player.isActive.value).toBe(false)

    await player.playTrack('room-1', trackB!.id)

    expect(player.isPlayerVisible.value).toBe(true) // deck re-opened
    expect(player.currentTrackId.value).toBe(trackB!.id)
    expect(player.playerState.title).toBe(trackB!.title)
    expect(player.isPlaying.value).toBe(true)
    expect(trackA).toBeDefined() // sanity: two tracks were queued
  })

  it('switches tracks when tapping a row mid-playback', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    const [trackA, trackB] = player.addTracks([audioFile('a.mp3'), audioFile('b.mp3')])
    await player.play('room-1') // starts on trackA

    expect(player.currentTrackId.value).toBe(trackA!.id)
    expect(player.isPlaying.value).toBe(true)

    await player.playTrack('room-1', trackB!.id) // tap a different row mid-playback

    expect(player.currentTrackId.value).toBe(trackB!.id)
    expect(player.playerState.title).toBe(trackB!.title)
    expect(player.isPlaying.value).toBe(true)
    expect(player.isPlayerVisible.value).toBe(true)
    // Switching an already-live session must not re-acquire the producer/mutex.
    expect(produceTrack).toHaveBeenCalledTimes(1)
  })

  it('is a no-op for an id no longer in the queue (e.g. removed concurrently)', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    player.addTracks([audioFile('a.mp3')])
    await player.play('room-1')
    const titleBefore = player.playerState.title

    await player.playTrack('room-1', 'not-a-real-track-id')

    expect(player.playerState.title).toBe(titleBefore)
  })
})
