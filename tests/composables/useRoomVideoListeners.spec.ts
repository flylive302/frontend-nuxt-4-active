/**
 * Unit tests for useRoomVideoListeners: join-ack hydration + the two
 * `videoPlayer:*` socket handlers. Real Pinia store; only the socket, the toast
 * and the logger are fakes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import type {
  RoomVideoSnapshot,
  VideoPlayerRevokedEvent,
  VideoPlayerStateChangedEvent,
} from '../../app/types/room/video'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('useAuthStore', () => ({ user: { id: 7 } }))

const toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: toastAdd }))

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

const STATE_CHANGED = 'videoPlayer:stateChanged'
const REVOKED = 'videoPlayer:revoked'
const ROOM_ID = 'room-1'
const NOW_MS = 1_700_000_000_000

type Handler = (...args: never[]) => void

/**
 * Models real Socket.IO semantics: an array per event (the SAME function registered
 * twice fires twice), `off(name)` strips ALL listeners, `off(name, fn)` removes one.
 */
function createFakeSocket() {
  const listeners = new Map<string, Handler[]>()
  return {
    listeners,
    on: vi.fn((event: string, handler: Handler) => {
      listeners.set(event, [...(listeners.get(event) ?? []), handler])
    }),
    off: vi.fn((event: string, handler?: Handler) => {
      if (handler === undefined) {
        listeners.delete(event)
        return
      }
      const held = listeners.get(event) ?? []
      const index = held.indexOf(handler)
      if (index !== -1) listeners.set(event, held.filter((_, i) => i !== index))
    }),
    count(event: string): number {
      return listeners.get(event)?.length ?? 0
    },
    /** The single registered handler for an event. */
    handler(event: string): Handler {
      const [first] = listeners.get(event) ?? []
      if (!first) throw new Error(`no listener for ${event}`)
      return first
    },
  }
}
type FakeSocket = ReturnType<typeof createFakeSocket>

function makeSnapshot(overrides: Partial<RoomVideoSnapshot> = {}): RoomVideoSnapshot {
  return {
    controllerUserId: 7,
    source: { kind: 'youtube', videoId: 'dQw4w9WgXcQ' },
    paused: false,
    positionAtTs: 0,
    serverTs: NOW_MS + 250,
    revision: 1,
    ...overrides,
  }
}

async function setup() {
  const { useRoomVideoStore } = await import('../../app/stores/roomVideo')
  const { useRoomVideoListeners } = await import('../../app/composables/room/video/useRoomVideoListeners')
  const store = useRoomVideoStore()
  const socket = createFakeSocket()
  const socketRef = ref<FakeSocket | null>(socket)
  const listeners = useRoomVideoListeners(socketRef as never)
  // The module-scope `boundSocket` survives across tests: start from a clean slate.
  listeners.cleanupListeners()
  socket.on.mockClear()
  socket.off.mockClear()
  return { store, socket, socketRef, ...listeners }
}

