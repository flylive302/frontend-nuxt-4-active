// ========================================
// roomVideoYouTubeAdapter Tests (room-video-player 08)
// ========================================
// Vitest runs in the 'node' environment (no jsdom / happy-dom installed), so the
// adapter is exercised through its injected deps: a fake YT.Player class that
// records calls and fires onReady / onStateChange / onError on demand, fake host
// and container elements, a controllable API loader and a fake page global for
// the script loader. The autoplay probe runs on vitest fake timers.
// Prior art for DOM-free service tests: roomVideoHtmlAdapter.spec.ts.
// Covers: player vars + host, queue-until-ready (load/seek/play/pause before the
// player exists), intent gating (seek / cue / PLAYING while paused never reach the
// sync as `playing`), the autoplay probe (never armed on a running player), error
// mapping (userMessage + technical message, one per load), the page-wide API
// script singleton, and idempotent destroy with late async resolution.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ROOM_VIDEO_YOUTUBE_API_SRC,
  ROOM_VIDEO_YOUTUBE_AUTOPLAY_PROBE_MS,
  ROOM_VIDEO_YOUTUBE_SEEK_HINT_MS,
} from '~/constants/room'
import {
  __resetYouTubeApiForTest,
  createYouTubeVideoAdapter,
  loadYouTubeIframeApi,
  mapYouTubeError,
  YT_PLAYER_STATE,
  type YouTubeApiGlobal,
  type YouTubeApiLoaderDeps,
  type YTNamespaceLike,
  type YTPlayerOptionsLike,
  type YTVideoByIdArgsLike,
} from '~/services/roomVideoYouTubeAdapter'
import type {
  RoomVideoSource,
  VideoAdapterError,
  VideoAdapterEvent,
  VideoPlayerAdapter,
} from '~/types/room/video'

// ========================================
// Fixtures
// ========================================

const VIDEO_ID = 'dQw4w9WgXcQ'
const OTHER_VIDEO_ID = 'jNQXAC9IVRw'

const YOUTUBE_SOURCE: RoomVideoSource = { kind: 'youtube', videoId: VIDEO_ID }
const OTHER_YOUTUBE_SOURCE: RoomVideoSource = { kind: 'youtube', videoId: OTHER_VIDEO_ID }
const URL_SOURCE: RoomVideoSource = {
  kind: 'url',
  url: 'https://cdn.example.com/movie.mp4',
  container: 'mp4',
}

const ALL_EVENTS: VideoAdapterEvent[] = ['ready', 'playing', 'paused', 'ended', 'error', 'blocked']

/** Fake `YT.Player`: records every call (in order) and fires the player callbacks on demand. */
class FakeYtPlayer {
  static instances: FakeYtPlayer[] = []

  readonly host: HTMLElement
  readonly options: YTPlayerOptionsLike
  /** Method names in call order, for "X then Y" assertions. */
  readonly calls: string[] = []
  currentTimeValue = 0
  durationValue = 0

  cueVideoById = vi.fn((_args: YTVideoByIdArgsLike) => {
    this.calls.push('cueVideoById')
  })
  loadVideoById = vi.fn((_args: YTVideoByIdArgsLike) => {
    this.calls.push('loadVideoById')
  })
  playVideo = vi.fn(() => {
    this.calls.push('playVideo')
  })
  pauseVideo = vi.fn(() => {
    this.calls.push('pauseVideo')
  })
  seekTo = vi.fn((_seconds: number, _allowSeekAhead: boolean) => {
    this.calls.push('seekTo')
  })
  mute = vi.fn(() => {
    this.calls.push('mute')
  })
  unMute = vi.fn(() => {
    this.calls.push('unMute')
  })
  destroy = vi.fn(() => {
    this.calls.push('destroy')
  })
  getCurrentTime = vi.fn((): number => this.currentTimeValue)
  getDuration = vi.fn((): number => this.durationValue)

  constructor(host: HTMLElement, options: YTPlayerOptionsLike) {
    this.host = host
    this.options = options
    FakeYtPlayer.instances.push(this)
  }

  fireReady(): void {
    this.options.events.onReady()
  }

  fireState(state: number): void {
    this.options.events.onStateChange({ data: state })
  }

  fireError(code: number): void {
    this.options.events.onError({ data: code })
  }
}

const FakeYtNamespace: YTNamespaceLike = { Player: FakeYtPlayer }

/** Stands in for the element YT swaps for its iframe. */
class FakeHost {
  remove = vi.fn()
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Let queued microtasks settle (fake timers are on, so no real `setTimeout`). */
async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
}

interface Harness {
  adapter: VideoPlayerAdapter
  container: { appendChild: ReturnType<typeof vi.fn> }
  hosts: FakeHost[]
  loadApi: ReturnType<typeof vi.fn<() => Promise<YTNamespaceLike>>>
  events: VideoAdapterEvent[]
  errors: VideoAdapterError[]
}

