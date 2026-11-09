// ========================================
// useRoomVideoSync Tests (room-video-player 06, 07, 08, 09)
// ========================================
// The sync composable driven against a fake adapter, the real store, fake timers
// and a mocked motion orchestrator. Asserts what the player is told to do —
// load / seek / play / pause / destroy — and what the Controller transport is
// told to send (heartbeat / ended), for each Snapshot and timer event.
// ========================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, nextTick, reactive, ref } from 'vue'
import { ROOM_VIDEO_HEARTBEAT_MS, type RoomVideoPlatform } from '~/constants/room'
import type { DeviceClass } from '~/utils/device-class'
import type {
  RoomVideoSnapshot,
  RoomVideoTransport,
  VideoAdapterError,
  VideoAdapterEvent,
  VideoPlayerAdapter,
} from '~/types/room/video'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

const authUser = { id: 7 as number | undefined }
vi.stubGlobal('useAuthStore', () => ({ user: authUser.id === undefined ? null : { id: authUser.id } }))

const toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: toastAdd }))

let awayCallback: ((away: boolean) => void) | null = null
const awayState = { value: false }
const awayUnsubscribe = vi.fn()
let coverCounter = 0
const acquireCovered = vi.fn(() => `cover-${++coverCounter}`)
const releaseCovered = vi.fn()
vi.mock('~/services/motionPauseOrchestrator', () => ({
  acquireCovered: () => acquireCovered(),
  releaseCovered: (token: string) => releaseCovered(token),
  isAway: () => awayState.value,
  subscribeAway: (cb: (away: boolean) => void) => {
    awayCallback = cb
    return awayUnsubscribe
  },
}))
vi.mock('~/services/roomVideoHtmlAdapter', () => ({ createHtmlVideoAdapter: vi.fn() }))
vi.mock('~/services/roomVideoYouTubeAdapter', () => ({ createYouTubeVideoAdapter: vi.fn() }))

// Where the app runs (ticket 08): 'web' by default; YouTube cases switch it.
const platform = { value: 'web' as RoomVideoPlatform }
vi.mock('~/composables/room/video/useRoomVideoYouTube', () => ({ readRoomVideoPlatform: () => platform.value }))
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

// Device tier: 'high' by default so the existing cases start expanded and play at once.
const tier = { value: 'high' as DeviceClass }
const readTier = vi.fn(() => tier.value)
vi.mock('~/utils/frame-animation-tier', () => ({ readFrameAnimationTier: () => readTier() }))

// The "Always start video collapsed" switch (the real store is covered by its own spec).
const fxPrefs = reactive({ startVideoCollapsed: false })
vi.mock('~/stores/fxPreferences', () => ({ useFxPreferencesStore: () => fxPrefs }))

// Transport used when a caller passes none: `useRoomVideoActions()` is resolved in setup.
const actionsTransport: RoomVideoTransport = { heartbeat: vi.fn(), ended: vi.fn() }
vi.mock('~/composables/room/video/useRoomVideoActions', () => ({ useRoomVideoActions: () => actionsTransport }))

const { useRoomVideoStore } = await import('~/stores/roomVideo')
const { useRoomVideoSync, __resetRoomVideoSyncTierForTest } = await import('~/composables/room/video/useRoomVideoSync')

// ----------------------------------------
// Fakes
// ----------------------------------------

interface FakeAdapter extends VideoPlayerAdapter {
  emit(event: VideoAdapterEvent, error?: VideoAdapterError): void
  setTime(sec: number): void
  setDuration(sec: number): void
}

function makeFakeAdapter(): FakeAdapter {
  const listeners = new Map<VideoAdapterEvent, Set<(error?: VideoAdapterError) => void>>()
  let time = 0
  let length = 0
  return {
    load: vi.fn(),
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    seek: vi.fn((sec: number) => {
      time = sec
    }),
    currentTime: vi.fn(() => time),
    duration: vi.fn(() => length),
    setMuted: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn((event: VideoAdapterEvent, cb: (error?: VideoAdapterError) => void) => {
      const set = listeners.get(event) ?? new Set()
      set.add(cb)
      listeners.set(event, set)
      return () => set.delete(cb)
    }),
    emit(event, error) {
      listeners.get(event)?.forEach((cb) => cb(error))
    },
    setTime(sec) {
      time = sec
    },
    setDuration(sec) {
      length = sec
    },
  }
}

const NOW = 1_731_068_400_000
const MP4 = { kind: 'url', url: 'https://cdn.example.com/a.mp4', container: 'mp4' } as const
const OTHER_MP4 = { kind: 'url', url: 'https://cdn.example.com/b.mp4', container: 'mp4' } as const
const YOUTUBE = { kind: 'youtube', videoId: 'dQw4w9WgXcQ' } as const
const CONTROLLER_ID = 99
const HEARTBEAT_MS = ROOM_VIDEO_HEARTBEAT_MS