beforeEach(() => {
  setActivePinia(createPinia())
  toastAdd.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('applyJoinAck', () => {
  it('enabled: binds the room, takes the snapshot and records the first clock sample', async () => {
    const { store, applyJoinAck } = await setup()
    const snapshot = makeSnapshot({ revision: 4 })

    applyJoinAck(ROOM_ID, { videoPlayerEnabled: true, videoPlayer: snapshot, serverNow: NOW_MS + 300 }, NOW_MS)

    expect(store.roomId).toBe(ROOM_ID)
    expect(store.enabled).toBe(true)
    expect(store.snapshot).toEqual(snapshot)
    expect(store.clockSamples).toEqual([300])
    expect(store.clockOffsetMs).toBe(300)
  })

  it('enabled with no live video: snapshot stays null', async () => {
    const { store, applyJoinAck } = await setup()

    applyJoinAck(ROOM_ID, { videoPlayerEnabled: true, videoPlayer: null, serverNow: NOW_MS }, NOW_MS)

    expect(store.enabled).toBe(true)
    expect(store.snapshot).toBeNull()
    expect(store.isActive).toBe(false)
  })

  it('enabled but no serverNow: no clock sample', async () => {
    const { store, applyJoinAck } = await setup()

    applyJoinAck(ROOM_ID, { videoPlayerEnabled: true, videoPlayer: makeSnapshot() }, NOW_MS)

    expect(store.snapshot).not.toBeNull()
    expect(store.clockSamples).toEqual([])
  })

  it('enabled but serverNow is not a number: no clock sample', async () => {
    const { store, applyJoinAck } = await setup()

    applyJoinAck(ROOM_ID, { videoPlayerEnabled: true, serverNow: '123' as unknown as number }, NOW_MS)

    expect(store.clockSamples).toEqual([])
  })

  it('sample math is serverNow - receivedAtMs, so a slow ack gives a negative sample', async () => {
    const { store, applyJoinAck } = await setup()

    applyJoinAck(ROOM_ID, { videoPlayerEnabled: true, serverNow: NOW_MS - 80 }, NOW_MS)

    expect(store.clockSamples).toEqual([-80])
  })

  it('disabled: ignores a snapshot and a serverNow that came with the ack', async () => {
    const { store, applyJoinAck } = await setup()

    applyJoinAck(
      ROOM_ID,
      { videoPlayerEnabled: false, videoPlayer: makeSnapshot(), serverNow: NOW_MS + 5 },
      NOW_MS,
    )

    expect(store.roomId).toBe(ROOM_ID)
    expect(store.enabled).toBe(false)
    expect(store.snapshot).toBeNull()
    expect(store.clockSamples).toEqual([])
  })

  it('absent fields (old MSAB): the feature is off', async () => {
    const { store, applyJoinAck } = await setup()

    applyJoinAck(ROOM_ID, {}, NOW_MS)

    expect(store.roomId).toBe(ROOM_ID)
    expect(store.enabled).toBe(false)
    expect(store.snapshot).toBeNull()
    expect(store.clockSamples).toEqual([])
  })

  it('a rejoin replaces the previous session (old snapshot and samples are gone)', async () => {
    const { store, applyJoinAck } = await setup()
    applyJoinAck('room-old', { videoPlayerEnabled: true, videoPlayer: makeSnapshot({ revision: 9 }), serverNow: NOW_MS }, NOW_MS)

    applyJoinAck(ROOM_ID, { videoPlayerEnabled: true, videoPlayer: null }, NOW_MS)

    expect(store.roomId).toBe(ROOM_ID)
    expect(store.snapshot).toBeNull()
    expect(store.clockSamples).toEqual([])
  })
})

describe('videoPlayer:stateChanged handler', () => {
  async function joined() {
    const ctx = await setup()
    ctx.applyJoinAck(ROOM_ID, { videoPlayerEnabled: true, videoPlayer: null }, NOW_MS)
    ctx.setupListeners()
    const handler = ctx.socket.handler(STATE_CHANGED) as (event: VideoPlayerStateChangedEvent) => void
    return { ...ctx, handler }
  }

  it('applies a snapshot for the current room and records serverTs - receivedAt', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW_MS)
    const { store, handler } = await joined()

    handler({ roomId: ROOM_ID, snapshot: makeSnapshot({ revision: 2, serverTs: NOW_MS + 120 }) })

    expect(store.snapshot?.revision).toBe(2)
    expect(store.clockSamples).toEqual([120])
  })

  it('ignores an event for another room', async () => {
    const { store, handler } = await joined()

    handler({ roomId: 'room-other', snapshot: makeSnapshot() })

    expect(store.snapshot).toBeNull()
    expect(store.clockSamples).toEqual([])
  })

  it('ignores a stale revision (no change, no clock sample)', async () => {
    const { store, handler } = await joined()
    handler({ roomId: ROOM_ID, snapshot: makeSnapshot({ revision: 5, positionAtTs: 50 }) })
    const samplesBefore = store.clockSamples.length

    handler({ roomId: ROOM_ID, snapshot: makeSnapshot({ revision: 3, positionAtTs: 99 }) })
    handler({ roomId: ROOM_ID, snapshot: makeSnapshot({ revision: 5, positionAtTs: 99 }) })

    expect(store.snapshot?.revision).toBe(5)
    expect(store.snapshot?.positionAtTs).toBe(50)
    expect(store.clockSamples).toHaveLength(samplesBefore)
  })

  it('a null snapshot clears the video and records no clock sample', async () => {
    const { store, handler } = await joined()
    handler({ roomId: ROOM_ID, snapshot: makeSnapshot({ revision: 5 }) })
    const samplesBefore = store.clockSamples.length

    handler({ roomId: ROOM_ID, snapshot: null })

    expect(store.snapshot).toBeNull()
    expect(store.clockSamples).toHaveLength(samplesBefore)
  })

  it('after a clear, revision 1 of the next video is accepted', async () => {
    const { store, handler } = await joined()
    handler({ roomId: ROOM_ID, snapshot: makeSnapshot({ revision: 8 }) })
    handler({ roomId: ROOM_ID, snapshot: null })

    handler({ roomId: ROOM_ID, snapshot: makeSnapshot({ revision: 1 }) })

    expect(store.snapshot?.revision).toBe(1)
  })
})