interface HarnessOptions {
  loadApi?: () => Promise<YTNamespaceLike>
}

function setup(options: HarnessOptions = {}): Harness {
  const container = { appendChild: vi.fn() }
  const hosts: FakeHost[] = []
  const loadApi = vi.fn(options.loadApi ?? (() => Promise.resolve(FakeYtNamespace)))
  const adapter = createYouTubeVideoAdapter(container as unknown as HTMLElement, {
    loadApi,
    createHost: () => {
      const host = new FakeHost()
      hosts.push(host)
      return host as unknown as HTMLElement
    },
  })
  const events: VideoAdapterEvent[] = []
  const errors: VideoAdapterError[] = []
  for (const event of ALL_EVENTS) {
    adapter.on(event, (error) => {
      events.push(event)
      if (error) errors.push(error)
    })
  }
  return { adapter, container, hosts, loadApi, events, errors }
}

/** `load()` + let the API promise settle; returns the player the adapter created (not yet ready). */
async function loadAndMount(
  harness: Harness,
  source: RoomVideoSource = YOUTUBE_SOURCE,
): Promise<FakeYtPlayer> {
  harness.adapter.load(source)
  await flush()
  const player = FakeYtPlayer.instances.at(-1)
  if (!player) throw new Error('adapter did not create a player')
  return player
}

function count(events: VideoAdapterEvent[], event: VideoAdapterEvent): number {
  return events.filter((e) => e === event).length
}

// ========================================
// Tests
// ========================================