function snapshot(overrides: Partial<RoomVideoSnapshot> = {}): RoomVideoSnapshot {
  return {
    controllerUserId: 99,
    source: MP4,
    paused: false,
    positionAtTs: 10,
    serverTs: NOW,
    revision: 1,
    ...overrides,
  }
}

const container = {} as HTMLElement

function setup(initial: RoomVideoSnapshot | null = snapshot(), factoryKind: 'url' | 'youtube' = 'url') {
  const store = useRoomVideoStore()
  store.startSession('room-1', true)
  store.replaceSnapshot(initial)
  const adapters: FakeAdapter[] = []
  const factory = vi.fn(() => {
    const adapter = makeFakeAdapter()
    adapters.push(adapter)
    return adapter
  })
  const transport = { heartbeat: vi.fn(), ended: vi.fn() }
  const sync = useRoomVideoSync({ [factoryKind]: factory }, transport)
  return { store, sync, factory, transport, adapters, current: () => adapters[adapters.length - 1]! }
}

/** Away transition as the orchestrator reports it: the flag flips, then subscribers hear. */
function setAway(away: boolean): void {
  awayState.value = away
  awayCallback?.(away)
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  vi.clearAllMocks()
  authUser.id = 7
  awayCallback = null
  awayState.value = false
  coverCounter = 0
  tier.value = 'high'
  fxPrefs.startVideoCollapsed = false
  platform.value = 'web'
  __resetRoomVideoSyncTierForTest()
})

afterEach(() => {
  useRoomVideoSync({}, { heartbeat: vi.fn(), ended: vi.fn() }).detach()
  vi.useRealTimers()
})

// ----------------------------------------
// Snapshot → adapter
// ----------------------------------------

describe('applying the Snapshot', () => {
  it('a playing Snapshot loads the Source, seeks to the expected second and plays', () => {
    vi.setSystemTime(NOW + 5_000)
    const { sync, factory, current } = setup()

    sync.attach(container)

    expect(factory).toHaveBeenCalledWith(container)
    expect(current().load).toHaveBeenCalledWith(MP4)
    expect(current().seek).toHaveBeenCalledWith(15)
    expect(current().play).toHaveBeenCalledTimes(1)
  })

  it('uses the clock offset: serverNow = Date.now() + offset', () => {
    const { store, sync, current } = setup()
    store.addClockSample(2_000) // server clock 2 s ahead of this phone

    sync.attach(container)

    expect(current().seek).toHaveBeenCalledWith(12)
  })

  it('a paused Snapshot seeks to the frozen position and pauses, never plays', () => {
    vi.setSystemTime(NOW + 60_000)
    const { sync, current } = setup(snapshot({ paused: true, positionAtTs: 42 }))

    sync.attach(container)

    expect(current().seek).toHaveBeenCalledWith(42)
    expect(current().pause).toHaveBeenCalled()
    expect(current().play).not.toHaveBeenCalled()
  })

  it('a newer revision of the same Source never reloads; a small drift seeks nothing', async () => {
    const { store, sync, current } = setup()
    sync.attach(container)
    const adapter = current()
    adapter.setTime(10.5)
    vi.mocked(adapter.seek).mockClear()

    store.applySnapshot(snapshot({ revision: 2, positionAtTs: 11, serverTs: NOW }))
    await nextTick()

    expect(adapter.load).toHaveBeenCalledTimes(1)
    expect(adapter.seek).not.toHaveBeenCalled()
  })

  it("the Controller's seek beyond the threshold moves the player once", async () => {
    const { store, sync, current } = setup()
    sync.attach(container)
    vi.mocked(current().seek).mockClear()

    store.applySnapshot(snapshot({ revision: 2, positionAtTs: 90 }))
    await nextTick()

    expect(current().seek).toHaveBeenCalledTimes(1)
    expect(current().seek).toHaveBeenCalledWith(90)
  })

  it('a pause from the Controller pauses this player', async () => {
    const { store, sync, current } = setup()
    sync.attach(container)

    store.applySnapshot(snapshot({ revision: 2, paused: true, positionAtTs: 10 }))
    await nextTick()

    expect(current().pause).toHaveBeenCalled()
  })

  it('a new link loads into the same adapter', async () => {
    const { store, sync, factory, current } = setup()
    sync.attach(container)
    const other = { kind: 'url', url: 'https://cdn.example.com/b.m3u8', container: 'hls' } as const

    store.applySnapshot(snapshot({ revision: 2, source: other, positionAtTs: 0 }))
    await nextTick()

    expect(factory).toHaveBeenCalledTimes(1)
    expect(current().load).toHaveBeenLastCalledWith(other)
  })

  it('stop (null Snapshot) destroys the player', async () => {
    const { store, sync, current } = setup()
    sync.attach(container)

    store.applySnapshot(null)
    await nextTick()

    expect(current().destroy).toHaveBeenCalledTimes(1)
  })

  it('a Source kind without a backend (YouTube before ticket 08) shows the can\'t-play state', () => {
    const { store, sync, factory } = setup(snapshot({ source: { kind: 'youtube', videoId: 'dQw4w9WgXcQ' } }))

    sync.attach(container)

    expect(factory).not.toHaveBeenCalled()
    expect(store.playbackFailed).toBe(true)
  })
})

