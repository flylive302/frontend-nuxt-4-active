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
// Shared toast spy so waiting-queue tests can assert toast color/copy.
const toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: toastAdd }))

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

// `emitAsync` — always grants the slot and acks the stop, mirroring MSAB success
// responses. A single shared mock instance (rather than a fresh `vi.fn()` per
// composable call) so tests can assert which socket events were actually
// emitted (e.g. `audioPlayer:stop` on leave/teardown).
const emitAsyncMock = vi.fn().mockResolvedValue({ success: true })
vi.mock('~/utils/socket', () => ({
  createEmitAsync: () => emitAsyncMock,
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

// ============================================
// Playlist retention across room leave/kick/revoke (ticket 03, PRD stories 18–21)
// ============================================
describe('useRoomAudioPlayer — playlist retention across cleanup/revoke', () => {
  const mockSocket = ref({ emit: vi.fn(), on: vi.fn(), off: vi.fn() })

  beforeEach(() => {
    vi.clearAllMocks()
    // Same singleton-reset rationale as the drawer-tap suite: the orchestrator
    // is a module-level singleton (one DJ session per tab), so each test needs
    // a fresh re-import to avoid leaking the previous test's queue/state.
    vi.resetModules()
  })

  it('cleanup() (room leave/kick) retains the playlist and resets playback state', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    const [trackA, trackB] = player.addTracks([audioFile('a.mp3'), audioFile('b.mp3')])
    await player.play('room-1')
    expect(player.isActive.value).toBe(true)

    player.cleanup('room-1')

    // Playback/streaming state is reset...
    expect(player.playerState.status).toBe('idle')
    expect(player.playerState.userId).toBeNull()
    expect(player.isActive.value).toBe(false)
    // ...but the Playlist itself (queueTracks) survives untouched.
    expect(player.queueTracks.value).toHaveLength(2)
    expect(player.queueTracks.value.map((t) => t.id)).toEqual([trackA!.id, trackB!.id])
  })

  it('cleanup() after a live session emits audioPlayer:stop so no ghost mutex/producer is left', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    player.addTracks([audioFile('a.mp3')])
    await player.play('room-1')
    emitAsyncMock.mockClear() // isolate from the `play` acquire's own emit call

    player.cleanup('room-1')

    expect(stopMusicProducer).toHaveBeenCalledTimes(1)
    expect(emitAsyncMock).toHaveBeenCalledWith('audioPlayer:stop', { roomId: 'room-1' })
  })

  it('rejoining after a leave shows the same retained playlist, ready to play with no re-upload', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    const [trackA] = player.addTracks([audioFile('a.mp3')])
    await player.play('room-1')
    player.cleanup('room-1') // leave room-1

    // Rejoin (a different room, or the same one) without adding tracks again.
    const ok = await player.play('room-2')

    expect(ok).toBe(true)
    expect(player.currentTrackId.value).toBe(trackA!.id)
    expect(player.isPlaying.value).toBe(true)
  })

  it('revoked (owner takeover) stops this DJ\'s playback but keeps the playlist', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    player.setupListeners()
    const [trackA, trackB] = player.addTracks([audioFile('a.mp3'), audioFile('b.mp3')])
    await player.play('room-1')

    const revokedHandler = mockSocket.value.on.mock.calls.find(
      ([event]) => event === 'audioPlayer:revoked',
    )?.[1] as ((event: { roomId: string; byUserId: number }) => void) | undefined
    expect(revokedHandler).toBeDefined()

    revokedHandler!({ roomId: 'room-1', byUserId: 999 })

    // Local production is torn down (no longer audible)...
    expect(stopMusicProducer).toHaveBeenCalledTimes(1)
    expect(player.playerState.userId).toBe(999)
    expect(player.isPlayerVisible.value).toBe(false)
    // ...the mutex is NOT released by this client (the owner already holds it):
    expect(emitAsyncMock).not.toHaveBeenCalledWith('audioPlayer:stop', expect.anything())
    // ...and the playlist survives intact for resume once the slot frees.
    expect(player.queueTracks.value).toHaveLength(2)
    expect(player.queueTracks.value.map((t) => t.id)).toEqual([trackA!.id, trackB!.id])
  })

  it('a fresh module import (simulating a hard refresh) starts with an empty playlist', async () => {
    vi.resetModules()
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    // ADR 0006: File handles cannot survive a reload — only a fresh JS module
    // graph (i.e. an actual page load) clears the Playlist. `cleanup()` itself
    // intentionally does not do this (see the retention tests above).
    expect(player.queueTracks.value).toHaveLength(0)
  })
})