beforeEach(() => {
  vi.useFakeTimers()
  FakeYtPlayer.instances = []
  __resetYouTubeApiForTest()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'debug').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('player creation', () => {
  it('creates the player with the fixed playerVars inside a host appended to the container', async () => {
    const harness = setup()

    const player = await loadAndMount(harness)

    expect(harness.hosts).toHaveLength(1)
    expect(harness.container.appendChild).toHaveBeenCalledTimes(1)
    expect(harness.container.appendChild).toHaveBeenCalledWith(harness.hosts[0])
    expect(player.host).toBe(harness.hosts[0])
    expect(player.options.playerVars).toEqual({
      playsinline: 1,
      enablejsapi: 1,
      rel: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      autoplay: 0,
    })
    expect(player.options.playerVars).not.toHaveProperty('origin')
    expect(player.options.width).toBe('100%')
    expect(player.options.height).toBe('100%')
  })

  it('calls no player method before onReady', async () => {
    const harness = setup()
    const player = await loadAndMount(harness)

    harness.adapter.seek(5)
    harness.adapter.setMuted(true)
    await harness.adapter.play()
    harness.adapter.pause()

    expect(player.calls).toEqual([])
  })

  it('emits unsupported_source for a url source and builds no player', async () => {
    const harness = setup()

    harness.adapter.load(URL_SOURCE)
    await flush()

    expect(harness.errors.map((e) => e.code)).toEqual(['unsupported_source'])
    expect(harness.loadApi).not.toHaveBeenCalled()
    expect(FakeYtPlayer.instances).toHaveLength(0)
  })
})

describe('queue until ready', () => {
  it('load -> seek(42) -> pause() before ready: cues at 42, ready once and after the cue, no playing', async () => {
    const harness = setup()
    harness.adapter.load(YOUTUBE_SOURCE)
    harness.adapter.seek(42)
    harness.adapter.pause()
    await flush()
    const player = FakeYtPlayer.instances[0]!
    expect(harness.adapter.currentTime()).toBe(42)

    let callsWhenReadyFired: string[] = []
    harness.adapter.on('ready', () => {
      callsWhenReadyFired = [...player.calls]
    })
    player.fireReady()

    expect(player.cueVideoById).toHaveBeenCalledTimes(1)
    expect(player.cueVideoById).toHaveBeenCalledWith({ videoId: VIDEO_ID, startSeconds: 42 })
    expect(player.loadVideoById).not.toHaveBeenCalled()
    expect(player.playVideo).not.toHaveBeenCalled()
    expect(count(harness.events, 'ready')).toBe(1)
    expect(callsWhenReadyFired).toContain('cueVideoById')

    // YT reports 0 right after a cue; the adapter keeps answering with the start position.
    player.currentTimeValue = 0
    player.fireState(YT_PLAYER_STATE.UNSTARTED)
    player.fireState(YT_PLAYER_STATE.CUED)
    expect(harness.adapter.currentTime()).toBe(42)
    expect(count(harness.events, 'playing')).toBe(0)

    player.fireReady()
    expect(count(harness.events, 'ready')).toBe(1)
  })

  it('held case: load -> seek(30) with no play()/pause(): a PLAYING state is paused and never forwarded', async () => {
    const harness = setup()
    harness.adapter.load(YOUTUBE_SOURCE)
    harness.adapter.seek(30)
    await flush()
    const player = FakeYtPlayer.instances[0]!

    player.fireReady()
    expect(player.cueVideoById).toHaveBeenCalledWith({ videoId: VIDEO_ID, startSeconds: 30 })
    expect(player.loadVideoById).not.toHaveBeenCalled()

    player.fireState(YT_PLAYER_STATE.PLAYING)

    expect(player.pauseVideo).toHaveBeenCalledTimes(1)
    expect(count(harness.events, 'playing')).toBe(0)

    // BUFFERING while paused gets the same answer.
    player.fireState(YT_PLAYER_STATE.BUFFERING)
    expect(player.pauseVideo).toHaveBeenCalledTimes(2)
    expect(count(harness.events, 'playing')).toBe(0)
  })

  it('load -> seek(10) -> play() before ready: loads at 10 playing, one playing event', async () => {
    const harness = setup()
    harness.adapter.load(YOUTUBE_SOURCE)
    harness.adapter.seek(10)
    void harness.adapter.play()
    await flush()
    const player = FakeYtPlayer.instances[0]!

    let callsWhenReadyFired: string[] = []
    harness.adapter.on('ready', () => {
      callsWhenReadyFired = [...player.calls]
    })
    player.fireReady()

    expect(player.loadVideoById).toHaveBeenCalledTimes(1)
    expect(player.loadVideoById).toHaveBeenCalledWith({ videoId: VIDEO_ID, startSeconds: 10 })
    expect(player.cueVideoById).not.toHaveBeenCalled()
    expect(player.pauseVideo).not.toHaveBeenCalled()
    expect(callsWhenReadyFired).toContain('loadVideoById')
    expect(count(harness.events, 'ready')).toBe(1)
    expect(harness.adapter.currentTime()).toBe(10)

    player.fireState(YT_PLAYER_STATE.BUFFERING)
    player.fireState(YT_PLAYER_STATE.PLAYING)

    expect(count(harness.events, 'playing')).toBe(1)
    expect(player.pauseVideo).not.toHaveBeenCalled()

    // After a real state the adapter reads the player again.
    player.currentTimeValue = 12.5
    expect(harness.adapter.currentTime()).toBe(12.5)
  })

  it('last seek before ready wins, negatives clamp to 0, non-finite is ignored', async () => {
    const harness = setup()
    harness.adapter.load(YOUTUBE_SOURCE)
    harness.adapter.seek(30)
    harness.adapter.seek(Number.NaN)
    harness.adapter.seek(-5)
    await flush()
    const player = FakeYtPlayer.instances[0]!

    player.fireReady()

    expect(player.cueVideoById).toHaveBeenCalledWith({ videoId: VIDEO_ID, startSeconds: 0 })
  })

  it('a fresh load resets the intent to pause', async () => {
    const harness = setup()
    harness.adapter.load(YOUTUBE_SOURCE)
    void harness.adapter.play()
    await flush()
    const first = FakeYtPlayer.instances[0]!
    first.fireReady()
    expect(first.loadVideoById).toHaveBeenCalledTimes(1)

    const second = await loadAndMount(harness, OTHER_YOUTUBE_SOURCE)
    second.fireReady()

    expect(second.cueVideoById).toHaveBeenCalledWith({ videoId: OTHER_VIDEO_ID, startSeconds: 0 })
    expect(second.loadVideoById).not.toHaveBeenCalled()
    second.fireState(YT_PLAYER_STATE.PLAYING)
    expect(second.pauseVideo).toHaveBeenCalledTimes(1)
  })

  it('applies a remembered mute on ready (and unmutes explicitly otherwise)', async () => {
    const muted = setup()
    muted.adapter.setMuted(true)
    const mutedPlayer = await loadAndMount(muted)
    mutedPlayer.fireReady()
    expect(mutedPlayer.mute).toHaveBeenCalledTimes(1)
    expect(mutedPlayer.unMute).not.toHaveBeenCalled()

    const unmuted = setup()
    const unmutedPlayer = await loadAndMount(unmuted)
    unmutedPlayer.fireReady()
    expect(unmutedPlayer.unMute).toHaveBeenCalledTimes(1)
    expect(unmutedPlayer.mute).not.toHaveBeenCalled()
  })
})

describe('after ready', () => {
  async function readyPlayer(harness: Harness): Promise<FakeYtPlayer> {
    const player = await loadAndMount(harness)
    player.fireReady()
    player.calls.length = 0
    return player
  }

  it('seek while intent is pause: seekTo then pauseVideo', async () => {
    const harness = setup()
    const player = await readyPlayer(harness)

    harness.adapter.seek(55)

    expect(player.seekTo).toHaveBeenCalledWith(55, true)
    expect(player.calls).toEqual(['seekTo', 'pauseVideo'])
    expect(harness.adapter.currentTime()).toBe(55)
  })

  it('seek after an explicit pause() also pauses again, and clamps negatives to 0', async () => {
    const harness = setup()
    const player = await readyPlayer(harness)
    void harness.adapter.play()
    harness.adapter.pause()
    player.calls.length = 0

    harness.adapter.seek(-10)

    expect(player.seekTo).toHaveBeenLastCalledWith(0, true)
    expect(player.calls).toEqual(['seekTo', 'pauseVideo'])
  })

  it('a seek on a PLAYING player that reports no new state: the hint advances, then expires to the player', async () => {
    const harness = setup()
    const player = await readyPlayer(harness)
    void harness.adapter.play()
    player.fireState(YT_PLAYER_STATE.PLAYING)
    player.getCurrentTime.mockReturnValue(5)

    harness.adapter.seek(100)
    expect(harness.adapter.currentTime()).toBe(100)

    vi.advanceTimersByTime(ROOM_VIDEO_YOUTUBE_SEEK_HINT_MS / 2)
    expect(harness.adapter.currentTime()).toBeCloseTo(100 + ROOM_VIDEO_YOUTUBE_SEEK_HINT_MS / 2000)

    player.getCurrentTime.mockReturnValue(101.2)
    vi.advanceTimersByTime(ROOM_VIDEO_YOUTUBE_SEEK_HINT_MS)
    expect(harness.adapter.currentTime()).toBe(101.2)
  })

  it('a cued (never started) player keeps the seek hint however long it waits', async () => {
    const harness = setup()
    const player = await readyPlayer(harness)
    player.getCurrentTime.mockReturnValue(0)

    harness.adapter.seek(42)
    vi.advanceTimersByTime(ROOM_VIDEO_YOUTUBE_SEEK_HINT_MS * 10)

    expect(harness.adapter.currentTime()).toBe(42)
  })

  it('seek while intent is play does not pause', async () => {
    const harness = setup()
    const player = await readyPlayer(harness)
    void harness.adapter.play()
    player.calls.length = 0

    harness.adapter.seek(20)

    expect(player.calls).toEqual(['seekTo'])
  })

  it('play() calls playVideo, pause() calls pauseVideo, and PLAYING after play() is forwarded', async () => {
    const harness = setup()
    const player = await readyPlayer(harness)

    await harness.adapter.play()
    expect(player.calls).toEqual(['playVideo'])
    player.fireState(YT_PLAYER_STATE.PLAYING)
    expect(count(harness.events, 'playing')).toBe(1)

    harness.adapter.pause()
    expect(player.calls).toEqual(['playVideo', 'pauseVideo'])
  })

  it('maps PAUSED to paused and ENDED to ended; BUFFERING under play intent says nothing', async () => {
    const harness = setup()
    const player = await readyPlayer(harness)
    void harness.adapter.play()

    player.fireState(YT_PLAYER_STATE.BUFFERING)
    expect(harness.events).toEqual(['ready'])

    player.fireState(YT_PLAYER_STATE.PAUSED)
    player.fireState(YT_PLAYER_STATE.ENDED)

    expect(harness.events).toEqual(['ready', 'paused', 'ended'])
  })

  it('duration() is 0 before ready, then getDuration(); non-finite and negative read as 0', async () => {
    const harness = setup()
    const player = await loadAndMount(harness)
    player.durationValue = 180
    expect(harness.adapter.duration()).toBe(0)

    player.fireReady()
    expect(harness.adapter.duration()).toBe(180)

    player.durationValue = Number.NaN
    expect(harness.adapter.duration()).toBe(0)
    player.durationValue = -1
    expect(harness.adapter.duration()).toBe(0)
  })

  it('setMuted toggles mute()/unMute() once the player is ready', async () => {
    const harness = setup()
    const player = await readyPlayer(harness)

    harness.adapter.setMuted(true)
    harness.adapter.setMuted(false)

    expect(player.calls).toEqual(['mute', 'unMute'])
  })

  it('play() resolves and a throwing playVideo emits nothing', async () => {
    const harness = setup()
    const player = await readyPlayer(harness)
    player.playVideo.mockImplementation(() => {
      throw new Error('player not ready')
    })

    await expect(harness.adapter.play()).resolves.toBeUndefined()

    expect(harness.errors).toEqual([])
  })

  it('stale events of a replaced player are ignored', async () => {
    const harness = setup()
    const first = await readyPlayer(harness)
    const second = await loadAndMount(harness, OTHER_YOUTUBE_SOURCE)
    expect(first.destroy).toHaveBeenCalledTimes(1)

    first.fireState(YT_PLAYER_STATE.ENDED)
    first.fireError(100)
    first.fireReady()
    second.fireReady()

    expect(harness.events).toEqual(['ready', 'ready'])
    expect(harness.errors).toEqual([])
  })

  it('returns an unsubscribe function from on() and survives a throwing subscriber', async () => {
    const harness = setup()
    const player = await readyPlayer(harness)
    const survivor = vi.fn()
    const callback = vi.fn()
    harness.adapter.on('ended', () => {
      throw new Error('boom')
    })
    harness.adapter.on('ended', survivor)
    const off = harness.adapter.on('paused', callback)

    player.fireState(YT_PLAYER_STATE.PAUSED)
    off()
    player.fireState(YT_PLAYER_STATE.PAUSED)
    player.fireState(YT_PLAYER_STATE.ENDED)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(survivor).toHaveBeenCalledTimes(1)
  })
})

describe('autoplay probe', () => {
  it('play() with no state change: exactly one blocked after the probe window', async () => {
    const harness = setup()
    const player = await loadAndMount(harness)
    player.fireReady()

    await harness.adapter.play()
    vi.advanceTimersByTime(ROOM_VIDEO_YOUTUBE_AUTOPLAY_PROBE_MS - 1)
    expect(count(harness.events, 'blocked')).toBe(0)

    vi.advanceTimersByTime(1)
    expect(count(harness.events, 'blocked')).toBe(1)

    vi.advanceTimersByTime(ROOM_VIDEO_YOUTUBE_AUTOPLAY_PROBE_MS * 3)
    expect(count(harness.events, 'blocked')).toBe(1)
  })

  it('play() queued before ready arms the probe when ready starts playback', async () => {
    const harness = setup()
    harness.adapter.load(YOUTUBE_SOURCE)
    void harness.adapter.play()
    await flush()
    const player = FakeYtPlayer.instances[0]!
    expect(vi.getTimerCount()).toBe(0)

    player.fireReady()
    expect(vi.getTimerCount()).toBe(1)

    vi.advanceTimersByTime(ROOM_VIDEO_YOUTUBE_AUTOPLAY_PROBE_MS)
    expect(count(harness.events, 'blocked')).toBe(1)
  })

  it('BUFFERING arriving first: no blocked', async () => {
    const harness = setup()
    const player = await loadAndMount(harness)
    player.fireReady()

    await harness.adapter.play()
    player.fireState(YT_PLAYER_STATE.BUFFERING)
    vi.advanceTimersByTime(ROOM_VIDEO_YOUTUBE_AUTOPLAY_PROBE_MS * 2)

    expect(count(harness.events, 'blocked')).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a refusal that buffers and falls back to UNSTARTED is still blocked', async () => {
    const harness = setup()
    const player = await loadAndMount(harness)
    player.fireReady()

    await harness.adapter.play()
    player.fireState(YT_PLAYER_STATE.BUFFERING)
    player.fireState(YT_PLAYER_STATE.UNSTARTED)
    vi.advanceTimersByTime(ROOM_VIDEO_YOUTUBE_AUTOPLAY_PROBE_MS)

    expect(count(harness.events, 'blocked')).toBe(1)
  })

  it('PLAYING arriving first: no blocked', async () => {
    const harness = setup()
    const player = await loadAndMount(harness)
    player.fireReady()

    await harness.adapter.play()
    player.fireState(YT_PLAYER_STATE.PLAYING)
    vi.advanceTimersByTime(ROOM_VIDEO_YOUTUBE_AUTOPLAY_PROBE_MS * 2)

    expect(count(harness.events, 'blocked')).toBe(0)
  })

  it('play() on an already PLAYING player three times never arms the probe', async () => {
    const harness = setup()
    harness.adapter.load(YOUTUBE_SOURCE)
    void harness.adapter.play()
    await flush()
    const player = FakeYtPlayer.instances[0]!
    player.fireReady()
    player.fireState(YT_PLAYER_STATE.PLAYING)
    expect(vi.getTimerCount()).toBe(0)

    await harness.adapter.play()
    await harness.adapter.play()
    await harness.adapter.play()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(ROOM_VIDEO_YOUTUBE_AUTOPLAY_PROBE_MS * 2)

    expect(count(harness.events, 'blocked')).toBe(0)
  })

  it('play() on a BUFFERING player never arms the probe', async () => {
    const harness = setup()
    const player = await loadAndMount(harness)
    player.fireReady()
    player.fireState(YT_PLAYER_STATE.BUFFERING)
    // BUFFERING under pause intent: the adapter paused it; now the room says play.
    await harness.adapter.play()
    expect(vi.getTimerCount()).toBe(0)
    await harness.adapter.play()
    vi.advanceTimersByTime(ROOM_VIDEO_YOUTUBE_AUTOPLAY_PROBE_MS * 2)

    expect(count(harness.events, 'blocked')).toBe(0)
  })

  it('repeated play() before any state keeps a single timer and a single blocked', async () => {
    const harness = setup()
    const player = await loadAndMount(harness)
    player.fireReady()

    await harness.adapter.play()
    await harness.adapter.play()
    await harness.adapter.play()
    expect(vi.getTimerCount()).toBe(1)

    vi.advanceTimersByTime(ROOM_VIDEO_YOUTUBE_AUTOPLAY_PROBE_MS)
    expect(count(harness.events, 'blocked')).toBe(1)
  })

  it('a tap after blocked (play() again) arms a fresh probe', async () => {
    const harness = setup()
    const player = await loadAndMount(harness)
    player.fireReady()
    await harness.adapter.play()
    vi.advanceTimersByTime(ROOM_VIDEO_YOUTUBE_AUTOPLAY_PROBE_MS)
    expect(count(harness.events, 'blocked')).toBe(1)

    await harness.adapter.play()
    player.fireState(YT_PLAYER_STATE.PLAYING)
    vi.advanceTimersByTime(ROOM_VIDEO_YOUTUBE_AUTOPLAY_PROBE_MS * 2)

    expect(count(harness.events, 'blocked')).toBe(1)
    expect(count(harness.events, 'playing')).toBe(1)
  })

  it('pause(), load(), destroy() and an error each clear a pending probe', async () => {
    const paused = setup()
    const pausedPlayer = await loadAndMount(paused)
    pausedPlayer.fireReady()
    await paused.adapter.play()
    expect(vi.getTimerCount()).toBe(1)
    paused.adapter.pause()
    expect(vi.getTimerCount()).toBe(0)

    const reloaded = setup()
    const reloadedPlayer = await loadAndMount(reloaded)
    reloadedPlayer.fireReady()
    await reloaded.adapter.play()
    reloaded.adapter.load(OTHER_YOUTUBE_SOURCE)
    expect(vi.getTimerCount()).toBe(0)

    const destroyed = setup()
    const destroyedPlayer = await loadAndMount(destroyed)
    destroyedPlayer.fireReady()
    await destroyed.adapter.play()
    destroyed.adapter.destroy()
    expect(vi.getTimerCount()).toBe(0)

    const failed = setup()
    const failedPlayer = await loadAndMount(failed)
    failedPlayer.fireReady()
    await failed.adapter.play()
    failedPlayer.fireError(150)
    expect(vi.getTimerCount()).toBe(0)

    vi.advanceTimersByTime(ROOM_VIDEO_YOUTUBE_AUTOPLAY_PROBE_MS * 2)
    for (const harness of [paused, reloaded, destroyed, failed]) {
      expect(count(harness.events, 'blocked')).toBe(0)
    }
  })

  it('uses the injected timer functions', async () => {
    const handle = 7 as unknown as ReturnType<typeof setTimeout>
    const schedule = vi.fn((_callback: () => void, _ms: number) => handle)
    const cancel = vi.fn()
    const container = { appendChild: vi.fn() }
    const injected = createYouTubeVideoAdapter(container as unknown as HTMLElement, {
      loadApi: () => Promise.resolve(FakeYtNamespace),
      createHost: () => new FakeHost() as unknown as HTMLElement,
      setTimeout: schedule,
      clearTimeout: cancel,
    })
    injected.load(YOUTUBE_SOURCE)
    await flush()
    FakeYtPlayer.instances[0]!.fireReady()

    await injected.play()
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), ROOM_VIDEO_YOUTUBE_AUTOPLAY_PROBE_MS)

    injected.pause()
    expect(cancel).toHaveBeenCalledWith(handle)
  })
})

