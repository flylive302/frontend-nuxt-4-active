// ========================================
// useRoomVideoSync Tests (room-video-player 06)
// ========================================
// The sync composable driven against a fake adapter, the real store, fake timers
// and a mocked motion orchestrator. Asserts what the player is told to do —
// load / seek / play / pause / destroy — for each Snapshot and timer event.
// ========================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, nextTick, ref } from 'vue'
import type { RoomVideoSnapshot, VideoAdapterEvent, VideoPlayerAdapter } from '~/types/room/video'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

const authUser = { id: 7 as number | undefined }
vi.stubGlobal('useAuthStore', () => ({ user: authUser.id === undefined ? null : { id: authUser.id } }))

const toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: toastAdd }))

let awayCallback: ((away: boolean) => void) | null = null
const awayUnsubscribe = vi.fn()
let coverCounter = 0
const acquireCovered = vi.fn(() => `cover-${++coverCounter}`)
const releaseCovered = vi.fn()
vi.mock('~/services/motionPauseOrchestrator', () => ({
  acquireCovered: () => acquireCovered(),
  releaseCovered: (token: string) => releaseCovered(token),
  subscribeAway: (cb: (away: boolean) => void) => {
    awayCallback = cb
    return awayUnsubscribe
  },
}))
vi.mock('~/services/roomVideoHtmlAdapter', () => ({ createHtmlVideoAdapter: vi.fn() }))
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

const { useRoomVideoStore } = await import('~/stores/roomVideo')
const { useRoomVideoSync } = await import('~/composables/room/video/useRoomVideoSync')

// ----------------------------------------
// Fakes
// ----------------------------------------

interface FakeAdapter extends VideoPlayerAdapter {
  emit(event: VideoAdapterEvent): void
  setTime(sec: number): void
}

function makeFakeAdapter(): FakeAdapter {
  const listeners = new Map<VideoAdapterEvent, Set<() => void>>()
  let time = 0
  return {
    load: vi.fn(),
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    seek: vi.fn((sec: number) => {
      time = sec
    }),
    currentTime: vi.fn(() => time),
    setMuted: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn((event: VideoAdapterEvent, cb: () => void) => {
      const set = listeners.get(event) ?? new Set()
      set.add(cb)
      listeners.set(event, set)
      return () => set.delete(cb)
    }),
    emit(event) {
      listeners.get(event)?.forEach((cb) => cb())
    },
    setTime(sec) {
      time = sec
    },
  }
}

const NOW = 1_731_068_400_000
const MP4 = { kind: 'url', url: 'https://cdn.example.com/a.mp4', container: 'mp4' } as const

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

function setup(initial: RoomVideoSnapshot | null = snapshot()) {
  const store = useRoomVideoStore()
  store.startSession('room-1', true)
  store.replaceSnapshot(initial)
  const adapters: FakeAdapter[] = []
  const factory = vi.fn(() => {
    const adapter = makeFakeAdapter()
    adapters.push(adapter)
    return adapter
  })
  const sync = useRoomVideoSync({ url: factory })
  return { store, sync, factory, adapters, current: () => adapters[adapters.length - 1]! }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  vi.clearAllMocks()
  authUser.id = 7
  awayCallback = null
  coverCounter = 0
})

afterEach(() => {
  useRoomVideoSync().detach()
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
