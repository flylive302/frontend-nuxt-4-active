/**
 * Unit tests for useRoomVideoActions: start / stop through GATE -> EXECUTE -> REACT.
 * Real Pinia store; the socket emit, toast, hierarchy and logger are fakes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import { ROOM_SOCKET_NOT_AUTHORIZED, ROOM_VIDEO_ERROR, ROOM_VIDEO_URL_MAX_LENGTH } from '../../app/constants/room'
import type { RoomVideoSnapshot, VideoPlayerAck, VideoSourceError } from '../../app/types/room/video'

// ============================================
// Nuxt auto-imports
// ============================================
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

const CURRENT_USER_ID = 7
vi.stubGlobal('useAuthStore', () => ({ user: { id: CURRENT_USER_ID } }))

const toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: toastAdd }))

const canModerate = ref(true)
vi.stubGlobal('useRoomHierarchy', () => ({ canModerate }))

vi.stubGlobal('useAudioSocket', () => ({ socket: ref({}) }))

// ============================================
// Module mocks
// ============================================
const emitAsyncMock = vi.fn<(event: string, payload: unknown) => Promise<VideoPlayerAck>>()
vi.mock('~/utils/socket', () => ({
  createEmitAsync: () => emitAsyncMock,
}))

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

// ============================================
// Fixtures
// ============================================
const ROOM_ID = 'room-9'
const YOUTUBE_ID = 'dQw4w9WgXcQ'
const YOUTUBE_LINK = `https://youtu.be/${YOUTUBE_ID}`

const GENERIC_START_FAILURE = "Couldn't start the video. Try again."
const GENERIC_STOP_FAILURE = "Couldn't stop the video. Try again."

function makeSnapshot(overrides: Partial<RoomVideoSnapshot> = {}): RoomVideoSnapshot {
  return {
    controllerUserId: CURRENT_USER_ID,
    source: { kind: 'youtube', videoId: YOUTUBE_ID },
    paused: false,
    positionAtTs: 0,
    serverTs: 1_000,
    revision: 1,
    ...overrides,
  }
}

async function setup(options: { enabled?: boolean; joinedRoom?: string | null; snapshot?: RoomVideoSnapshot | null } = {}) {
  const { enabled = true, joinedRoom = ROOM_ID, snapshot = null } = options
  const { useRoomVideoStore } = await import('../../app/stores/roomVideo')
  const { useRoomVideoActions } = await import('../../app/composables/room/video/useRoomVideoActions')

  const store = useRoomVideoStore()
  if (joinedRoom !== null) store.startSession(joinedRoom, enabled)
  if (snapshot) store.replaceSnapshot(snapshot)

  return { store, ...useRoomVideoActions() }
}

function lastToast(): { title?: string; description?: string; color?: string } {
  return toastAdd.mock.calls.at(-1)?.[0] ?? {}
}

beforeEach(() => {
  setActivePinia(createPinia())
  toastAdd.mockReset()
  emitAsyncMock.mockReset()
  emitAsyncMock.mockResolvedValue({ success: true })
  canModerate.value = true
})

// ============================================================
// start — GATE
// ============================================================
describe('start — GATE refusals emit nothing and toast once', () => {
  it('feature disabled for this room', async () => {
    const { start } = await setup({ enabled: false })

    const result = await start(YOUTUBE_LINK)

    expect(result).toBe(false)
    expect(emitAsyncMock).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(lastToast().description).toBe("Room Video isn't available right now.")
  })

  it('not in a room (no session started)', async () => {
    const { start } = await setup({ joinedRoom: null })

    const result = await start(YOUTUBE_LINK)

    expect(result).toBe(false)
    expect(emitAsyncMock).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(lastToast().description).toBe("Room Video isn't available right now.")
  })

  it('viewer is not an owner / admin', async () => {
    canModerate.value = false
    const { start } = await setup()

    const result = await start(YOUTUBE_LINK)

    expect(result).toBe(false)
    expect(emitAsyncMock).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(lastToast().description).toBe('Only the room owner and admins can start a video.')
  })

  it('checks run in order: feature first, then role, then the link', async () => {
    canModerate.value = false
    const disabled = await setup({ enabled: false })
    await disabled.start('')
    expect(lastToast().description).toBe("Room Video isn't available right now.")

    toastAdd.mockClear()
    setActivePinia(createPinia())
    const notModerator = await setup()
    await notModerator.start('')
    expect(lastToast().description).toBe('Only the room owner and admins can start a video.')
  })

  const parseCases: Array<[VideoSourceError, string, string]> = [
    ['empty', '   ', 'Paste a video link first.'],
    ['too_long', `https://example.com/${'a'.repeat(ROOM_VIDEO_URL_MAX_LENGTH)}.mp4`, 'That link is too long.'],
    ['invalid_url', 'not a url', "That doesn't look like a link."],
    ['not_https', 'http://example.com/clip.mp4', 'Use an https:// link.'],
    ['unsupported_scheme', 'javascript:alert(1)', 'Only web links can be played.'],
    ['youtube_playlist', 'https://www.youtube.com/playlist?list=PL1234567890', 'Paste one video, not a playlist.'],
    ['youtube_channel', 'https://www.youtube.com/@someone', 'Paste one video, not a channel.'],
    ['not_media', 'https://example.com/page', 'Use a YouTube link, or a direct .mp4 or .m3u8 link.'],
  ]

  it.each(parseCases)('parse error %s: one toast, no emit, returns false', async (_error, input, copy) => {
    const { start } = await setup()

    const result = await start(input)

    expect(result).toBe(false)
    expect(emitAsyncMock).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(lastToast().description).toBe(copy)
  })
})

// ============================================================
// start — EXECUTE + REACT
// ============================================================
describe('start — EXECUTE', () => {
  it('a YouTube link emits videoPlayer:play with the exact payload, returns true, no toast', async () => {
    const { start } = await setup()

    const result = await start(`  ${YOUTUBE_LINK}  `)

    expect(result).toBe(true)
    expect(emitAsyncMock).toHaveBeenCalledTimes(1)
    expect(emitAsyncMock).toHaveBeenCalledWith('videoPlayer:play', {
      roomId: ROOM_ID,
      source: { kind: 'youtube', videoId: YOUTUBE_ID },
    })
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('a direct https .mp4 link emits a url source with its container', async () => {
    const { start } = await setup()

    await start('https://cdn.example.com/clips/a.mp4')

    expect(emitAsyncMock).toHaveBeenCalledWith('videoPlayer:play', {
      roomId: ROOM_ID,
      source: { kind: 'url', url: 'https://cdn.example.com/clips/a.mp4', container: 'mp4' },
    })
  })

  it('does not write to the store itself (state arrives via the stateChanged event)', async () => {
    const { start, store } = await setup()

    await start(YOUTUBE_LINK)

    expect(store.snapshot).toBeNull()
  })
})

describe('start — REACT to a failed ack', () => {
  const failures: Array<[string, VideoPlayerAck, string, string]> = [
    [
      'media slot held by music',
      { success: false, error: ROOM_VIDEO_ERROR.MEDIA_SLOT_BUSY, data: { heldBy: 'music', userId: 3 } },
      'Music is playing — ask the DJ to stop it first.',
      'warning',
    ],
    [
      'media slot held by another video',
      { success: false, error: ROOM_VIDEO_ERROR.MEDIA_SLOT_BUSY, data: { heldBy: 'video', userId: 3 } },
      'Another video is already playing.',
      'warning',
    ],
    [
      'media slot busy without holder data',
      { success: false, error: ROOM_VIDEO_ERROR.MEDIA_SLOT_BUSY },
      GENERIC_START_FAILURE,
      'error',
    ],
    [
      'feature disabled on the server',
      { success: false, error: ROOM_VIDEO_ERROR.DISABLED },
      "Room Video isn't available right now.",
      'warning',
    ],
    [
      'server rejected the source',
      { success: false, error: ROOM_VIDEO_ERROR.SOURCE_INVALID },
      "That link can't be played.",
      'warning',
    ],
    [
      'not authorized',
      { success: false, error: ROOM_SOCKET_NOT_AUTHORIZED },
      'Only the room owner and admins can start a video.',
      'warning',
    ],
    ['unknown error string', { success: false, error: 'something_else' }, GENERIC_START_FAILURE, 'error'],
  ]

  it.each(failures)('%s: one toast, returns false', async (_name, ack, copy, color) => {
    emitAsyncMock.mockResolvedValue(ack)
    const { start } = await setup()

    const result = await start(YOUTUBE_LINK)

    expect(result).toBe(false)
    expect(emitAsyncMock).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ description: copy, color }))
  })

  it('a rejected emit (timeout / disconnect) gives the generic toast and false', async () => {
    emitAsyncMock.mockRejectedValue(new Error("Socket event 'videoPlayer:play' timed out"))
    const { start } = await setup()

    const result = await start(YOUTUBE_LINK)

    expect(result).toBe(false)
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ description: GENERIC_START_FAILURE, color: 'error' }))
  })
})

// ============================================================
// stop
// ============================================================
describe('stop', () => {
  it('refuses a viewer who is not the Controller: no emit, one toast, false', async () => {
    const { stop } = await setup({ snapshot: makeSnapshot({ controllerUserId: CURRENT_USER_ID + 1 }) })

    const result = await stop()

    expect(result).toBe(false)
    expect(emitAsyncMock).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(lastToast().description).toBe('Only the person controlling the video can stop it.')
  })

  it('refuses when no video is playing: no emit, false', async () => {
    const { stop } = await setup({ snapshot: null })

    const result = await stop()

    expect(result).toBe(false)
    expect(emitAsyncMock).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledTimes(1)
  })

  it('refuses when the feature is disabled even if a stale snapshot is held', async () => {
    const { stop } = await setup({ enabled: false, snapshot: makeSnapshot() })

    const result = await stop()

    expect(result).toBe(false)
    expect(emitAsyncMock).not.toHaveBeenCalled()
  })

  it('the Controller emits videoPlayer:stop with the room id and gets true, no toast', async () => {
    const { stop } = await setup({ snapshot: makeSnapshot() })

    const result = await stop()

    expect(result).toBe(true)
    expect(emitAsyncMock).toHaveBeenCalledTimes(1)
    expect(emitAsyncMock).toHaveBeenCalledWith('videoPlayer:stop', { roomId: ROOM_ID })
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('a failed ack gives the generic stop toast and false', async () => {
    emitAsyncMock.mockResolvedValue({ success: false, error: ROOM_SOCKET_NOT_AUTHORIZED })
    const { stop } = await setup({ snapshot: makeSnapshot() })

    const result = await stop()

    expect(result).toBe(false)
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ description: GENERIC_STOP_FAILURE, color: 'error' }))
  })

  it('a rejected emit gives the generic stop toast and false', async () => {
    emitAsyncMock.mockRejectedValue(new Error('Socket not connected'))
    const { stop } = await setup({ snapshot: makeSnapshot() })

    const result = await stop()

    expect(result).toBe(false)
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(lastToast().description).toBe(GENERIC_STOP_FAILURE)
  })
})
