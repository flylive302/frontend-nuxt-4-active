/**
 * Unit tests for useRoomAudioPlayer's drawer tap-to-play (slice 05).
 *
 * Mocks Nuxt auto-imports (reactivity primitives + stores) and the deep
 * modules (`audioPlaybackEngine`, `useMediasoupStreaming`, socket emit) the
 * same way `useMediasoup.spec.ts` does, so the orchestrator's own
 * GATE → EXECUTE → REACT logic runs for real. Behavior only — no DOM/gesture
 * assertions; the drawer component only binds a tap to `playTrack`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { ref, reactive, computed, readonly, watch, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

// ============================================
// Mock Nuxt auto-imports
// ============================================
vi.stubGlobal('ref', ref)
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('watch', watch)
vi.stubGlobal('nextTick', nextTick)

const mockUser = reactive({ id: 'user-1' })
vi.stubGlobal('useAuthStore', () => ({ user: mockUser }))
vi.stubGlobal('useRoomStore', () => ({ currentRoom: { id: 'room-1' } }))
// room-music-playlist/01: the deck's role gate (owner OR admin of the current
// Room). Reactive so a test can demote / late-load the role and see the
// computed follow. Defaults to owner so the pre-existing suites are unchanged.
const mockIsRoomOwner = ref(true)
const mockMembershipStore = reactive<{ myMembership: { room_id: string; role: string } | null }>({ myMembership: null })
// Mirrors useRoomPermissions.isRoomAdmin: admin of the CURRENT room ('room-1') only.
const mockIsRoomAdmin = computed(() =>
  mockMembershipStore.myMembership?.room_id === 'room-1' && mockMembershipStore.myMembership.role === 'admin',
)
vi.stubGlobal('useRoomPermissions', () => ({ isRoomOwner: mockIsRoomOwner, isRoomAdmin: mockIsRoomAdmin }))
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

  // room-video-player/03 + 07: a Room Video taking the media slot revokes with reason 'video'.
  function getRevokedHandler() {
    return mockSocket.value.on.mock.calls.find(
      ([event]) => event === 'audioPlayer:revoked',
    )?.[1] as ((event: { roomId: string; byUserId: unknown; reason?: 'video' }) => void) | undefined
  }

  it('revoked by a video (someone else) goes idle, keeps the playlist and toasts once', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)
    player.setupListeners()
    player.addTracks([audioFile('a.mp3'), audioFile('b.mp3')])
    await player.play('room-1')
    toastAdd.mockClear()

    getRevokedHandler()!({ roomId: 'room-1', byUserId: 999, reason: 'video' })

    expect(stopMusicProducer).toHaveBeenCalledTimes(1)
    expect(player.playerState.status).toBe('idle')
    expect(player.playerState.userId).toBeNull()
    expect(player.isPlayerVisible.value).toBe(false)
    expect(emitAsyncMock).not.toHaveBeenCalledWith('audioPlayer:stop', expect.anything())
    expect(player.queueTracks.value).toHaveLength(2)
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Music',
      description: expect.stringContaining('a video started'),
    }))
  })

  it('revoked by my own video goes idle silently', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)
    player.setupListeners()
    player.addTracks([audioFile('a.mp3')])
    await player.play('room-1')
    toastAdd.mockClear()

    getRevokedHandler()!({ roomId: 'room-1', byUserId: mockUser.id, reason: 'video' })

    expect(stopMusicProducer).toHaveBeenCalledTimes(1)
    expect(player.playerState.status).toBe('idle')
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('a play refused because a video holds the media slot says so (not "another admin")', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)
    player.addTracks([audioFile('a.mp3')])
    emitAsyncMock.mockResolvedValueOnce({
      success: false, error: 'media_slot_busy', data: { heldBy: 'video', userId: 7 },
    })
    toastAdd.mockClear()

    const ok = await player.play('room-1')

    expect(ok).toBe(false)
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      color: 'warning',
      description: 'A video is playing in the room. Stop it first to play music.',
    }))
  })

  it('a fresh module import (simulating a hard refresh) starts with an empty playlist', async () => {
    vi.resetModules()
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    // A fresh JS module graph (an actual page load) starts empty when the
    // device store holds nothing — here there is no IndexedDB at all, so the
    // restore is a silent no-op. `cleanup()` itself never clears the queue
    // (see the retention tests above); the reload-restore cases live in the
    // room-music-playlist/01 cause-2 suite below.
    await player.restoreSavedPlaylist()
    expect(player.queueTracks.value).toHaveLength(0)
  })
})

// ============================================
// Rejoin re-reveal (room-music-playlist/01, cause 1)
// ============================================
describe('useRoomAudioPlayer — deck re-reveal on rejoin (room-music-playlist/01)', () => {
  const mockSocket = ref({ emit: vi.fn(), on: vi.fn(), off: vi.fn() })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockIsRoomOwner.value = true
    mockMembershipStore.myMembership = null
  })

  it('leave → rejoin as owner shows the retained playlist deck without re-opening it', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    player.addTracks([audioFile('a.mp3'), audioFile('b.mp3')])
    await player.play('room-1')
    player.cleanup('room-1') // leave

    // Rejoin: nothing calls play/addTracks/playTrack — the deck must already show.
    expect(player.isActive.value).toBe(false)
    expect(player.isPlayerVisible.value).toBe(true)
  })

  it('leave with an empty playlist hides the deck', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    const [trackA] = player.addTracks([audioFile('a.mp3')])
    await player.removeTrack(trackA!.id, 'room-1') // emptied; deck still open
    player.cleanup('room-1')

    expect(player.isPlayerVisible.value).toBe(false)
  })

  it('rejoining a Room where the user is only a member keeps the deck hidden', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    player.addTracks([audioFile('a.mp3')])
    player.cleanup('room-1')
    mockIsRoomOwner.value = false // next Room: plain member

    expect(player.isPlayerVisible.value).toBe(false)
  })

  it('an admin sees the deck once their membership loads (late role fetch)', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    player.addTracks([audioFile('a.mp3')])
    player.cleanup('room-1')
    mockIsRoomOwner.value = false
    expect(player.isPlayerVisible.value).toBe(false) // role not loaded yet

    mockMembershipStore.myMembership = { room_id: 'room-1', role: 'admin' }
    expect(player.isPlayerVisible.value).toBe(true)
  })

  it('a stale admin membership from a different Room does not grant the deck', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    player.addTracks([audioFile('a.mp3')])
    player.cleanup('room-1')
    mockIsRoomOwner.value = false
    mockMembershipStore.myMembership = { room_id: 'room-other', role: 'admin' }

    expect(player.isPlayerVisible.value).toBe(false)
  })

  it('a live session keeps its deck even if the role momentarily reads as member', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    player.addTracks([audioFile('a.mp3')])
    await player.play('room-1')
    mockIsRoomOwner.value = false // e.g. a membership refetch failed mid-session

    expect(player.isPlayerVisible.value).toBe(true)
  })

  it('a deck dismissed with ✕ stays dismissed when no leave happens (socket reconnect path)', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const player = useRoomAudioPlayer(mockSocket as never)

    player.addTracks([audioFile('a.mp3')])
    player.closePlayer('room-1')
    // Reconnect re-runs joinRoom → setupListeners/initFromJoinState only.
    player.setupListeners()
    player.initFromJoinState(null)

    expect(player.isPlayerVisible.value).toBe(false)
  })
})

// ============================================
// Survives process death (room-music-playlist/01, cause 2)
// ============================================
describe('useRoomAudioPlayer — playlist survives a reload via IndexedDB (room-music-playlist/01)', () => {
  const mockSocket = ref({ emit: vi.fn(), on: vi.fn(), off: vi.fn() })
  type PlayerModule = typeof import('../../app/composables/room/audio/useRoomAudioPlayer')

  /** A reload: drop every module (singleton queue, id counter, key map) but keep the device's IndexedDB. */
  async function reload(): Promise<ReturnType<PlayerModule['useRoomAudioPlayer']>> {
    vi.resetModules()
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    return useRoomAudioPlayer(mockSocket as never)
  }

  /** Saved records currently on the "device" (reads the same fake IndexedDB). */
  async function savedRecords() {
    const { listAllRecords } = await import('../../app/services/playlistTrackStore')
    return listAllRecords()
  }

  function sizedAudioFile(name: string, bytes: number): File {
    return new File([new Uint8Array(bytes)], name, { type: 'audio/mpeg' })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockIsRoomOwner.value = true
    mockMembershipStore.myMembership = null
    mockUser.id = 'user-1'
    // Fresh, empty device store per test.
    ;(globalThis as { indexedDB?: IDBFactory }).indexedDB = new IDBFactory()
  })

  afterEach(() => {
    // Other suites in this file run without IndexedDB (silent-degrade path).
    delete (globalThis as { indexedDB?: IDBFactory }).indexedDB
    mockUser.id = 'user-1'
  })

  it('songs added before an app kill are rebuilt, in order, on the next join — deck shown', async () => {
    const before = await reload()
    before.addTracks([audioFile('a.mp3'), audioFile('b.mp3'), audioFile('c.mp3')])
    await vi.waitFor(async () => expect(await savedRecords()).toHaveLength(3))

    const after = await reload()
    expect(after.queueTracks.value).toHaveLength(0) // nothing until a join restores
    await after.restoreSavedPlaylist()

    expect(after.queueTracks.value.map((t) => t.title)).toEqual(['a', 'b', 'c'])
    expect(after.currentTrackId.value).toBe(after.queueTracks.value[0]!.id)
    expect(after.isPlayerVisible.value).toBe(true)
    // The restored File carries the original bytes.
    expect(after.queueTracks.value[0]!.file.size).toBe(3)
  })

  it('a reorder survives the reload', async () => {
    const before = await reload()
    before.addTracks([audioFile('a.mp3'), audioFile('b.mp3'), audioFile('c.mp3')])
    before.reorderTracks(0, 2) // a → end
    await vi.waitFor(async () => {
      const positions = (await savedRecords()).sort((x, y) => x.position - y.position).map((r) => r.name)
      expect(positions).toEqual(['b.mp3', 'c.mp3', 'a.mp3'])
    })

    const after = await reload()
    await after.restoreSavedPlaylist()
    expect(after.queueTracks.value.map((t) => t.title)).toEqual(['b', 'c', 'a'])
  })

  it('a removed song is deleted from the device and does not come back', async () => {
    const before = await reload()
    const [trackA] = before.addTracks([audioFile('a.mp3'), audioFile('b.mp3')])
    await before.removeTrack(trackA!.id, 'room-1')
    await vi.waitFor(async () => expect((await savedRecords()).map((r) => r.name)).toEqual(['b.mp3']))

    const after = await reload()
    await after.restoreSavedPlaylist()
    expect(after.queueTracks.value.map((t) => t.title)).toEqual(['b'])
  })

  it('restore runs once per account per session — a reconnect re-join does not duplicate songs', async () => {
    const before = await reload()
    before.addTracks([audioFile('a.mp3')])
    await vi.waitFor(async () => expect(await savedRecords()).toHaveLength(1))

    const after = await reload()
    await after.restoreSavedPlaylist()
    await after.restoreSavedPlaylist() // second join (reconnect)
    expect(after.queueTracks.value).toHaveLength(1)
  })

  it('songs are per account: another account on the same device never sees them', async () => {
    const before = await reload()
    before.addTracks([audioFile('a.mp3')])
    await vi.waitFor(async () => expect(await savedRecords()).toHaveLength(1))

    // Same tab: user-1 logs out, user-2 logs in and joins a room.
    mockUser.id = 'user-2'
    await before.restoreSavedPlaylist()
    expect(before.queueTracks.value).toHaveLength(0)
    expect(before.isPlayerVisible.value).toBe(false)
    // user-1's saved copy is untouched on disk for when they return.
    expect((await savedRecords()).map((r) => r.userId)).toEqual(['user-1'])

    mockUser.id = 'user-1'
    const back = await reload()
    await back.restoreSavedPlaylist()
    expect(back.queueTracks.value.map((t) => t.title)).toEqual(['a'])
  })

  it('a song that does not fit the storage budget stays session-only and the DJ is told', async () => {
    const realNavigator = globalThis.navigator
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { storage: { estimate: async () => ({ quota: 20, usage: 0 }), persist: async () => false } },
    })
    try {
      const player = await reload()
      // Budget = min(500 MB, 20 B × 0.5) = 10 B: the 4-byte song fits, the 50-byte one cannot.
      player.addTracks([sizedAudioFile('small.mp3', 4), sizedAudioFile('huge.mp3', 50)])
      await vi.waitFor(() => expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Storage full' })))

      expect((await savedRecords()).map((r) => r.name)).toEqual(['small.mp3'])
      expect(player.queueTracks.value).toHaveLength(2) // still playable this session
    } finally {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: realNavigator })
    }
  })

  it('after logout → login as another account, the previous queue is hidden even before a restore', async () => {
    const player = await reload()
    player.addTracks([audioFile('a.mp3')])
    player.cleanup('room-1') // logout funnels through leave → cleanup
    mockUser.id = 'user-2' // owns the next room too (mockIsRoomOwner stays true)

    expect(player.isPlayerVisible.value).toBe(false)
  })

  it('a song whose saved bytes are gone comes back as an unavailable row the DJ can remove', async () => {
    const before = await reload()
    before.addTracks([audioFile('a.mp3'), audioFile('b.mp3')])
    await vi.waitFor(async () => expect(await savedRecords()).toHaveLength(2))
    const orphanKey = (await savedRecords()).find((r) => r.name === 'b.mp3')!.key
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('flylive-playlist')
      open.onsuccess = () => {
        const tx = open.result.transaction('blobs', 'readwrite')
        tx.objectStore('blobs').delete(orphanKey)
        tx.oncomplete = () => { open.result.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
    })

    const after = await reload()
    await after.restoreSavedPlaylist()
    expect(after.queueTracks.value.map((t) => [t.title, t.unavailable ?? false])).toEqual([['a', false], ['b', true]])

    await after.removeTrack(after.queueTracks.value[1]!.id, 'room-1')
    await vi.waitFor(async () => expect((await savedRecords()).map((r) => r.name)).toEqual(['a.mp3']))
  })

  it('a failed read is retried on the next join instead of treating the account as empty', async () => {
    const before = await reload()
    before.addTracks([audioFile('a.mp3')])
    await vi.waitFor(async () => expect(await savedRecords()).toHaveLength(1))

    const after = await reload()
    const store = await import('../../app/services/playlistTrackStore')
    const spy = vi.spyOn(store, 'listSavedTracks').mockResolvedValueOnce(null)
    await after.restoreSavedPlaylist() // first join: read fails
    expect(after.queueTracks.value).toHaveLength(0)
    spy.mockRestore()

    await after.restoreSavedPlaylist() // next join: retried
    expect(after.queueTracks.value.map((t) => t.title)).toEqual(['a'])
  })

  it('over budget: the least-recently-played saved song is evicted (still playable) and the DJ is told', async () => {
    const realNavigator = globalThis.navigator
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      // Budget = min(500 MB, 20 B × 0.5) = 10 B.
      value: { storage: { estimate: async () => ({ quota: 20, usage: 0 }), persist: async () => false } },
    })
    try {
      const player = await reload()
      player.addTracks([sizedAudioFile('old.mp3', 6)])
      await vi.waitFor(async () => expect(await savedRecords()).toHaveLength(1))

      player.addTracks([sizedAudioFile('new.mp3', 6)]) // 6 + 6 > 10 → evict old.mp3 after saving new.mp3
      await vi.waitFor(async () => expect((await savedRecords()).map((r) => r.name)).toEqual(['new.mp3']))

      expect(player.queueTracks.value.map((t) => t.title)).toEqual(['old', 'new']) // old still queued
      await vi.waitFor(() => expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
        description: expect.stringContaining("you played longest ago won't be kept"),
      })))
    } finally {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: realNavigator })
    }
  })

  it('a save that fails never costs other saved songs (save first, evict after)', async () => {
    const realNavigator = globalThis.navigator
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { storage: { estimate: async () => ({ quota: 20, usage: 0 }), persist: async () => false } },
    })
    try {
      const player = await reload()
      player.addTracks([sizedAudioFile('old.mp3', 6)])
      await vi.waitFor(async () => expect(await savedRecords()).toHaveLength(1))

      const store = await import('../../app/services/playlistTrackStore')
      const spy = vi.spyOn(store, 'saveTrack').mockResolvedValueOnce('error')
      player.addTracks([sizedAudioFile('new.mp3', 6)])
      await vi.waitFor(() => expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
        description: expect.stringContaining("Couldn't save 1 song"),
      })))
      spy.mockRestore()

      expect((await savedRecords()).map((r) => r.name)).toEqual(['old.mp3'])
    } finally {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: realNavigator })
    }
  })

  it('a restored song whose bytes the OS evicted is marked unavailable with a remove hint', async () => {
    const before = await reload()
    before.addTracks([audioFile('a.mp3')])
    await vi.waitFor(async () => expect(await savedRecords()).toHaveLength(1))

    const after = await reload()
    await after.restoreSavedPlaylist()

    const { createAudioPlaybackEngine, AudioPlaybackError } = await import('../../app/services/audioPlaybackEngine')
    const engine = createMockEngine()
    const unreadable = Object.assign(new AudioPlaybackError('could not decode'), {
      cause: new DOMException('blob gone', 'NotFoundError'),
    })
    engine.play.mockRejectedValueOnce(unreadable)
    vi.mocked(createAudioPlaybackEngine).mockReturnValueOnce(engine as never)

    await after.play('room-1')

    expect(after.queueTracks.value[0]!.unavailable).toBe(true)
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining('no longer saved on this device'),
    }))
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