// ----------------------------------------
// Drift tick
// ----------------------------------------

describe('drift tick', () => {
  it('stays quiet until the player has actually started playing', () => {
    const { sync, current } = setup()
    sync.attach(container)
    vi.mocked(current().seek).mockClear()

    vi.advanceTimersByTime(10_000)

    expect(current().seek).not.toHaveBeenCalled()
  })

  it('corrects a drift with ONE seek, then waits out the cooldown before another', () => {
    const { sync, current } = setup()
    sync.attach(container)
    const adapter = current()
    adapter.emit('playing')
    for (let s = 1; s <= 4; s++) {
      adapter.setTime(10 + s) // playing in step with the room
      vi.advanceTimersByTime(1_000)
    }
    adapter.setTime(10) // a gift burst froze it; expected is ~14
    vi.mocked(adapter.seek).mockClear()

    vi.advanceTimersByTime(1_000)
    expect(adapter.seek).toHaveBeenCalledTimes(1)

    adapter.setTime(10) // still behind (rebuffering after the seek)
    vi.advanceTimersByTime(2_000)
    expect(adapter.seek).toHaveBeenCalledTimes(1) // cooldown: no stacked seek

    vi.advanceTimersByTime(2_000)
    expect(adapter.seek).toHaveBeenCalledTimes(2)
  })

  it('never corrects a paused video', () => {
    const { sync, current } = setup(snapshot({ paused: true }))
    sync.attach(container)
    current().emit('playing')
    current().setTime(0)
    vi.mocked(current().seek).mockClear()

    vi.advanceTimersByTime(10_000)

    expect(current().seek).not.toHaveBeenCalled()
  })

  it('stops ticking after detach', () => {
    const { sync, current } = setup()
    sync.attach(container)
    const adapter = current()
    adapter.emit('playing')
    sync.detach()
    vi.mocked(adapter.seek).mockClear()

    vi.advanceTimersByTime(10_000)

    expect(adapter.seek).not.toHaveBeenCalled()
    expect(adapter.destroy).toHaveBeenCalled()
  })
})

// ----------------------------------------
// Autoplay refusal, errors, mute
// ----------------------------------------

describe('autoplay refusal and errors', () => {
  it('blocked → Tap to watch; later Snapshots do not retry play until the tap', async () => {
    const { store, sync, current } = setup()
    sync.attach(container)
    const adapter = current()

    adapter.emit('blocked')
    expect(store.needsTap).toBe(true)

    vi.mocked(adapter.play).mockClear()
    store.applySnapshot(snapshot({ revision: 2 }))
    await nextTick()
    expect(adapter.play).not.toHaveBeenCalled()
  })

  it('the tap plays from the expected second, not from 0', async () => {
    const { store, sync, current } = setup()
    sync.attach(container)
    current().emit('blocked')
    vi.setSystemTime(NOW + 20_000)
    vi.mocked(current().seek).mockClear()

    await sync.tapToWatch()

    expect(store.needsTap).toBe(false)
    expect(current().seek).toHaveBeenCalledWith(30)
    expect(current().play).toHaveBeenCalled()
  })

  it('a playback error shows the can\'t-play state; the Controller gets ONE toast per link', () => {
    authUser.id = 99 // the Controller
    const { store, sync, current } = setup()
    sync.attach(container)

    current().emit('error')
    current().emit('error')

    expect(store.playbackFailed).toBe(true)
    expect(toastAdd).toHaveBeenCalledTimes(1)
  })

  it('the Controller toast names the cause when the adapter knows it (YouTube codes)', () => {
    authUser.id = CONTROLLER_ID
    const { sync, current } = setup()
    sync.attach(container)

    current().emit('error', {
      code: 'youtube_embed_disabled',
      message: 'YouTube onError 150',
      userMessage: "This video's owner doesn't allow it to play outside YouTube.",
    })

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ description: "This video's owner doesn't allow it to play outside YouTube." }),
    )
  })

  it('an error without a known cause keeps the generic toast line', () => {
    authUser.id = CONTROLLER_ID
    const { sync, current } = setup()
    sync.attach(container)

    current().emit('error', { code: 'media_3', message: 'decode' })

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ description: "This link couldn't be played. Try another one." }),
    )
  })

  it('a Watcher error never toasts', () => {
    const { sync, current } = setup()
    sync.attach(container)

    current().emit('error')

    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('local mute reaches the player, and a new player starts with the current mute', async () => {
    const { store, sync, current } = setup()
    store.setMuted(true)
    sync.attach(container)
    expect(current().setMuted).toHaveBeenCalledWith(true)

    sync.toggleMuted()
    await nextTick()

    expect(store.muted).toBe(false)
    expect(current().setMuted).toHaveBeenLastCalledWith(false)
  })
})