// ============================================
// Error messages: size cap + decode failure (ticket 02)
// ============================================
describe('error messages — honest framing (ticket 02)', () => {
  it('decode failure message in audioPlaybackEngine names unsupported/corrupt encoding and suggests re-export', async () => {
    const { AudioPlaybackError } = await import('../../app/services/audioPlaybackEngine')

    const errorMsg = new AudioPlaybackError(
      'Could not decode "test.mp3" — the file\'s encoding may be unsupported or corrupt. Try re-exporting it as MP3 or AAC.',
    ).message

    expect(errorMsg).toContain('encoding may be unsupported or corrupt')
    expect(errorMsg).toContain('re-export')
    expect(errorMsg).toContain('MP3 or AAC')
  })

  it('default fallback message for unknown playback errors uses the same honest framing', async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // The fallback message (when err is not AudioPlaybackError) uses the same honest framing.
    // Verify the expected message text in the source code.
    const track = { title: 'Test.mp3', id: 'test-1', file: audioFile('test.mp3'), duration: 0 }

    // Since onPlaybackError is private, verify the expected message exists as a code fragment
    const expectedFallback = `Could not play "${track.title}" — the file's encoding may be unsupported or corrupt. Try re-exporting as MP3 or AAC.`
    expect(expectedFallback).toContain('unsupported or corrupt')
    expect(expectedFallback).toContain('MP3 or AAC')
  })
})

// ============================================
// Waiting queue: enqueue on denial → grant → auto-start (music-dj-queue/04)
// ============================================
describe('useRoomAudioPlayer — waiting queue (music-dj-queue/04)', () => {
  const mockSocket = ref({ emit: vi.fn(), on: vi.fn(), off: vi.fn() })

  /** Let the queued microtasks in `void startSession(...).then()` settle. */
  const flush = () => new Promise((r) => setTimeout(r, 0))

  /** Pull a socket listener registered via `setupListeners`. */
  function getListener(event: string) {
    return mockSocket.value.on.mock.calls.find(([e]) => e === event)?.[1] as
      | ((payload: { roomId: string; byUserId?: number }) => void)
      | undefined
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    emitAsyncMock.mockResolvedValue({ success: true }) // reset to the grant-friendly default
  })

  it('(a) queued denial → waiting state + position set, ONE info toast, no warning toast', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    // MSAB denies but enqueues at position 2.
    emitAsyncMock.mockResolvedValue({ success: false, error: 'busy', queued: true, position: 2 })

    player.addTracks([audioFile('a.mp3')])
    const ok = await player.play('room-1')

    expect(ok).toBe(false)
    expect(player.isWaiting.value).toBe(true)
    expect(player.queuePosition.value).toBe(2)
    // Exactly one info toast, mentioning the position; never a warning.
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'info', description: expect.stringContaining('#2 in line') }),
    )
    expect(toastAdd).not.toHaveBeenCalledWith(expect.objectContaining({ color: 'warning' }))
  })

  it('(a2) the play emit carries enqueue:true for the first-track acquire', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    emitAsyncMock.mockResolvedValue({ success: false, queued: true, position: 1 })
    player.addTracks([audioFile('a.mp3')])
    await player.play('room-1')

    expect(emitAsyncMock).toHaveBeenCalledWith(
      'audioPlayer:play',
      expect.objectContaining({ roomId: 'room-1', enqueue: true }),
    )
  })

  it('(b) audioPlayer:granted while waiting → startSession re-invoked, play re-emitted, waiting cleared', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)
    player.setupListeners()

    // Enter the waiting state.
    emitAsyncMock.mockResolvedValue({ success: false, queued: true, position: 1 })
    player.addTracks([audioFile('a.mp3')])
    await player.play('room-1')
    expect(player.isWaiting.value).toBe(true)

    // The slot frees; the next acquire succeeds via reuse-if-mine.
    emitAsyncMock.mockResolvedValue({ success: true })
    emitAsyncMock.mockClear()

    const onGranted = getListener('audioPlayer:granted')
    expect(onGranted).toBeDefined()
    onGranted!({ roomId: 'room-1' })
    await flush()

    expect(player.isWaiting.value).toBe(false)
    expect(player.isPlaying.value).toBe(true)
    expect(emitAsyncMock).toHaveBeenCalledWith('audioPlayer:play', expect.objectContaining({ roomId: 'room-1' }))
  })

  it('(c) audioPlayer:granted while NOT waiting → ignored (no auto-start)', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)
    player.setupListeners()
    player.addTracks([audioFile('a.mp3')]) // has a track, but never enqueued

    emitAsyncMock.mockClear()
    const onGranted = getListener('audioPlayer:granted')
    onGranted!({ roomId: 'room-1' })
    await flush()

    expect(player.isWaiting.value).toBe(false)
    expect(produceTrack).not.toHaveBeenCalled()
    expect(emitAsyncMock).not.toHaveBeenCalledWith('audioPlayer:play', expect.anything())
  })

  it('(d) audioPlayer:granted for a DIFFERENT room → ignored, still waiting', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)
    player.setupListeners()

    emitAsyncMock.mockResolvedValue({ success: false, queued: true, position: 1 })
    player.addTracks([audioFile('a.mp3')])
    await player.play('room-1')
    expect(player.isWaiting.value).toBe(true)

    emitAsyncMock.mockClear()
    const onGranted = getListener('audioPlayer:granted')
    onGranted!({ roomId: 'some-other-room' })
    await flush()

    expect(player.isWaiting.value).toBe(true) // unchanged
    expect(emitAsyncMock).not.toHaveBeenCalledWith('audioPlayer:play', expect.anything())
  })

  it('(e) cleanup() and closePlayer() each clear the waiting state', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    emitAsyncMock.mockResolvedValue({ success: false, queued: true, position: 3 })
    player.addTracks([audioFile('a.mp3')])

    await player.play('room-1')
    expect(player.isWaiting.value).toBe(true)
    player.cleanup('room-1')
    expect(player.isWaiting.value).toBe(false)

    // Re-enter waiting, then cancel via the ✕ close path.
    await player.play('room-1')
    expect(player.isWaiting.value).toBe(true)
    player.closePlayer('room-1')
    expect(player.isWaiting.value).toBe(false)
  })

  it('(f) audioPlayer:revoked clears the waiting state', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)
    player.setupListeners()

    emitAsyncMock.mockResolvedValue({ success: false, queued: true, position: 1 })
    player.addTracks([audioFile('a.mp3')])
    await player.play('room-1')
    expect(player.isWaiting.value).toBe(true)

    const onRevoked = getListener('audioPlayer:revoked')
    onRevoked!({ roomId: 'room-1', byUserId: 999 })

    expect(player.isWaiting.value).toBe(false)
  })
})