describe('errors', () => {
  const GENERIC = "This YouTube video can't play here. Try another one."
  const EMBED = "This video's owner doesn't allow it to play outside YouTube."

  it.each([
    [100, 'youtube_not_found', 'This YouTube video was removed or is private.'],
    [101, 'youtube_embed_disabled', EMBED],
    [150, 'youtube_embed_disabled', EMBED],
    [153, 'youtube_platform_blocked', "YouTube won't play inside this app. Open it on YouTube instead."],
    [2, 'youtube_bad_request', "That YouTube link doesn't look right. Paste it again."],
    [5, 'youtube_player_error', GENERIC],
    [999, 'youtube_player_error', GENERIC],
  ])('onError %i -> %s with a toast line and a technical message', async (code, errorCode, userMessage) => {
    expect(mapYouTubeError(code)).toEqual({
      code: errorCode,
      message: `YouTube onError ${code}`,
      userMessage,
    })

    const harness = setup()
    const player = await loadAndMount(harness)
    player.fireReady()
    player.fireError(code)

    expect(harness.errors).toEqual([
      { code: errorCode, message: `YouTube onError ${code}`, userMessage },
    ])
  })

  it('emits at most one error per load, and one again after the next load', async () => {
    const harness = setup()
    const first = await loadAndMount(harness)
    first.fireReady()

    first.fireError(100)
    first.fireError(150)
    first.fireError(2)
    expect(harness.errors.map((e) => e.code)).toEqual(['youtube_not_found'])

    const second = await loadAndMount(harness, OTHER_YOUTUBE_SOURCE)
    second.fireReady()
    second.fireError(150)
    second.fireError(150)

    expect(harness.errors.map((e) => e.code)).toEqual([
      'youtube_not_found',
      'youtube_embed_disabled',
    ])
  })

  it('a failed API load emits youtube_api_unavailable once and builds no player', async () => {
    const harness = setup({ loadApi: () => Promise.reject(new Error('offline')) })

    harness.adapter.load(YOUTUBE_SOURCE)
    await flush()

    expect(harness.errors).toEqual([
      {
        code: 'youtube_api_unavailable',
        message: 'YouTube iframe_api script failed to load',
        userMessage: "YouTube couldn't load. Check your connection and try again.",
      },
    ])
    expect(FakeYtPlayer.instances).toHaveLength(0)
  })

  it('a player that cannot be constructed emits youtube_player_error and drops its host', async () => {
    class ThrowingPlayer {
      readonly destroy = vi.fn()

      constructor() {
        throw new Error('constructor failed')
      }
    }
    const harness = setup({
      loadApi: () => Promise.resolve({ Player: ThrowingPlayer as unknown as YTNamespaceLike['Player'] }),
    })

    harness.adapter.load(YOUTUBE_SOURCE)
    await flush()

    expect(harness.errors.map((e) => e.code)).toEqual(['youtube_player_error'])
    expect(harness.hosts[0]!.remove).toHaveBeenCalledTimes(1)
  })
})