// ----------------------------------------
// Seats cover, away, install-once
// ----------------------------------------

describe('seats cover', () => {
  it('expanded + playing covers the seats; collapsing or stopping uncovers', async () => {
    const { store, sync } = setup()
    sync.attach(container)
    expect(acquireCovered).toHaveBeenCalledTimes(1)

    sync.toggleCollapsed()
    await nextTick()
    expect(releaseCovered).toHaveBeenCalledWith('cover-1')

    sync.toggleCollapsed()
    await nextTick()
    expect(acquireCovered).toHaveBeenCalledTimes(2)

    store.applySnapshot(null)
    await nextTick()
    expect(releaseCovered).toHaveBeenCalledWith('cover-2')
  })

  it('a paused video does not cover the seats', () => {
    const { sync } = setup(snapshot({ paused: true }))
    sync.attach(container)
    expect(acquireCovered).not.toHaveBeenCalled()
  })

  it('detach releases a held cover', () => {
    const { sync } = setup()
    sync.attach(container)
    sync.detach()
    expect(releaseCovered).toHaveBeenCalledWith('cover-1')
    expect(awayUnsubscribe).toHaveBeenCalled()
  })
})

describe('away and install-once', () => {
  it('back from away jumps to where the room is now', () => {
    const { sync, current } = setup()
    sync.attach(container)
    vi.setSystemTime(NOW + 120_000)
    vi.mocked(current().seek).mockClear()

    awayCallback?.(false)

    expect(current().seek).toHaveBeenCalledWith(130)
  })

  it('attaching the same slot twice is a no-op; a second caller shares the one install', async () => {
    const { store, sync, factory, current } = setup()
    sync.attach(container)
    sync.attach(container)
    useRoomVideoSync({ url: factory }) // another caller, no attach
    expect(factory).toHaveBeenCalledTimes(1)

    store.applySnapshot(snapshot({ revision: 2, positionAtTs: 200 }))
    await nextTick()

    expect(current().seek).toHaveBeenCalledTimes(2) // load seek + this one — one watcher, not two
  })

  it('after detach, Snapshot changes no longer touch any player', async () => {
    const { store, sync, factory } = setup()
    sync.attach(container)
    sync.detach()

    store.applySnapshot(snapshot({ revision: 2, source: { kind: 'url', url: 'https://x.example/c.mp4', container: 'mp4' } }))
    await nextTick()

    expect(factory).toHaveBeenCalledTimes(1)
  })
})


// ----------------------------------------
// Controller heartbeat (ticket 07)
// ----------------------------------------

/** A Controller (id 99) whose player is up and playing at 10 s. */
function setupPlayingController(initial: RoomVideoSnapshot = snapshot()) {
  authUser.id = CONTROLLER_ID
  const ctx = setup(initial)
  ctx.sync.attach(container)
  ctx.current().setTime(10)
  ctx.current().emit('playing')
  return ctx
}