describe('videoPlayer:revoked handler', () => {
  async function joined() {
    const ctx = await setup()
    ctx.applyJoinAck(ROOM_ID, { videoPlayerEnabled: true, videoPlayer: null }, NOW_MS)
    ctx.setupListeners()
    const handler = ctx.socket.handler(REVOKED) as (event: VideoPlayerRevokedEvent) => void
    return { ...ctx, handler }
  }

  it("reason 'music': one info toast explaining the music took over", async () => {
    const { handler } = await joined()

    handler({ roomId: ROOM_ID, byUserId: 3, reason: 'music' })

    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Video', description: 'Music started, so the video stopped.', color: 'info' }),
    )
  })

  it("reason 'takeover': one info toast about the owner", async () => {
    const { handler } = await joined()

    handler({ roomId: ROOM_ID, byUserId: 3, reason: 'takeover' })

    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'The room owner took over the video.', color: 'info' }),
    )
  })

  it('an old server (no reason) gets the owner copy', async () => {
    const { handler } = await joined()

    handler({ roomId: ROOM_ID, byUserId: 3 })

    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'The room owner took over the video.' }),
    )
  })

  it('ignores an event for another room (no toast)', async () => {
    const { handler } = await joined()

    handler({ roomId: 'room-other', byUserId: 3, reason: 'music' })

    expect(toastAdd).not.toHaveBeenCalled()
  })
})

describe('setupListeners / cleanupListeners', () => {
  it('registers one listener per event', async () => {
    const { socket, setupListeners } = await setup()

    setupListeners()

    expect(socket.on).toHaveBeenCalledTimes(2)
    expect(socket.count(STATE_CHANGED)).toBe(1)
    expect(socket.count(REVOKED)).toBe(1)
  })

  it('calling setupListeners twice still leaves ONE registration per event', async () => {
    const { socket, setupListeners } = await setup()

    setupListeners()
    const firstStateChanged = socket.handler(STATE_CHANGED)
    const firstRevoked = socket.handler(REVOKED)
    setupListeners()

    expect(socket.count(STATE_CHANGED)).toBe(1)
    expect(socket.count(REVOKED)).toBe(1)
    // the second setup removed the first registration by reference...
    expect(socket.off).toHaveBeenCalledWith(STATE_CHANGED, firstStateChanged)
    expect(socket.off).toHaveBeenCalledWith(REVOKED, firstRevoked)
    // ...and the handlers are stable, so the survivor is the same function.
    expect(socket.handler(STATE_CHANGED)).toBe(firstStateChanged)
    expect(socket.handler(REVOKED)).toBe(firstRevoked)
  })

  it('two composable instances on the same socket also never stack', async () => {
    const { useRoomVideoListeners } = await import('../../app/composables/room/video/useRoomVideoListeners')
    const { socket, socketRef, setupListeners } = await setup()

    setupListeners()
    useRoomVideoListeners(socketRef as never).setupListeners()

    expect(socket.count(STATE_CHANGED)).toBe(1)
    expect(socket.count(REVOKED)).toBe(1)
  })

  it('cleanupListeners calls off(name, sameHandler) for both events and never off(name) alone', async () => {
    const { socket, setupListeners, cleanupListeners } = await setup()
    setupListeners()
    const registered = new Map(socket.on.mock.calls.map(([event, handler]) => [event, handler]))

    cleanupListeners()

    expect(socket.off).toHaveBeenCalledTimes(2)
    expect(socket.off).toHaveBeenCalledWith(STATE_CHANGED, registered.get(STATE_CHANGED))
    expect(socket.off).toHaveBeenCalledWith(REVOKED, registered.get(REVOKED))
    for (const call of socket.off.mock.calls) {
      expect(call).toHaveLength(2)
      expect(call[1]).toBeTypeOf('function')
    }
    expect(socket.count(STATE_CHANGED)).toBe(0)
    expect(socket.count(REVOKED)).toBe(0)
  })

  it('cleanupListeners is idempotent', async () => {
    const { socket, setupListeners, cleanupListeners } = await setup()
    setupListeners()

    cleanupListeners()
    socket.off.mockClear()
    cleanupListeners()

    expect(socket.off).not.toHaveBeenCalled()
  })

  it('cleanupListeners before any setup does nothing', async () => {
    const { socket, cleanupListeners } = await setup()

    cleanupListeners()

    expect(socket.off).not.toHaveBeenCalled()
  })

  it('after a socket swap, setup detaches from the OLD socket and attaches to the new one', async () => {
    const { socket: oldSocket, socketRef, setupListeners } = await setup()
    setupListeners()
    const newSocket = createFakeSocket()

    socketRef.value = newSocket
    setupListeners()

    expect(oldSocket.off).toHaveBeenCalledWith(STATE_CHANGED, expect.any(Function))
    expect(oldSocket.off).toHaveBeenCalledWith(REVOKED, expect.any(Function))
    expect(oldSocket.count(STATE_CHANGED)).toBe(0)
    expect(newSocket.count(STATE_CHANGED)).toBe(1)
    expect(newSocket.count(REVOKED)).toBe(1)
  })

  it('with no socket, setupListeners registers nothing and does not throw', async () => {
    const { socketRef, setupListeners } = await setup()
    socketRef.value = null

    expect(() => setupListeners()).not.toThrow()
  })
})
