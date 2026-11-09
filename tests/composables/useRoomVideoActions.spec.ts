/**
 * Unit tests for useRoomVideoActions: start / takeover / stop / pause / resume / seek
 * through GATE -> EXECUTE -> REACT, plus the silent heartbeat / ended transport.
 * Real Pinia store; the socket emit, toast, hierarchy and logger are fakes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import { ROOM_SOCKET_NOT_AUTHORIZED, ROOM_VIDEO_ERROR, ROOM_VIDEO_URL_MAX_LENGTH } from '../../app/constants/room'
import type { RoomRank } from '../../app/utils/room-hierarchy'
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
const myRank = ref<RoomRank>('admin')
vi.stubGlobal('useRoomHierarchy', () => ({ canModerate, myRank }))

vi.stubGlobal('useAudioSocket', () => ({ socket: ref({}) }))

// ============================================
// Module mocks
// ============================================
const emitAsyncMock = vi.fn<(event: string, payload: unknown) => Promise<VideoPlayerAck>>()
vi.mock('~/utils/socket', () => ({
  createEmitAsync: () => emitAsyncMock,
}))

const logDebug = vi.fn()
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: logDebug, info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
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
  logDebug.mockReset()
  canModerate.value = true
  myRank.value = 'admin'
})

// ============================================================
// start — GATE
// ============================================================
describe('start — GATE refusals emit nothing and toast once', () => {
  it('feature disabled for this room', async () => {
    const { start } = await setup({ enabled: false })

    const result = await start(YOUTUBE_LINK)

    expect(result).toEqual({ ok: false, canTakeOver: false })
    expect(emitAsyncMock).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(lastToast().description).toBe("Room Video isn't available right now.")
  })

  it('not in a room (no session started)', async () => {
    const { start } = await setup({ joinedRoom: null })

    const result = await start(YOUTUBE_LINK)

    expect(result).toEqual({ ok: false, canTakeOver: false })
    expect(emitAsyncMock).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(lastToast().description).toBe("Room Video isn't available right now.")
  })

  it('viewer is not an owner / admin', async () => {
    canModerate.value = false
    const { start } = await setup()

    const result = await start(YOUTUBE_LINK)

    expect(result).toEqual({ ok: false, canTakeOver: false })
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

    expect(result).toEqual({ ok: false, canTakeOver: false })
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

    expect(result).toEqual({ ok: true })
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

    expect(result).toEqual({ ok: false, canTakeOver: false })
    expect(emitAsyncMock).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ description: copy, color }))
  })

  it('a rejected emit (timeout / disconnect) gives the generic toast and false', async () => {
    emitAsyncMock.mockRejectedValue(new Error("Socket event 'videoPlayer:play' timed out"))
    const { start } = await setup()

    const result = await start(YOUTUBE_LINK)

    expect(result).toEqual({ ok: false, canTakeOver: false })
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


// ============================================================
// start — owner meets a busy slot (drawer offers "Take over")
// ============================================================
describe('start — owner on a busy media slot', () => {
  const MP4_LINK = 'https://cdn.example.com/clips/a.mp4'

  it.each([
    ['music', { heldBy: 'music', userId: 3 }],
    ['video', { heldBy: 'video', userId: 3 }],
  ] as const)('held by %s: canTakeOver, heldBy reported, no toast', async (heldBy, data) => {
    myRank.value = 'owner'
    emitAsyncMock.mockResolvedValue({ success: false, error: ROOM_VIDEO_ERROR.MEDIA_SLOT_BUSY, data })
    const { start } = await setup()

    const result = await start(MP4_LINK)

    expect(result).toEqual({ ok: false, canTakeOver: true, heldBy })
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('busy without holder data still offers the takeover, no toast', async () => {
    myRank.value = 'owner'
    emitAsyncMock.mockResolvedValue({ success: false, error: ROOM_VIDEO_ERROR.MEDIA_SLOT_BUSY })
    const { start } = await setup()

    const result = await start(MP4_LINK)

    expect(result).toEqual({ ok: false, canTakeOver: true, heldBy: undefined })
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('an admin on the same busy ack gets the toast and no takeover offer', async () => {
    myRank.value = 'admin'
    emitAsyncMock.mockResolvedValue({
      success: false,
      error: ROOM_VIDEO_ERROR.MEDIA_SLOT_BUSY,
      data: { heldBy: 'music', userId: 3 },
    })
    const { start } = await setup()

    const result = await start(MP4_LINK)

    expect(result).toEqual({ ok: false, canTakeOver: false })
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(lastToast().description).toBe('Music is playing — ask the DJ to stop it first.')
  })

  it('an owner whose failure is NOT a busy slot still gets the toast', async () => {
    myRank.value = 'owner'
    emitAsyncMock.mockResolvedValue({ success: false, error: ROOM_VIDEO_ERROR.SOURCE_INVALID })
    const { start } = await setup()

    const result = await start(MP4_LINK)

    expect(result).toEqual({ ok: false, canTakeOver: false })
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(lastToast().description).toBe("That link can't be played.")
  })
})

// ============================================================
// takeover
// ============================================================
describe('takeover', () => {
  const MP4_LINK = 'https://cdn.example.com/clips/a.mp4'
  const MP4_SOURCE = { kind: 'url', url: MP4_LINK, container: 'mp4' }

  it('refuses a non-owner (admin): no emit, one toast, false', async () => {
    myRank.value = 'admin'
    const { takeover } = await setup()

    const result = await takeover(MP4_LINK)

    expect(result).toBe(false)
    expect(emitAsyncMock).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(lastToast().description).toBe('Only the room owner can take over.')
  })

  it('refuses a plain member', async () => {
    myRank.value = 'member'
    const { takeover } = await setup()

    expect(await takeover(MP4_LINK)).toBe(false)
    expect(emitAsyncMock).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledTimes(1)
  })

  it('refuses when the feature is off or no room is joined', async () => {
    myRank.value = 'owner'
    const off = await setup({ enabled: false })
    expect(await off.takeover(MP4_LINK)).toBe(false)
    expect(lastToast().description).toBe("Room Video isn't available right now.")

    toastAdd.mockClear()
    setActivePinia(createPinia())
    const noRoom = await setup({ joinedRoom: null })
    expect(await noRoom.takeover(MP4_LINK)).toBe(false)
    expect(lastToast().description).toBe("Room Video isn't available right now.")
    expect(emitAsyncMock).not.toHaveBeenCalled()
  })

  it('refuses an unplayable link: no emit, one toast', async () => {
    myRank.value = 'owner'
    const { takeover } = await setup()

    expect(await takeover('http://example.com/clip.mp4')).toBe(false)
    expect(emitAsyncMock).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(lastToast().description).toBe('Use an https:// link.')
  })

  it('the owner emits videoPlayer:takeover with the play payload, returns true, no toast', async () => {
    myRank.value = 'owner'
    const { takeover } = await setup()

    const result = await takeover(`  ${MP4_LINK}  `)

    expect(result).toBe(true)
    expect(emitAsyncMock).toHaveBeenCalledTimes(1)
    expect(emitAsyncMock).toHaveBeenCalledWith('videoPlayer:takeover', { roomId: ROOM_ID, source: MP4_SOURCE })
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('works while only music holds the slot (no active video needed)', async () => {
    myRank.value = 'owner'
    const { takeover } = await setup({ snapshot: null })

    expect(await takeover(MP4_LINK)).toBe(true)
    expect(emitAsyncMock).toHaveBeenCalledTimes(1)
  })

  const failures: Array<[string, VideoPlayerAck, string, string]> = [
    ['not authorized', { success: false, error: ROOM_SOCKET_NOT_AUTHORIZED }, 'Only the room owner can take over.', 'warning'],
    ['feature disabled on the server', { success: false, error: ROOM_VIDEO_ERROR.DISABLED }, "Room Video isn't available right now.", 'warning'],
    ['server rejected the source', { success: false, error: ROOM_VIDEO_ERROR.SOURCE_INVALID }, "That link can't be played.", 'warning'],
    ['unknown error string', { success: false, error: 'something_else' }, "Couldn't take over. Try again.", 'error'],
  ]

  it.each(failures)('%s: one toast, returns false', async (_name, ack, copy, color) => {
    myRank.value = 'owner'
    emitAsyncMock.mockResolvedValue(ack)
    const { takeover } = await setup()

    expect(await takeover(MP4_LINK)).toBe(false)
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ description: copy, color }))
  })

  it('a rejected emit gives the generic takeover toast and false', async () => {
    myRank.value = 'owner'
    emitAsyncMock.mockRejectedValue(new Error('Socket not connected'))
    const { takeover } = await setup()

    expect(await takeover(MP4_LINK)).toBe(false)
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(lastToast().description).toBe("Couldn't take over. Try again.")
  })
})

// ============================================================
// pause / resume / seek
// ============================================================
describe('pause / resume / seek', () => {
  const POSITION_SEC = 42.5
  const cases = [
    ['pause', 'videoPlayer:pause', "Couldn't pause the video. Try again."],
    ['resume', 'videoPlayer:resume', "Couldn't resume the video. Try again."],
    ['seek', 'videoPlayer:seek', "Couldn't move the video. Try again."],
  ] as const

  describe.each(cases)('%s', (action, event, failedCopy) => {
    it('refuses a viewer who is not the Controller: no emit, one toast, false', async () => {
      const actions = await setup({ snapshot: makeSnapshot({ controllerUserId: CURRENT_USER_ID + 1 }) })

      const result = await actions[action](POSITION_SEC)

      expect(result).toBe(false)
      expect(emitAsyncMock).not.toHaveBeenCalled()
      expect(toastAdd).toHaveBeenCalledTimes(1)
      expect(lastToast().description).toBe('Only the person controlling the video can do that.')
    })

    it('refuses when no video is playing', async () => {
      const actions = await setup({ snapshot: null })

      expect(await actions[action](POSITION_SEC)).toBe(false)
      expect(emitAsyncMock).not.toHaveBeenCalled()
      expect(toastAdd).toHaveBeenCalledTimes(1)
    })

    it('refuses when the feature is disabled even with a stale snapshot', async () => {
      const actions = await setup({ enabled: false, snapshot: makeSnapshot() })

      expect(await actions[action](POSITION_SEC)).toBe(false)
      expect(emitAsyncMock).not.toHaveBeenCalled()
      expect(toastAdd).toHaveBeenCalledTimes(1)
    })

    it('the Controller emits the event with {roomId, positionSec}, gets true, no toast', async () => {
      const actions = await setup({ snapshot: makeSnapshot() })

      const result = await actions[action](POSITION_SEC)

      expect(result).toBe(true)
      expect(emitAsyncMock).toHaveBeenCalledTimes(1)
      expect(emitAsyncMock).toHaveBeenCalledWith(event, { roomId: ROOM_ID, positionSec: POSITION_SEC })
      expect(toastAdd).not.toHaveBeenCalled()
    })

    it('a failed ack gives one toast and false', async () => {
      emitAsyncMock.mockResolvedValue({ success: false, error: ROOM_SOCKET_NOT_AUTHORIZED })
      const actions = await setup({ snapshot: makeSnapshot() })

      expect(await actions[action](POSITION_SEC)).toBe(false)
      expect(toastAdd).toHaveBeenCalledTimes(1)
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ description: failedCopy, color: 'error' }))
    })

    it('a rejected emit gives one toast and false', async () => {
      emitAsyncMock.mockRejectedValue(new Error("Socket event timed out"))
      const actions = await setup({ snapshot: makeSnapshot() })

      expect(await actions[action](POSITION_SEC)).toBe(false)
      expect(toastAdd).toHaveBeenCalledTimes(1)
      expect(lastToast().description).toBe(failedCopy)
    })
  })
})

// ============================================================
// heartbeat / ended (silent RoomVideoTransport)
// ============================================================
describe('heartbeat / ended', () => {
  /** Let a fire-and-forget emit (and its catch) settle. */
  const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0))

  it('heartbeat emits {roomId, positionSec, paused} when Controller', async () => {
    const { heartbeat } = await setup({ snapshot: makeSnapshot() })

    heartbeat(12.5, true)
    await flush()

    expect(emitAsyncMock).toHaveBeenCalledTimes(1)
    expect(emitAsyncMock).toHaveBeenCalledWith('videoPlayer:heartbeat', { roomId: ROOM_ID, positionSec: 12.5, paused: true })
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('ended emits {roomId} when Controller', async () => {
    const { ended } = await setup({ snapshot: makeSnapshot() })

    ended()
    await flush()

    expect(emitAsyncMock).toHaveBeenCalledTimes(1)
    expect(emitAsyncMock).toHaveBeenCalledWith('videoPlayer:ended', { roomId: ROOM_ID })
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('both emit nothing and never toast for a non-Controller', async () => {
    const { heartbeat, ended } = await setup({ snapshot: makeSnapshot({ controllerUserId: CURRENT_USER_ID + 1 }) })

    heartbeat(1, false)
    ended()
    await flush()

    expect(emitAsyncMock).not.toHaveBeenCalled()
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('both emit nothing when there is no snapshot or no joined room', async () => {
    const noVideo = await setup({ snapshot: null })
    noVideo.heartbeat(1, false)
    noVideo.ended()

    setActivePinia(createPinia())
    const noRoom = await setup({ joinedRoom: null })
    noRoom.heartbeat(1, false)
    noRoom.ended()
    await flush()

    expect(emitAsyncMock).not.toHaveBeenCalled()
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('swallows a rejected emit: no throw, no toast, one debug line each', async () => {
    emitAsyncMock.mockRejectedValue(new Error('Socket not connected'))
    const { heartbeat, ended } = await setup({ snapshot: makeSnapshot() })

    expect(() => heartbeat(1, false)).not.toThrow()
    expect(() => ended()).not.toThrow()
    await flush()

    expect(emitAsyncMock).toHaveBeenCalledTimes(2)
    expect(toastAdd).not.toHaveBeenCalled()
    expect(logDebug).toHaveBeenCalledTimes(2)
  })

  it('a refused ack is also silent (debug only)', async () => {
    emitAsyncMock.mockResolvedValue({ success: false, error: ROOM_SOCKET_NOT_AUTHORIZED })
    const { heartbeat } = await setup({ snapshot: makeSnapshot() })

    heartbeat(1, false)
    await flush()

    expect(toastAdd).not.toHaveBeenCalled()
    expect(logDebug).toHaveBeenCalledTimes(1)
  })

  it('returns void synchronously (does not hand the promise to the caller)', async () => {
    const { heartbeat, ended } = await setup({ snapshot: makeSnapshot() })

    expect(heartbeat(1, false)).toBeUndefined()
    expect(ended()).toBeUndefined()
    await flush()
  })
})