describe('YouTube API script loader', () => {
  interface InjectedScript {
    src: string
    onError: () => void
  }

  function loaderHarness(initial: YouTubeApiGlobal = {}) {
    const globalScope: YouTubeApiGlobal = { ...initial }
    const scripts: InjectedScript[] = []
    const deps: YouTubeApiLoaderDeps = {
      getGlobal: () => globalScope,
      injectScript: (src, onError) => {
        scripts.push({ src, onError })
      },
    }
    /** The API script finished: define `YT` and fire the page callback. */
    function finishLoading(): void {
      globalScope.YT = { Player: FakeYtPlayer }
      globalScope.onYouTubeIframeAPIReady?.()
    }
    return { globalScope, scripts, deps, finishLoading }
  }

  it('two adapters and two direct calls inject the script once and share one result', async () => {
    const { scripts, deps, finishLoading } = loaderHarness()
    const loadApi = () => loadYouTubeIframeApi(deps)
    const first = setup({ loadApi })
    const second = setup({ loadApi })

    first.adapter.load(YOUTUBE_SOURCE)
    second.adapter.load(YOUTUBE_SOURCE)
    const direct1 = loadYouTubeIframeApi(deps)
    const direct2 = loadYouTubeIframeApi(deps)
    await flush()

    expect(scripts).toHaveLength(1)
    expect(scripts[0]!.src).toBe(ROOM_VIDEO_YOUTUBE_API_SRC)
    expect(direct1).toBe(direct2)
    expect(FakeYtPlayer.instances).toHaveLength(0)

    finishLoading()
    await flush()

    await expect(direct1).resolves.toMatchObject({ Player: FakeYtPlayer })
    expect(scripts).toHaveLength(1)
    expect(FakeYtPlayer.instances).toHaveLength(2)
  })

  it('YT.Player already on the page: resolves with zero injections', async () => {
    const { scripts, deps, globalScope } = loaderHarness({ YT: { Player: FakeYtPlayer } })

    const yt = await loadYouTubeIframeApi(deps)
    await loadYouTubeIframeApi(deps)

    expect(yt.Player).toBe(FakeYtPlayer)
    expect(scripts).toHaveLength(0)
    expect(globalScope.onYouTubeIframeAPIReady).toBeUndefined()
  })

  it('a half-built YT (no Player yet) still injects', async () => {
    const { scripts, deps, finishLoading } = loaderHarness({ YT: {} })

    const loading = loadYouTubeIframeApi(deps)
    expect(scripts).toHaveLength(1)

    finishLoading()
    await expect(loading).resolves.toMatchObject({ Player: FakeYtPlayer })
  })

  it('chains a pre-existing onYouTubeIframeAPIReady instead of replacing it', async () => {
    const previous = vi.fn()
    const { deps, finishLoading } = loaderHarness({ onYouTubeIframeAPIReady: previous })

    const loading = loadYouTubeIframeApi(deps)
    expect(previous).not.toHaveBeenCalled()

    finishLoading()
    await loading

    expect(previous).toHaveBeenCalledTimes(1)
  })

  it('a script error rejects, clears the singleton, restores the old handler, and a retry injects again', async () => {
    const previous = vi.fn()
    const { scripts, deps, globalScope, finishLoading } = loaderHarness({
      onYouTubeIframeAPIReady: previous,
    })

    const first = loadYouTubeIframeApi(deps)
    const rejected = expect(first).rejects.toThrow('failed to load')
    scripts[0]!.onError()
    await rejected
    expect(globalScope.onYouTubeIframeAPIReady).toBe(previous)

    const retry = loadYouTubeIframeApi(deps)
    expect(scripts).toHaveLength(2)
    expect(retry).not.toBe(first)

    finishLoading()
    await expect(retry).resolves.toMatchObject({ Player: FakeYtPlayer })
    expect(previous).toHaveBeenCalledTimes(1)
  })

  it('adapter: a script error surfaces as youtube_api_unavailable, and the next load retries', async () => {
    const { scripts, deps, finishLoading } = loaderHarness()
    const harness = setup({ loadApi: () => loadYouTubeIframeApi(deps) })

    harness.adapter.load(YOUTUBE_SOURCE)
    scripts[0]!.onError()
    await flush()

    expect(harness.errors.map((e) => e.code)).toEqual(['youtube_api_unavailable'])
    expect(FakeYtPlayer.instances).toHaveLength(0)

    harness.adapter.load(YOUTUBE_SOURCE)
    expect(scripts).toHaveLength(2)
    finishLoading()
    await flush()

    expect(FakeYtPlayer.instances).toHaveLength(1)
    expect(harness.errors).toHaveLength(1)
  })

  it('__resetYouTubeApiForTest forgets a settled load', async () => {
    const { scripts, deps } = loaderHarness({ YT: { Player: FakeYtPlayer } })
    await loadYouTubeIframeApi(deps)

    __resetYouTubeApiForTest()
    const emptyPage = loaderHarness()
    void loadYouTubeIframeApi(emptyPage.deps)

    expect(scripts).toHaveLength(0)
    expect(emptyPage.scripts).toHaveLength(1)
  })
})