describe('Controller heartbeat', () => {
  it('beats every ROOM_VIDEO_HEARTBEAT_MS with the local position and paused flag', () => {
    const { current, transport } = setupPlayingController()
    current().setTime(33)

    vi.advanceTimersByTime(HEARTBEAT_MS - 1)
    expect(transport.heartbeat).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(transport.heartbeat).toHaveBeenCalledTimes(1)
    expect(transport.heartbeat).toHaveBeenLastCalledWith(33, false)

    vi.advanceTimersByTime(HEARTBEAT_MS)
    expect(transport.heartbeat).toHaveBeenCalledTimes(2)
  })

  it('a Watcher never beats', () => {
    const { sync, current, transport } = setup()
    sync.attach(container)
    current().emit('playing')

    vi.advanceTimersByTime(10 * HEARTBEAT_MS)

    expect(transport.heartbeat).not.toHaveBeenCalled()
  })

  it('stops after detach', () => {
    const { sync, transport } = setupPlayingController()
    vi.advanceTimersByTime(HEARTBEAT_MS)
    expect(transport.heartbeat).toHaveBeenCalledTimes(1)

    sync.detach()
    vi.advanceTimersByTime(10 * HEARTBEAT_MS)

    expect(transport.heartbeat).toHaveBeenCalledTimes(1)
  })

  it('stops when the Snapshot goes null', async () => {
    const { store, transport } = setupPlayingController()
    vi.advanceTimersByTime(HEARTBEAT_MS)
    expect(transport.heartbeat).toHaveBeenCalledTimes(1)

    store.applySnapshot(null)
    await nextTick()
    vi.advanceTimersByTime(10 * HEARTBEAT_MS)

    expect(transport.heartbeat).toHaveBeenCalledTimes(1)
  })

  it('stops when someone else takes control', async () => {
    const { store, transport } = setupPlayingController()
    vi.advanceTimersByTime(HEARTBEAT_MS)
    expect(transport.heartbeat).toHaveBeenCalledTimes(1)

    store.applySnapshot(snapshot({ revision: 2, controllerUserId: 5 }))
    await nextTick()
    vi.advanceTimersByTime(10 * HEARTBEAT_MS)

    expect(transport.heartbeat).toHaveBeenCalledTimes(1)
  })

  it('is skipped while away, and resumes when back', () => {
    const { transport } = setupPlayingController()

    setAway(true)
    vi.advanceTimersByTime(5 * HEARTBEAT_MS)
    expect(transport.heartbeat).not.toHaveBeenCalled()

    setAway(false)
    vi.advanceTimersByTime(HEARTBEAT_MS)
    expect(transport.heartbeat).toHaveBeenCalledTimes(1)
  })

  it('is skipped while the browser is blocking playback (needs a tap)', () => {
    const { current, transport } = setupPlayingController()
    current().emit('blocked')

    vi.advanceTimersByTime(5 * HEARTBEAT_MS)

    expect(transport.heartbeat).not.toHaveBeenCalled()
  })

  it("is skipped once playback failed on this device", () => {
    const { current, transport } = setupPlayingController()
    current().emit('error')

    vi.advanceTimersByTime(5 * HEARTBEAT_MS)

    expect(transport.heartbeat).not.toHaveBeenCalled()
  })

  it('waits for the player to really start before beating a playing video', () => {
    authUser.id = CONTROLLER_ID
    const { sync, current, transport } = setup()
    sync.attach(container)

    vi.advanceTimersByTime(5 * HEARTBEAT_MS)
    expect(transport.heartbeat).not.toHaveBeenCalled()

    current().emit('playing')
    vi.advanceTimersByTime(HEARTBEAT_MS)
    expect(transport.heartbeat).toHaveBeenCalledTimes(1)
  })

  it('a paused video beats with paused=true, but only once the player is ready (position is real)', () => {
    authUser.id = CONTROLLER_ID
    const { sync, current, transport } = setup(snapshot({ paused: true, positionAtTs: 42 }))
    sync.attach(container)

    vi.advanceTimersByTime(5 * HEARTBEAT_MS)
    expect(transport.heartbeat).not.toHaveBeenCalled() // metadata not loaded: currentTime would read 0

    current().emit('ready')
    vi.advanceTimersByTime(HEARTBEAT_MS)
    expect(transport.heartbeat).toHaveBeenCalledTimes(1)
    expect(transport.heartbeat).toHaveBeenLastCalledWith(42, true)
  })

  it('a new Source must start playing again before the next beat', async () => {
    const { store, transport } = setupPlayingController()
    vi.advanceTimersByTime(HEARTBEAT_MS)
    expect(transport.heartbeat).toHaveBeenCalledTimes(1)

    store.applySnapshot(snapshot({ revision: 2, source: OTHER_MP4, positionAtTs: 0 }))
    await nextTick()
    vi.advanceTimersByTime(3 * HEARTBEAT_MS)

    expect(transport.heartbeat).toHaveBeenCalledTimes(1)
  })

  it('with no transport passed, resolves useRoomVideoActions() in setup', () => {
    authUser.id = CONTROLLER_ID
    const store = useRoomVideoStore()
    store.startSession('room-1', true)
    store.replaceSnapshot(snapshot())
    const adapter = makeFakeAdapter()
    const sync = useRoomVideoSync({ url: () => adapter })
    sync.attach(container)
    adapter.emit('playing')

    vi.advanceTimersByTime(HEARTBEAT_MS)

    expect(actionsTransport.heartbeat).toHaveBeenCalledTimes(1)
  })
})

// ----------------------------------------
// Ended (ticket 07)
// ----------------------------------------

describe('ended', () => {
  it('the Controller tells the server once per loaded Source', async () => {
    const { store, current, transport } = setupPlayingController()

    current().emit('ended')
    current().emit('ended')
    expect(transport.ended).toHaveBeenCalledTimes(1)

    store.applySnapshot(snapshot({ revision: 2, source: OTHER_MP4, positionAtTs: 0 }))
    await nextTick()
    current().emit('ended')
    expect(transport.ended).toHaveBeenCalledTimes(2)
  })

  it('a Watcher reaching the end sends nothing', () => {
    const { sync, current, transport } = setup()
    sync.attach(container)

    current().emit('ended')

    expect(transport.ended).not.toHaveBeenCalled()
  })
})