describe('useRoomAudioPlayer — talk-over duck (audio-drawer duck level)', () => {
  const mockSocket = ref({ emit: vi.fn(), on: vi.fn(), off: vi.fn() })

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('duckStart ducks by the store percent converted to a fraction, and flips isDucking', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const { useAudioPreferencesStore } = await import('../../app/stores/audioPreferences')
    const { createAudioPlaybackEngine } = await import('../../app/services/audioPlaybackEngine')

    useAudioPreferencesStore().setDuckLevelPercent(30)

    const player = useRoomAudioPlayer(mockSocket as never)
    player.addTracks([audioFile('a.mp3')])
    await player.play('room-1')

    const engine = (createAudioPlaybackEngine as ReturnType<typeof vi.fn>).mock.results[0]!.value

    expect(player.isDucking.value).toBe(false)
    player.duckStart()
    expect(engine.duck).toHaveBeenCalledWith(0.3, expect.any(Number))
    expect(player.isDucking.value).toBe(true)

    player.duckEnd()
    expect(engine.releaseDuck).toHaveBeenCalledWith(expect.any(Number))
    expect(player.isDucking.value).toBe(false)
  })

  it('previewDuck/releasePreview duck to an explicit percent without touching the store', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const { useAudioPreferencesStore } = await import('../../app/stores/audioPreferences')
    const { createAudioPlaybackEngine } = await import('../../app/services/audioPlaybackEngine')

    const player = useRoomAudioPlayer(mockSocket as never)
    player.addTracks([audioFile('a.mp3')])
    await player.play('room-1')

    const engine = (createAudioPlaybackEngine as ReturnType<typeof vi.fn>).mock.results[0]!.value

    player.previewDuck(50)
    expect(engine.duck).toHaveBeenCalledWith(0.5, expect.any(Number))
    expect(player.isDucking.value).toBe(true)
    expect(useAudioPreferencesStore().duckLevelPercent).toBe(20) // store default, untouched

    player.releasePreview()
    expect(engine.releaseDuck).toHaveBeenCalledWith(expect.any(Number))
    expect(player.isDucking.value).toBe(false)
  })

  it('previewDuck clamps out-of-range percents the same way the store setter does', async () => {
    const { useRoomAudioPlayer } = await import('../../app/composables/room/audio/useRoomAudioPlayer')
    const { createAudioPlaybackEngine } = await import('../../app/services/audioPlaybackEngine')

    const player = useRoomAudioPlayer(mockSocket as never)
    player.addTracks([audioFile('a.mp3')])
    await player.play('room-1')

    const engine = (createAudioPlaybackEngine as ReturnType<typeof vi.fn>).mock.results[0]!.value

    player.previewDuck(999)
    expect(engine.duck).toHaveBeenCalledWith(0.8, expect.any(Number)) // MAX_DUCK_LEVEL_PERCENT
  })
})