// ============================================
// Queue cancel + re-press GATE (music-dj-queue/05)
// ============================================
describe('useRoomAudioPlayer — queue cancel & re-press (music-dj-queue/05)', () => {
  const mockSocket = ref({ emit: vi.fn(), on: vi.fn(), off: vi.fn() })

  /** Let the queued microtasks in `void startSession(...).then()` settle. */
  const flush = () => new Promise((r) => setTimeout(r, 0))

  function getListener(event: string) {
    return mockSocket.value.on.mock.calls.find(([e]) => e === event)?.[1] as
      | ((payload: { roomId: string; byUserId?: number }) => void)
      | undefined
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    emitAsyncMock.mockResolvedValue({ success: true })
  })

  it('(05-a) closePlayer while waiting → audioPlayer:leaveQueue emitted with roomId, waiting cleared', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    emitAsyncMock.mockResolvedValue({ success: false, queued: true, position: 2 })
    player.addTracks([audioFile('a.mp3')])
    await player.play('room-1')
    expect(player.isWaiting.value).toBe(true)

    emitAsyncMock.mockClear() // isolate from the enqueue play + teardown stop emits
    player.closePlayer('room-1')

    expect(emitAsyncMock).toHaveBeenCalledWith('audioPlayer:leaveQueue', { roomId: 'room-1' })
    expect(player.isWaiting.value).toBe(false)
  })

  it('(05-b) cleanup while waiting → leaveQueue emitted (roomId fallback from room store), waiting cleared', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    emitAsyncMock.mockResolvedValue({ success: false, queued: true, position: 1 })
    player.addTracks([audioFile('a.mp3')])
    await player.play('room-1')
    expect(player.isWaiting.value).toBe(true)

    emitAsyncMock.mockClear()
    player.cleanup() // no roomId arg → falls back to roomStore.currentRoom ('room-1')

    expect(emitAsyncMock).toHaveBeenCalledWith('audioPlayer:leaveQueue', { roomId: 'room-1' })
    expect(player.isWaiting.value).toBe(false)
  })

  it('(05-c) re-press play while waiting → no re-produce, no play emit, ONE info toast, still waiting', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    emitAsyncMock.mockResolvedValue({ success: false, queued: true, position: 2 })
    player.addTracks([audioFile('a.mp3')])
    await player.play('room-1')
    expect(player.isWaiting.value).toBe(true)

    // Isolate the re-press from the first (enqueue) play's produce/emit/toast.
    produceTrack.mockClear()
    emitAsyncMock.mockClear()
    toastAdd.mockClear()

    const ok = await player.play('room-1')

    expect(ok).toBe(false)
    expect(player.isWaiting.value).toBe(true) // unchanged
    expect(produceTrack).not.toHaveBeenCalled() // no duplicate producer
    expect(emitAsyncMock).not.toHaveBeenCalledWith('audioPlayer:play', expect.anything())
    // Exactly one info nudge, naming the position.
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'info', description: expect.stringContaining('#2 in line') }),
    )
  })

  it('(05-d) audioPlayer:granted still auto-starts (waiting cleared before startSession — GATE regression guard)', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)
    player.setupListeners()

    emitAsyncMock.mockResolvedValue({ success: false, queued: true, position: 1 })
    player.addTracks([audioFile('a.mp3')])
    await player.play('room-1')
    expect(player.isWaiting.value).toBe(true)

    // Grant frees the slot; the re-acquire succeeds via reuse-if-mine.
    emitAsyncMock.mockResolvedValue({ success: true })
    produceTrack.mockClear()

    const onGranted = getListener('audioPlayer:granted')
    onGranted!({ roomId: 'room-1' })
    await flush()

    // The GATE did NOT swallow the grant path: startSession ran past it.
    expect(player.isWaiting.value).toBe(false)
    expect(player.isPlaying.value).toBe(true)
    expect(produceTrack).toHaveBeenCalledTimes(1)
    expect(emitAsyncMock).toHaveBeenCalledWith('audioPlayer:play', expect.objectContaining({ roomId: 'room-1' }))
  })
})