// ----------------------------------------
// Progress for the seek bar (ticket 07)
// ----------------------------------------

describe('progress', () => {
  it('the Controller mirrors position + duration into the store on every drift tick', () => {
    const { store, current } = setupPlayingController()
    current().setDuration(120)
    current().setTime(30)

    vi.advanceTimersByTime(1_000)

    expect(store.positionSec).toBe(30)
    expect(store.durationSec).toBe(120)
  })

  it('keeps updating while the video is paused', () => {
    authUser.id = CONTROLLER_ID
    const { store, sync, current } = setup(snapshot({ paused: true, positionAtTs: 42 }))
    sync.attach(container)
    current().setDuration(300)

    vi.advanceTimersByTime(1_000)

    expect(store.positionSec).toBe(42)
    expect(store.durationSec).toBe(300)
  })

  it('updates when the player starts playing', () => {
    authUser.id = CONTROLLER_ID
    const { store, sync, current } = setup()
    sync.attach(container)
    current().setDuration(80)
    current().setTime(12)

    current().emit('playing')

    expect(store.positionSec).toBe(12)
    expect(store.durationSec).toBe(80)
  })

  it('updates right after a seek', async () => {
    const { store, current } = setupPlayingController()
    current().setDuration(200)

    store.applySnapshot(snapshot({ revision: 2, positionAtTs: 90 }))
    await nextTick()

    expect(store.positionSec).toBe(90)
    expect(store.durationSec).toBe(200)
  })

  it('a Watcher never writes progress (saves work on low phones)', () => {
    const { store, sync, current } = setup()
    sync.attach(container)
    current().emit('playing')
    current().setDuration(120)
    current().setTime(30)

    vi.advanceTimersByTime(5_000)

    expect(store.positionSec).toBe(0)
    expect(store.durationSec).toBe(0)
    expect(current().duration).not.toHaveBeenCalled()
  })
})

describe('currentPosition', () => {
  it('with no player it is where the room is now (never 0), then the local player position', () => {
    vi.setSystemTime(NOW + 7_000)
    const { sync, current } = setup()
    expect(sync.currentPosition()).toBe(17)

    sync.attach(container)
    current().setTime(41.5)
    current().emit('ready')

    expect(sync.currentPosition()).toBe(41.5)
  })

  it('is the room\'s second while the player is still loading or has failed (a pause must never rewind to 0)', () => {
    vi.setSystemTime(NOW + 7_000)
    authUser.id = CONTROLLER_ID
    const { sync, current } = setup()
    sync.attach(container)
    current().setTime(0)

    expect(sync.currentPosition()).toBe(17) // loading: no ready / playing yet

    current().emit('playing')
    current().emit('error')
    expect(sync.currentPosition()).toBe(17) // failed
  })

  it('is 0 with no Snapshot and no player', () => {
    const { sync } = setup(null)
    expect(sync.currentPosition()).toBe(0)
  })
})

// ----------------------------------------
// Away = local pause (ticket 09)
// ----------------------------------------

describe('away is a local pause', () => {
  it('pausing on away touches neither the store Snapshot nor the transport', () => {
    authUser.id = CONTROLLER_ID
    const { store, sync, current, transport } = setup()
    sync.attach(container)
    current().emit('playing')
    const held = store.snapshot

    setAway(true)

    expect(current().pause).toHaveBeenCalledTimes(1)
    expect(store.snapshot).toBe(held)
    expect(store.snapshot?.paused).toBe(false)
    vi.advanceTimersByTime(10 * HEARTBEAT_MS)
    expect(transport.heartbeat).not.toHaveBeenCalled()
    expect(transport.ended).not.toHaveBeenCalled()
  })

  it('coming back does ONE seek to the expected second, then plays', () => {
    const { sync, current } = setup()
    sync.attach(container)
    current().emit('playing')
    setAway(true)
    vi.setSystemTime(NOW + 120_000)
    vi.mocked(current().seek).mockClear()
    vi.mocked(current().play).mockClear()

    setAway(false)

    expect(current().seek).toHaveBeenCalledTimes(1)
    expect(current().seek).toHaveBeenCalledWith(130)
    expect(current().play).toHaveBeenCalledTimes(1)
  })

  it('a Snapshot arriving while away loads and seeks but never starts playback', async () => {
    const { store, sync, current } = setup()
    sync.attach(container)
    vi.mocked(current().play).mockClear()
    setAway(true)

    store.applySnapshot(snapshot({ revision: 2, source: OTHER_MP4, positionAtTs: 5 }))
    await nextTick()

    expect(current().load).toHaveBeenLastCalledWith(OTHER_MP4)
    expect(current().play).not.toHaveBeenCalled()
  })

  it('the drift tick does nothing while away', () => {
    const { sync, current } = setup()
    sync.attach(container)
    current().emit('playing')
    setAway(true)
    current().setTime(0) // expected would be far ahead
    vi.mocked(current().seek).mockClear()
    vi.mocked(current().play).mockClear()

    vi.advanceTimersByTime(20_000)

    expect(current().seek).not.toHaveBeenCalled()
    expect(current().play).not.toHaveBeenCalled()
  })
})