describe('destroy', () => {
  it('is idempotent: removes the host, destroys the player once, drops subscribers', async () => {
    const harness = setup()
    const player = await loadAndMount(harness)
    player.fireReady()

    harness.adapter.destroy()
    harness.adapter.destroy()

    expect(player.destroy).toHaveBeenCalledTimes(1)
    expect(harness.hosts[0]!.remove).toHaveBeenCalledTimes(1)

    const eventsBefore = harness.events.length
    player.fireState(YT_PLAYER_STATE.PLAYING)
    player.fireState(YT_PLAYER_STATE.ENDED)
    player.fireError(100)
    expect(harness.events).toHaveLength(eventsBefore)
  })

  it('destroys a player that never became ready and calls nothing else on it', async () => {
    const harness = setup()
    const player = await loadAndMount(harness)

    harness.adapter.destroy()
    player.fireReady()

    expect(player.calls).toEqual(['destroy'])
    expect(harness.hosts[0]!.remove).toHaveBeenCalledTimes(1)
    expect(count(harness.events, 'ready')).toBe(0)
  })

  it('every method is a no-op afterwards and play() still resolves', async () => {
    const harness = setup()
    const player = await loadAndMount(harness)
    player.fireReady()
    harness.adapter.destroy()
    player.calls.length = 0

    harness.adapter.load(YOUTUBE_SOURCE)
    harness.adapter.seek(5)
    harness.adapter.pause()
    harness.adapter.setMuted(true)
    await expect(harness.adapter.play()).resolves.toBeUndefined()
    const off = harness.adapter.on('playing', vi.fn())
    await flush()

    expect(player.calls).toEqual([])
    expect(harness.loadApi).toHaveBeenCalledTimes(1)
    expect(FakeYtPlayer.instances).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
    expect(() => off()).not.toThrow()
  })

  it('a loadApi that resolves after destroy() creates no player and no host', async () => {
    const gate = createDeferred<YTNamespaceLike>()
    const harness = setup({ loadApi: () => gate.promise })

    harness.adapter.load(YOUTUBE_SOURCE)
    harness.adapter.destroy()
    gate.resolve(FakeYtNamespace)
    await flush()

    expect(FakeYtPlayer.instances).toHaveLength(0)
    expect(harness.hosts).toHaveLength(0)
    expect(harness.container.appendChild).not.toHaveBeenCalled()
  })

  it('a loadApi that rejects after destroy() emits nothing', async () => {
    const gate = createDeferred<YTNamespaceLike>()
    const harness = setup({ loadApi: () => gate.promise })

    harness.adapter.load(YOUTUBE_SOURCE)
    harness.adapter.destroy()
    gate.reject(new Error('offline'))
    await flush()

    expect(harness.errors).toEqual([])
  })

  it('a load superseded by a newer load during the API wait creates only the newer player', async () => {
    const slow = createDeferred<YTNamespaceLike>()
    let calls = 0
    const harness = setup({
      loadApi: () => (++calls === 1 ? slow.promise : Promise.resolve(FakeYtNamespace)),
    })

    harness.adapter.load(YOUTUBE_SOURCE)
    harness.adapter.load(OTHER_YOUTUBE_SOURCE)
    slow.resolve(FakeYtNamespace)
    await flush()

    expect(FakeYtPlayer.instances).toHaveLength(1)
    expect(harness.hosts).toHaveLength(1)
    FakeYtPlayer.instances[0]!.fireReady()
    expect(FakeYtPlayer.instances[0]!.cueVideoById).toHaveBeenCalledWith({
      videoId: OTHER_VIDEO_ID,
      startSeconds: 0,
    })
  })
})
