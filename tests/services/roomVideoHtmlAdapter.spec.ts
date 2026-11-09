// ========================================
// roomVideoHtmlAdapter Tests (room-video-player 07)
// ========================================
// Vitest runs in the 'node' environment (no jsdom / happy-dom installed), so the
// adapter is exercised through its injected deps: a hand-written fake <video>,
// a fake container, a fake Hls class and a controllable hls.js loader.
// Prior art for DOM-free service tests: voicePlaybackEngine.spec.ts.
// Covers: mp4, hls.js vs native-HLS gating by user agent, load tokens (destroy /
// newer load during the async import), one Hls per adapter, play() never
// rejecting, seek-before-metadata, idempotent destroy, isAppleWebKit table.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createHtmlVideoAdapter,
  isAppleWebKit,
  type HlsConstructorLike,
} from '~/services/roomVideoHtmlAdapter'
import type {
  RoomVideoSource,
  VideoAdapterError,
  VideoAdapterEvent,
  VideoPlayerAdapter,
} from '~/types/room/video'

// ========================================
// Fixtures
// ========================================

const MP4_URL = 'https://cdn.example.com/movie.mp4'
const HLS_URL = 'https://cdn.example.com/live/index.m3u8'

const MP4_SOURCE: RoomVideoSource = { kind: 'url', url: MP4_URL, container: 'mp4' }
const HLS_SOURCE: RoomVideoSource = { kind: 'url', url: HLS_URL, container: 'hls' }
const YOUTUBE_SOURCE: RoomVideoSource = { kind: 'youtube', videoId: 'dQw4w9WgXcQ' }

const HAVE_METADATA = 1
const HAVE_NOTHING = 0

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  ipadChrome:
    'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1',
  capacitorIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
  androidWebView:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/123.0.0.0 Mobile Safari/537.36',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  edge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.2420.65',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
} as const

interface HlsErrorPayload {
  fatal?: boolean
  type?: string
  details?: string
}

/** Minimal `<video>`: records `src` writes, fires events on demand. */
class FakeVideo {
  private srcValue = ''
  readonly srcWrites: string[] = []
  readonly attributes = new Map<string, string>()
  readonly style: Record<string, string> = {}
  readonly listeners = new Map<string, Set<() => void>>()
  preload = ''
  currentTime = 0
  muted = false
  readyState = HAVE_NOTHING
  error: { code: number; message: string } | null = null

  play = vi.fn((): Promise<void> => Promise.resolve())
  pause = vi.fn()
  load = vi.fn(() => {
    this.readyState = HAVE_NOTHING
  })
  canPlayType = vi.fn((_type: string): string => '')
  remove = vi.fn()

  get src(): string {
    return this.srcValue
  }

  set src(value: string) {
    this.srcValue = value
    this.srcWrites.push(value)
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  removeAttribute(name: string): void {
    if (name === 'src') this.srcValue = ''
    this.attributes.delete(name)
  }

  addEventListener(type: string, listener: () => void): void {
    const group = this.listeners.get(type) ?? new Set()
    group.add(listener)
    this.listeners.set(type, group)
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  /** Test helper: fire a media event at the registered listeners. */
  dispatch(type: string): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener()
  }

  /** Test helper: the browser has parsed metadata. */
  loadMetadata(): void {
    this.readyState = HAVE_METADATA
    this.dispatch('loadedmetadata')
  }
}

/** Fake hls.js class; `instances` lists every `new Hls()` of the current test. */
class FakeHls {
  static instances: FakeHls[] = []
  static supported = true
  static readonly Events = { ERROR: 'hlsError' }
  static readonly ErrorTypes = { MEDIA_ERROR: 'mediaError', NETWORK_ERROR: 'networkError' }

  static isSupported(): boolean {
    return FakeHls.supported
  }

  private readonly handlers = new Map<string, (event: string, data: HlsErrorPayload) => void>()

  loadSource = vi.fn()
  attachMedia = vi.fn()
  destroy = vi.fn()
  recoverMediaError = vi.fn()
  on = vi.fn((event: string, listener: (event: string, data: HlsErrorPayload) => void) => {
    this.handlers.set(event, listener)
  })