// ----------------------------------------
// Tier / preference default + user choice (ticket 09)
// ----------------------------------------

describe('start state: tier default, preference, user choice', () => {
  it.each<DeviceClass>(['low', 'unknown'])('a %s phone opens collapsed and holds playback', (deviceClass) => {
    tier.value = deviceClass
    const { store, sync, current } = setup()

    sync.attach(container)

    expect(store.collapsed).toBe(true)
    expect(store.needsTap).toBe(true)
    expect(store.collapsedByUser).toBe(false)
    expect(current().load).toHaveBeenCalledWith(MP4) // loaded and positioned, just not decoding
    expect(current().play).not.toHaveBeenCalled()
  })

  it.each<DeviceClass>(['mid', 'high'])('a %s phone opens expanded and plays', (deviceClass) => {
    tier.value = deviceClass
    const { store, sync, current } = setup()
    store.setCollapsed(true) // stale from an earlier video

    sync.attach(container)

    expect(store.collapsed).toBe(false)
    expect(store.needsTap).toBe(false)
    expect(current().play).toHaveBeenCalledTimes(1)
  })

  it('"Always start video collapsed" collapses a strong phone too', () => {
    tier.value = 'high'
    fxPrefs.startVideoCollapsed = true
    const { store, sync, current } = setup()

    sync.attach(container)

    expect(store.collapsed).toBe(true)
    expect(store.needsTap).toBe(true)
    expect(current().play).not.toHaveBeenCalled()
  })

  it('the user\'s expand wins over a default-collapsed tier on the next video', () => {
    tier.value = 'low'
    const { store, sync, current } = setup()
    store.setCollapsedByUser(false)

    sync.attach(container)

    expect(store.collapsed).toBe(false)
    expect(store.needsTap).toBe(false)
    expect(current().play).toHaveBeenCalledTimes(1)
  })

  it('the user\'s collapse wins over a default-expanded tier; the video keeps playing', () => {
    tier.value = 'high'
    const { store, sync, current } = setup()
    store.setCollapsedByUser(true)

    sync.attach(container)

    expect(store.collapsed).toBe(true)
    expect(store.needsTap).toBe(false)
    expect(current().play).toHaveBeenCalledTimes(1)
  })

  it('a re-attach after the user expanded does not re-collapse', () => {
    tier.value = 'low'
    const { store, sync } = setup()
    sync.attach(container)
    sync.toggleCollapsed() // expand: now the user's choice
    sync.detach()

    sync.attach(container)

    expect(store.collapsed).toBe(false)
    expect(store.collapsedByUser).toBe(true)
  })

  it('reads the device tier once per module', () => {
    tier.value = 'low'
    const { sync } = setup()
    sync.attach(container)
    sync.detach()
    sync.attach(container)

    expect(readTier).toHaveBeenCalledTimes(1)
  })

  it('expanding a default-collapsed video plays it from the expected second', () => {
    tier.value = 'low'
    const { store, sync, current } = setup()
    sync.attach(container)
    vi.setSystemTime(NOW + 20_000)
    vi.mocked(current().seek).mockClear()

    sync.toggleCollapsed()

    expect(store.collapsed).toBe(false)
    expect(store.collapsedByUser).toBe(true)
    expect(store.needsTap).toBe(false)
    expect(current().seek).toHaveBeenCalledWith(30)
    expect(current().play).toHaveBeenCalledTimes(1)
  })

  it('expanding also answers an autoplay refusal (Tap to watch)', () => {
    const { store, sync, current } = setup()
    sync.attach(container)
    sync.toggleCollapsed() // collapse
    current().emit('blocked')
    vi.mocked(current().play).mockClear()

    sync.toggleCollapsed() // expand

    expect(store.needsTap).toBe(false)
    expect(current().play).toHaveBeenCalledTimes(1)
  })

  it('collapsing is a user choice and does not hold playback', () => {
    const { store, sync, current } = setup()
    sync.attach(container)

    sync.toggleCollapsed()

    expect(store.collapsed).toBe(true)
    expect(store.collapsedByUser).toBe(true)
    expect(store.needsTap).toBe(false)
    expect(current().pause).not.toHaveBeenCalled()
  })

  it('a new Source while still default-collapsed stays held', async () => {
    tier.value = 'low'
    const { store, sync, current } = setup()
    sync.attach(container)

    store.applySnapshot(snapshot({ revision: 2, source: OTHER_MP4, positionAtTs: 0 }))
    await nextTick()

    expect(store.needsTap).toBe(true)
    expect(current().load).toHaveBeenLastCalledWith(OTHER_MP4)
    expect(current().play).not.toHaveBeenCalled()
  })

  it('a Controller on a weak phone is never held: expanded, playing, beating', () => {
    tier.value = 'low'
    authUser.id = CONTROLLER_ID
    const { store, sync, current, transport } = setup()
    sync.attach(container)

    expect(store.collapsed).toBe(false)
    expect(store.needsTap).toBe(false)
    expect(current().play).toHaveBeenCalledTimes(1)

    current().emit('playing')
    vi.advanceTimersByTime(HEARTBEAT_MS)
    expect(transport.heartbeat).toHaveBeenCalledTimes(1)
  })
})