  constructor() {
    FakeHls.instances.push(this)
  }

  /** Test helper: hls.js reports an error. */
  fireError(data: HlsErrorPayload): void {
    this.handlers.get(FakeHls.Events.ERROR)?.(FakeHls.Events.ERROR, data)
  }
}

const FakeHlsClass: HlsConstructorLike = FakeHls

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

/** Let queued microtasks and the (resolved) dynamic-import promise settle. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function notAllowedError(): Error {
  return Object.assign(new Error('play() failed: autoplay'), { name: 'NotAllowedError' })
}

interface Harness {
  adapter: VideoPlayerAdapter
  video: FakeVideo
  container: { appendChild: ReturnType<typeof vi.fn> }
  events: VideoAdapterEvent[]
  errors: VideoAdapterError[]
}

interface HarnessOptions {
  userAgent?: string
  loadHls?: () => Promise<HlsConstructorLike>
}

const ALL_EVENTS: VideoAdapterEvent[] = ['ready', 'playing', 'paused', 'ended', 'error', 'blocked']

function setup(options: HarnessOptions = {}): Harness {
  const video = new FakeVideo()
  const container = { appendChild: vi.fn() }
  const adapter = createHtmlVideoAdapter(container as unknown as HTMLElement, {
    createVideo: () => video as unknown as HTMLVideoElement,
    loadHls: options.loadHls ?? (() => Promise.resolve(FakeHlsClass)),
    userAgent: () => options.userAgent ?? UA.desktopChrome,
  })
  const events: VideoAdapterEvent[] = []
  const errors: VideoAdapterError[] = []
  for (const event of ALL_EVENTS) {
    adapter.on(event, (error) => {
      events.push(event)
      if (error) errors.push(error)
    })
  }
  return { adapter, video, container, events, errors }
}

// ========================================
// Tests
// ========================================

beforeEach(() => {
  FakeHls.instances = []
  FakeHls.supported = true
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'debug').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('element setup', () => {
  it('creates one inline, controls-free, contained <video> inside the container', () => {
    const { video, container } = setup()

    expect(container.appendChild).toHaveBeenCalledTimes(1)
    expect(container.appendChild).toHaveBeenCalledWith(video)
    expect(video.attributes.has('playsinline')).toBe(true)
    expect(video.attributes.has('webkit-playsinline')).toBe(true)
    expect(video.attributes.has('controls')).toBe(false)
    expect(video.preload).toBe('auto')
    expect(video.style).toMatchObject({ width: '100%', height: '100%', objectFit: 'contain' })
  })
})

describe('load: mp4', () => {
  it('sets src on the element and never touches hls.js', async () => {
    const loadHls = vi.fn(() => Promise.resolve(FakeHlsClass))
    const { adapter, video } = setup({ loadHls })

    adapter.load(MP4_SOURCE)
    await flush()

    expect(video.src).toBe(MP4_URL)
    expect(loadHls).not.toHaveBeenCalled()
    expect(FakeHls.instances).toHaveLength(0)
  })

  it('clears the previous src before applying a new one', () => {
    const { adapter, video } = setup()

    adapter.load(MP4_SOURCE)
    adapter.load({ kind: 'url', url: 'https://cdn.example.com/other.mp4', container: 'mp4' })

    expect(video.load).toHaveBeenCalledTimes(2)
    expect(video.src).toBe('https://cdn.example.com/other.mp4')
  })
})

describe('load: youtube', () => {
  it('emits error unsupported_source and play() does not touch the element', async () => {
    const { adapter, video, errors } = setup()

    adapter.load(YOUTUBE_SOURCE)
    await adapter.play()

    expect(errors.map((e) => e.code)).toEqual(['unsupported_source'])
    expect(video.play).not.toHaveBeenCalled()
    expect(video.srcWrites).toEqual([])
  })
})

describe('load: hls', () => {
  it('uses hls.js when it is supported (one instance, loadSource + attachMedia)', async () => {
    const { adapter, video } = setup()

    adapter.load(HLS_SOURCE)
    await flush()

    expect(FakeHls.instances).toHaveLength(1)
    const [hls] = FakeHls.instances
    expect(hls!.loadSource).toHaveBeenCalledWith(HLS_URL)
    expect(hls!.attachMedia).toHaveBeenCalledWith(video)
    expect(video.srcWrites).toEqual([])
  })

  it('uses hls.js on an Apple device too when it is supported', async () => {
    const { adapter, video } = setup({ userAgent: UA.iphoneSafari })
    video.canPlayType.mockReturnValue('maybe')

    adapter.load(HLS_SOURCE)
    await flush()

    expect(FakeHls.instances).toHaveLength(1)
    expect(video.srcWrites).toEqual([])
  })

  it('falls back to native HLS only for an Apple WebKit UA when hls.js is unsupported', async () => {
    FakeHls.supported = false
    const { adapter, video, errors } = setup({ userAgent: UA.iphoneSafari })
    video.canPlayType.mockReturnValue('maybe')

    adapter.load(HLS_SOURCE)
    await flush()

    expect(video.canPlayType).toHaveBeenCalledWith('application/vnd.apple.mpegurl')
    expect(video.src).toBe(HLS_URL)
    expect(FakeHls.instances).toHaveLength(0)
    expect(errors).toEqual([])
  })

  it('emits hls_unsupported on Chrome when hls.js is unsupported, even if canPlayType says maybe', async () => {
    FakeHls.supported = false
    const { adapter, video, errors } = setup({ userAgent: UA.androidChrome })
    video.canPlayType.mockReturnValue('maybe')

    adapter.load(HLS_SOURCE)
    await flush()

    expect(errors.map((e) => e.code)).toEqual(['hls_unsupported'])
    expect(video.srcWrites).toEqual([])
    expect(FakeHls.instances).toHaveLength(0)
  })

  it('emits hls_unsupported on Apple WebKit when the element cannot play HLS natively', async () => {
    FakeHls.supported = false
    const { adapter, video, errors } = setup({ userAgent: UA.macSafari })

    adapter.load(HLS_SOURCE)
    await flush()

    expect(errors.map((e) => e.code)).toEqual(['hls_unsupported'])
    expect(video.srcWrites).toEqual([])
  })

  it('emits hls_load_failed when the hls.js chunk cannot be loaded', async () => {
    const { adapter, errors, video } = setup({ loadHls: () => Promise.reject(new Error('offline')) })

    adapter.load(HLS_SOURCE)
    await flush()
    await adapter.play()

    expect(errors.map((e) => e.code)).toEqual(['hls_load_failed'])
    expect(video.play).not.toHaveBeenCalled()
  })

  it('destroys the previous Hls on a second load (one live instance per adapter)', async () => {
    const { adapter, video } = setup()

    adapter.load(HLS_SOURCE)
    await flush()
    adapter.load({ kind: 'url', url: 'https://cdn.example.com/other/index.m3u8', container: 'hls' })

    // Old instance is gone synchronously, before the new import resolves.
    const [first] = FakeHls.instances
    expect(first!.destroy).toHaveBeenCalledTimes(1)
    expect(video.load).toHaveBeenCalled()

    await flush()

    expect(FakeHls.instances).toHaveLength(2)
    const [, second] = FakeHls.instances
    expect(first!.destroy).toHaveBeenCalledTimes(1)
    expect(second!.destroy).not.toHaveBeenCalled()
    expect(second!.loadSource).toHaveBeenCalledWith('https://cdn.example.com/other/index.m3u8')
  })

  it('destroys the Hls when switching from hls to mp4', async () => {
    const { adapter, video } = setup()

    adapter.load(HLS_SOURCE)
    await flush()
    adapter.load(MP4_SOURCE)

    expect(FakeHls.instances[0]!.destroy).toHaveBeenCalledTimes(1)
    expect(video.src).toBe(MP4_URL)
  })

  it('attaches nothing when the import resolves after destroy()', async () => {
    const gate = createDeferred<HlsConstructorLike>()
    const { adapter, video } = setup({ loadHls: () => gate.promise })

    adapter.load(HLS_SOURCE)
    adapter.destroy()
    gate.resolve(FakeHlsClass)
    await flush()

    expect(FakeHls.instances).toHaveLength(0)
    expect(video.srcWrites).toEqual([])
  })

  it('attaches nothing for a load that a newer load superseded during the import', async () => {
    const slow = createDeferred<HlsConstructorLike>()
    let calls = 0
    const { adapter, video, errors } = setup({
      loadHls: () => (++calls === 1 ? slow.promise : Promise.resolve(FakeHlsClass)),
    })

    adapter.load(HLS_SOURCE)
    adapter.load(MP4_SOURCE)
    slow.resolve(FakeHlsClass)
    await flush()

    expect(FakeHls.instances).toHaveLength(0)
    expect(video.src).toBe(MP4_URL)
    expect(errors).toEqual([])
  })

  it('does not emit hls_unsupported for a load that was superseded', async () => {
    FakeHls.supported = false
    const slow = createDeferred<HlsConstructorLike>()
    const { adapter, errors } = setup({ loadHls: () => slow.promise, userAgent: UA.androidChrome })

    adapter.load(HLS_SOURCE)
    adapter.load(MP4_SOURCE)
    slow.resolve(FakeHlsClass)
    await flush()

    expect(errors).toEqual([])
  })
})

describe('play', () => {
  it('plays the element', async () => {
    const { adapter, video } = setup()
    adapter.load(MP4_SOURCE)

    await adapter.play()

    expect(video.play).toHaveBeenCalledTimes(1)
  })

  it('waits for a pending HLS attach before playing', async () => {
    const gate = createDeferred<HlsConstructorLike>()
    const { adapter, video } = setup({ loadHls: () => gate.promise })
    adapter.load(HLS_SOURCE)

    const playing = adapter.play()
    await flush()
    expect(video.play).not.toHaveBeenCalled()

    gate.resolve(FakeHlsClass)
    await playing

    expect(FakeHls.instances[0]!.attachMedia).toHaveBeenCalledWith(video)
    expect(video.play).toHaveBeenCalledTimes(1)
  })

  it('emits blocked on NotAllowedError and resolves', async () => {
    const { adapter, video, events, errors } = setup()
    video.play.mockRejectedValue(notAllowedError())
    adapter.load(MP4_SOURCE)

    await expect(adapter.play()).resolves.toBeUndefined()

    expect(events).toEqual(['blocked'])
    expect(errors).toEqual([])
  })

  it('emits error on any other rejection and resolves', async () => {
    const { adapter, video, errors } = setup()
    video.play.mockRejectedValue(
      Object.assign(new Error('no supported source'), { name: 'NotSupportedError' }),
    )
    adapter.load(MP4_SOURCE)

    await expect(adapter.play()).resolves.toBeUndefined()

    expect(errors).toEqual([{ code: 'play_failed', message: 'no supported source' }])
  })

  it('treats an AbortError (play interrupted by our own pause/load) as neither blocked nor error', async () => {
    const { adapter, video, events } = setup()
    video.play.mockRejectedValue(Object.assign(new Error('interrupted'), { name: 'AbortError' }))
    adapter.load(MP4_SOURCE)

    await expect(adapter.play()).resolves.toBeUndefined()

    expect(events).toEqual([])
  })

  it('resolves silently after destroy()', async () => {
    const { adapter, video, events } = setup()
    adapter.destroy()

    await expect(adapter.play()).resolves.toBeUndefined()

    expect(video.play).not.toHaveBeenCalled()
    expect(events).toEqual([])
  })
})

describe('seek and currentTime', () => {
  it('applies a seek that arrived before metadata on loadedmetadata (last one wins)', () => {
    const { adapter, video } = setup()
    adapter.load(MP4_SOURCE)

    adapter.seek(30)
    adapter.seek(42)
    expect(video.currentTime).toBe(0)

    video.loadMetadata()

    expect(video.currentTime).toBe(42)
  })

  it('drops a pending seek when a new source loads', () => {
    const { adapter, video } = setup()
    adapter.load(MP4_SOURCE)
    adapter.seek(30)

    adapter.load({ kind: 'url', url: 'https://cdn.example.com/other.mp4', container: 'mp4' })
    video.loadMetadata()

    expect(video.currentTime).toBe(0)
  })

  it('applies a seek made right after a new load once that source has metadata', () => {
    const { adapter, video } = setup()
    adapter.load(MP4_SOURCE)
    video.loadMetadata()

    adapter.load({ kind: 'url', url: 'https://cdn.example.com/other.mp4', container: 'mp4' })
    adapter.seek(12)
    video.loadMetadata()

    expect(video.currentTime).toBe(12)
  })

  it('sets currentTime directly once metadata is available', () => {
    const { adapter, video } = setup()
    adapter.load(MP4_SOURCE)
    video.loadMetadata()

    adapter.seek(7.5)

    expect(video.currentTime).toBe(7.5)
  })

  it('ignores a non-finite seek', () => {
    const { adapter, video } = setup()
    adapter.load(MP4_SOURCE)
    video.loadMetadata()
    video.currentTime = 3

    adapter.seek(Number.NaN)

    expect(video.currentTime).toBe(3)
  })

  it('currentTime() returns the element position, or 0 when it is NaN or unset', () => {
    const { adapter, video } = setup()
    expect(adapter.currentTime()).toBe(0)

    video.currentTime = 12.25
    expect(adapter.currentTime()).toBe(12.25)

    video.currentTime = Number.NaN
    expect(adapter.currentTime()).toBe(0)
  })
})

describe('events', () => {
  it('maps element events to adapter events', () => {
    const { adapter, video, events } = setup()
    adapter.load(MP4_SOURCE)

    video.dispatch('playing')
    video.dispatch('pause')
    video.dispatch('ended')

    expect(events).toEqual(['playing', 'paused', 'ended'])
  })

  it('emits ready once per load', () => {
    const { adapter, video, events } = setup()
    adapter.load(MP4_SOURCE)

    video.loadMetadata()
    video.loadMetadata()
    expect(events).toEqual(['ready'])

    adapter.load({ kind: 'url', url: 'https://cdn.example.com/other.mp4', container: 'mp4' })
    video.loadMetadata()
    expect(events).toEqual(['ready', 'ready'])
  })

  it('maps a media element error to media_<code>', () => {
    const { adapter, video, errors } = setup()
    adapter.load(MP4_SOURCE)

    video.error = { code: 4, message: 'MEDIA_ELEMENT_ERROR: Format error' }
    video.dispatch('error')

    expect(errors).toEqual([{ code: 'media_4', message: 'MEDIA_ELEMENT_ERROR: Format error' }])
  })

  it('returns an unsubscribe function from on()', () => {
    const { adapter, video } = setup()
    const callback = vi.fn()
    const off = adapter.on('playing', callback)

    video.dispatch('playing')
    off()
    video.dispatch('playing')

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('keeps notifying other subscribers when one throws', () => {
    const { adapter, video } = setup()
    const survivor = vi.fn()
    adapter.on('playing', () => {
      throw new Error('boom')
    })
    adapter.on('playing', survivor)

    video.dispatch('playing')

    expect(survivor).toHaveBeenCalledTimes(1)
  })
})

describe('hls.js errors', () => {
  async function loadedHls(): Promise<{ harness: Harness; hls: FakeHls }> {
    const harness = setup()
    harness.adapter.load(HLS_SOURCE)
    await flush()
    return { harness, hls: FakeHls.instances[0]! }
  }

  it('ignores non-fatal errors', async () => {
    const { harness, hls } = await loadedHls()

    hls.fireError({ fatal: false, type: 'networkError', details: 'fragLoadError' })

    expect(harness.errors).toEqual([])
    expect(hls.recoverMediaError).not.toHaveBeenCalled()
  })

  it('recovers a fatal media error once, then reports the second', async () => {
    const { harness, hls } = await loadedHls()

    hls.fireError({ fatal: true, type: 'mediaError', details: 'bufferAppendError' })
    expect(hls.recoverMediaError).toHaveBeenCalledTimes(1)
    expect(harness.errors).toEqual([])

    hls.fireError({ fatal: true, type: 'mediaError', details: 'bufferAppendError' })
    expect(hls.recoverMediaError).toHaveBeenCalledTimes(1)
    expect(harness.errors.map((e) => e.code)).toEqual(['hls_mediaError'])
  })

  it('reports any other fatal error immediately', async () => {
    const { harness, hls } = await loadedHls()

    hls.fireError({ fatal: true, type: 'networkError', details: 'manifestLoadError' })

    expect(hls.recoverMediaError).not.toHaveBeenCalled()
    expect(harness.errors).toEqual([{ code: 'hls_networkError', message: 'manifestLoadError' }])
  })

  it('allows one media-error recovery again after a new load', async () => {
    const { harness, hls } = await loadedHls()
    hls.fireError({ fatal: true, type: 'mediaError' })

    harness.adapter.load(HLS_SOURCE)
    await flush()
    const second = FakeHls.instances[1]!
    second.fireError({ fatal: true, type: 'mediaError' })

    expect(second.recoverMediaError).toHaveBeenCalledTimes(1)
    expect(harness.errors).toEqual([])
  })

  it('ignores errors from a destroyed instance', async () => {
    const { harness, hls } = await loadedHls()
    harness.adapter.load(MP4_SOURCE)

    hls.fireError({ fatal: true, type: 'networkError' })

    expect(harness.errors).toEqual([])
  })
})

describe('setMuted', () => {
  it('mutes and unmutes the element', () => {
    const { adapter, video } = setup()

    adapter.setMuted(true)
    expect(video.muted).toBe(true)

    adapter.setMuted(false)
    expect(video.muted).toBe(false)
  })
})

describe('pause', () => {
  it('pauses the element', () => {
    const { adapter, video } = setup()

    adapter.pause()

    expect(video.pause).toHaveBeenCalledTimes(1)
  })
})

describe('destroy', () => {
  it('is idempotent: tears down once, removes the element, drops listeners and subscribers', async () => {
    const { adapter, video, events } = setup()
    adapter.load(HLS_SOURCE)
    await flush()
    const hls = FakeHls.instances[0]!

    adapter.destroy()
    adapter.destroy()

    expect(hls.destroy).toHaveBeenCalledTimes(1)
    expect(video.remove).toHaveBeenCalledTimes(1)
    expect(video.pause).toHaveBeenCalledTimes(1)
    expect(video.src).toBe('')
    // Every element listener was removed, and nothing reaches subscribers.
    for (const group of video.listeners.values()) expect(group.size).toBe(0)
    video.dispatch('playing')
    expect(events).toEqual([])
  })

  it('ignores load, seek and on after destroy', () => {
    const { adapter, video } = setup()
    adapter.destroy()

    adapter.load(MP4_SOURCE)
    adapter.seek(5)
    const off = adapter.on('playing', vi.fn())

    expect(video.srcWrites).toEqual([])
    expect(video.currentTime).toBe(0)
    expect(() => off()).not.toThrow()
  })
})

describe('isAppleWebKit', () => {
  it.each([
    ['iPhone Safari', UA.iphoneSafari],
    ['iPad Chrome (CriOS)', UA.ipadChrome],
    ['Capacitor iOS WKWebView (no "Safari" in UA)', UA.capacitorIos],
    ['macOS Safari', UA.macSafari],
  ])('%s -> true', (_label, ua) => {
    expect(isAppleWebKit(ua)).toBe(true)
  })

  it.each([
    ['Android Chrome', UA.androidChrome],
    ['Android WebView (Capacitor Android)', UA.androidWebView],
    ['desktop Chrome', UA.desktopChrome],
    ['Edge', UA.edge],
    ['Firefox', UA.firefox],
    ['empty string', ''],
  ])('%s -> false', (_label, ua) => {
    expect(isAppleWebKit(ua)).toBe(false)
  })
})