// ----------------------------------------
// YouTube platform rules (ticket 08)
// ----------------------------------------

describe('YouTube: no-embed platform (iOS card)', () => {
  it('builds no player and is NOT a playback failure: no toast, seats uncovered', () => {
    platform.value = 'ios'
    authUser.id = CONTROLLER_ID
    const { store, sync, factory } = setup(snapshot({ source: YOUTUBE }), 'youtube')

    sync.attach(container)

    expect(factory).not.toHaveBeenCalled()
    expect(store.playbackFailed).toBe(false)
    expect(toastAdd).not.toHaveBeenCalled()
    expect(acquireCovered).not.toHaveBeenCalled()
  })

  it('the card opens at the room\'s current second; no heartbeat without a player', () => {
    platform.value = 'ios'
    authUser.id = CONTROLLER_ID
    const { sync, transport } = setup(snapshot({ source: YOUTUBE }), 'youtube')
    sync.attach(container)

    vi.advanceTimersByTime(HEARTBEAT_MS * 2)

    expect(sync.currentPosition()).toBe(10 + (HEARTBEAT_MS * 2) / 1000)
    expect(transport.heartbeat).not.toHaveBeenCalled()
  })

  it('a direct link still plays on the same platform', () => {
    platform.value = 'ios'
    const { sync, factory, current } = setup()
    sync.attach(container)

    expect(factory).toHaveBeenCalledTimes(1)
    expect(current().play).toHaveBeenCalledTimes(1)
  })
})

describe('YouTube: Capacitor collapse unmounts the iframe', () => {
  it('a Watcher\'s collapse destroys the player; expand rebuilds it at the room\'s second and plays', async () => {
    platform.value = 'android'
    const { sync, factory, adapters } = setup(snapshot({ source: YOUTUBE }), 'youtube')
    sync.attach(container)
    const first = adapters[0]!
    expect(first.load).toHaveBeenCalledWith(YOUTUBE)

    sync.toggleCollapsed()
    await nextTick()
    expect(first.destroy).toHaveBeenCalledTimes(1)
    expect(factory).toHaveBeenCalledTimes(1)

    vi.setSystemTime(NOW + 30_000)
    sync.toggleCollapsed()
    await nextTick()

    expect(factory).toHaveBeenCalledTimes(2)
    const second = adapters[1]!
    expect(second.load).toHaveBeenCalledWith(YOUTUBE)
    expect(second.seek).toHaveBeenLastCalledWith(40)
    expect(second.play).toHaveBeenCalled()
  })

  it('a default-collapsed Watcher on a weak phone never builds the iframe until they expand', async () => {
    platform.value = 'android'
    tier.value = 'low'
    const { store, sync, factory, current } = setup(snapshot({ source: YOUTUBE }), 'youtube')
    sync.attach(container)

    expect(store.collapsed).toBe(true)
    expect(factory).not.toHaveBeenCalled()

    sync.toggleCollapsed()
    await nextTick()

    expect(store.needsTap).toBe(false)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(current().play).toHaveBeenCalled()
  })

  it('the Controller keeps their player when collapsed (it drives heartbeat + ended)', async () => {
    platform.value = 'android'
    authUser.id = CONTROLLER_ID
    const { sync, factory, current } = setup(snapshot({ source: YOUTUBE }), 'youtube')
    sync.attach(container)

    sync.toggleCollapsed()
    await nextTick()

    expect(current().destroy).not.toHaveBeenCalled()
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('on the web a collapsed YouTube player is only hidden', async () => {
    const { sync, current } = setup(snapshot({ source: YOUTUBE }), 'youtube')
    sync.attach(container)

    sync.toggleCollapsed()
    await nextTick()

    expect(current().destroy).not.toHaveBeenCalled()
  })

  it('a direct link on Capacitor is only hidden when collapsed (audio continues)', async () => {
    platform.value = 'android'
    const { sync, factory, current } = setup()
    sync.attach(container)

    sync.toggleCollapsed()
    await nextTick()

    expect(current().destroy).not.toHaveBeenCalled()
    expect(factory).toHaveBeenCalledTimes(1)
  })
})
