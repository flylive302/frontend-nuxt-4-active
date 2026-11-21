// ========================================
// useFlyGameBridge — the Fly Games postMessage protocol for one open game
// ========================================
// Driven through the outer seam the browser gives us: a `message` event in, a
// `postMessage` / API call out. The protocol is the Fly team's
// (docs/reference/fly-games/vendor-messages.md §4); a regression here either
// leaks a launch token to the wrong window or leaves a player on a spinner.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { markRaw, nextTick, ref, type Ref } from 'vue'
import { setupNuxtMocks, cleanupNuxtMocks, createMockApi } from '../helpers/nuxtMocks'
import {
  FLY_GAME_LOGIN_FAILED_MESSAGE,
  FLY_GAME_MIN_MINT_INTERVAL_MS,
  FLY_GAME_UNAVAILABLE_MESSAGE,
} from '~/constants/fly-games'
import type { GameCatalogEntry } from '~/types/room/games'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

const ORIGIN = 'https://flylive-ludo-test.flylive.workers.dev'

const LUDO: GameCatalogEntry = {
  game_id: 'fly-ludo',
  name: 'Ludo',
  category: 'Casual',
  layout: 'full',
  provider: 'fly',
  places: ['room_lobby', 'games_page'],
  origin: ORIGIN,
}

/**
 * A Fly game on a path of the same vendor site as Ludo. No bare `origin` — the
 * launch URL carries both the frame src and (by its origin) the message GATE.
 */
const CARROM: GameCatalogEntry = {
  ...LUDO,
  game_id: 'fly-carrom',
  name: 'Carrom',
  origin: null,
  launch_url: `${ORIGIN}/carrom`,
}

/** A Fly game that renders in a sheet, to see `request_fullscreen` change something. */
const HALF_FLY: GameCatalogEntry = { ...LUDO, game_id: 'fly-half', layout: 'half' }

type MessageHandler = (event: Partial<MessageEvent>) => void

interface FakeWindow {
  postMessage: ReturnType<typeof vi.fn>
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

let tokenCounter = 0

/** API mock: every `/games/fly/token` call answers with a new token. */
function apiMinting() {
  return vi.fn().mockImplementation(async (path: string) => {
    if (path === '/games/fly/token') {
      tokenCounter += 1
      return { data: { token: `jwt-${tokenCounter}`, origin: ORIGIN } }
    }
    return { data: {} }
  })
}

function tokenCalls(api: ReturnType<typeof vi.fn>) {
  return api.mock.calls.filter(([path]) => path === '/games/fly/token')
}

/** Flush the microtasks a mint → post chain needs. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

async function loadBridge(options: {
  api?: ReturnType<typeof vi.fn>
  roomId?: string | number | null
} = {}) {
  const api = options.api ?? apiMinting()
  setupNuxtMocks({ api: createMockApi({ api }) })

  let handler: MessageHandler | null = null
  const fakeWindow = {
    addEventListener: vi.fn((type: string, fn: MessageHandler) => {
      if (type === 'message') handler = fn
    }),
    removeEventListener: vi.fn(),
  }
  ;(globalThis as Record<string, unknown>).window = fakeWindow
  // Lifecycle hooks run at once: the listener is live as soon as the composable is.
  ;(globalThis as Record<string, unknown>).onMounted = (fn: () => void) => fn()
  ;(globalThis as Record<string, unknown>).onBeforeUnmount = vi.fn()
  ;(globalThis as Record<string, unknown>).nextTick = nextTick

  const gameWindow: FakeWindow = { postMessage: vi.fn() }
  // markRaw: Vue never proxies a real HTMLIFrameElement, so the fake must not be either —
  // `event.source` is compared by identity with the frame's contentWindow.
  const frame = ref(markRaw({ contentWindow: gameWindow })) as unknown as Ref<HTMLIFrameElement | null>
  const onExitRequested = vi.fn()

  const { useFlyGameBridge } = await import('~/composables/games/useFlyGameBridge')
  const bridge = useFlyGameBridge({
    frame,
    roomId: () => (options.roomId === undefined ? 7 : options.roomId),
    onExitRequested,
  })

  /** The window genuine messages come from; a test swaps it to simulate a frame reload. */
  let currentGameWindow: unknown = gameWindow
  function reloadFrame() {
    currentGameWindow = { postMessage: vi.fn() }
    frame.value = markRaw({ contentWindow: currentGameWindow }) as unknown as HTMLIFrameElement
  }

  /** A message as the browser delivers it. Defaults = a genuine one from the game. */
  function deliver(data: unknown, overrides: { origin?: string; source?: unknown } = {}) {
    if (!handler) throw new Error('message listener was never registered')
    handler({
      origin: overrides.origin ?? ORIGIN,
      source: (overrides.source ?? currentGameWindow) as MessageEventSource,
      data,
    })
  }

  function fromGame(type: string, extra: Record<string, unknown> = {}) {
    deliver({ source: 'flylive-ludo', type, ...extra })
  }

  return { bridge, api, frame, gameWindow, onExitRequested, deliver, fromGame, reloadFrame }
}

beforeEach(() => {
  tokenCounter = 0
})

afterEach(() => {
  cleanupNuxtMocks()
  for (const key of ['window', 'onMounted', 'onBeforeUnmount', 'nextTick']) {
    Reflect.deleteProperty(globalThis, key)
  }
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useFlyGameBridge.open(game)', () => {
  it('loads the bare game origin — no token in the URL — and shows the loading state', async () => {
    const { bridge, api } = await loadBridge()

    bridge.open(LUDO)

    expect(bridge.gameUrl.value).toBe(ORIGIN)
    expect(bridge.gameUrl.value).not.toContain('token')
    expect(bridge.status.value).toBe('launching')
    expect(bridge.currentGame.value).toEqual(LUDO)
    expect(bridge.isFullScreen.value).toBe(true)
    // Nothing is minted until the game says it is listening.
    expect(api).not.toHaveBeenCalled()
  })

  it('refuses a game with no usable origin and shows the error state', async () => {
    const { bridge } = await loadBridge()

    bridge.open({ ...LUDO, origin: 'https://evil.example/path' })

    expect(bridge.gameUrl.value).toBeNull()
    expect(bridge.status.value).toBe('error')
  })

  it('refuses a non-Fly game', async () => {
    const { bridge } = await loadBridge()

    bridge.open({ ...LUDO, provider: 'joyplay' })

    expect(bridge.currentGame.value).toBeNull()
    expect(bridge.status.value).toBe('idle')
  })
})

describe('useFlyGameBridge.open(game) — a game on a path (Carrom)', () => {
  it('loads the launch URL, path included, and shows the loading state', async () => {
    const { bridge, api } = await loadBridge()

    bridge.open(CARROM)

    expect(bridge.gameUrl.value).toBe(`${ORIGIN}/carrom`)
    expect(bridge.gameUrl.value).not.toContain('token')
    expect(bridge.status.value).toBe('launching')
    expect(bridge.currentGame.value).toEqual(CARROM)
    expect(api).not.toHaveBeenCalled()
  })

  it('still loads the bare origin for a Ludo row that carries a launch_url (or a null one)', async () => {
    const { bridge } = await loadBridge()

    bridge.open({ ...LUDO, launch_url: ORIGIN })
    expect(bridge.gameUrl.value).toBe(ORIGIN)

    bridge.open({ ...LUDO, launch_url: `${ORIGIN}/` })
    expect(bridge.gameUrl.value).toBe(ORIGIN)

    bridge.open({ ...LUDO, launch_url: null })
    expect(bridge.gameUrl.value).toBe(ORIGIN)
  })

  it.each([
    ['an unusable launch_url and no origin', { ...CARROM, launch_url: `${ORIGIN}/carrom/` }],
    // Never falls back to the origin root — that is Ludo, not Carrom.
    ['an unusable launch_url beside a valid origin', { ...CARROM, origin: ORIGIN, launch_url: `${ORIGIN}/carrom?x=1` }],
    ['a launch_url that is not a URL', { ...CARROM, origin: ORIGIN, launch_url: 'not a url' }],
    ['a launch_url on another origin than the row origin', { ...CARROM, origin: ORIGIN, launch_url: 'https://evil.example/carrom' }],
  ])('goes to the error state with nothing loaded for %s', async (_label, row) => {
    const { bridge, api } = await loadBridge()

    bridge.open(row)

    expect(bridge.gameUrl.value).toBeNull()
    expect(bridge.status.value).toBe('error')
    expect(bridge.errorMessage.value).toBe(FLY_GAME_UNAVAILABLE_MESSAGE)
    expect(api).not.toHaveBeenCalled()
  })

  it('does not leave a closed game\'s origin live for the next, invalid row', async () => {
    const { bridge, api, gameWindow, fromGame } = await loadBridge()
    bridge.open(LUDO)
    bridge.close()

    bridge.open({ ...CARROM, origin: ORIGIN, launch_url: `${ORIGIN}/carrom/` })
    expect(bridge.gameUrl.value).toBeNull()
    expect(bridge.status.value).toBe('error')

    // A `ready` from the old (and from the very same) origin must reach nothing.
    fromGame('ready')
    await settle()

    expect(tokenCalls(api)).toHaveLength(0)
    expect(gameWindow.postMessage).not.toHaveBeenCalled()
  })

  it('does not leave an open game\'s origin live when the next row is invalid and nothing closed in between', async () => {
    const { bridge, api, gameWindow, fromGame } = await loadBridge()
    bridge.open(LUDO)

    bridge.open({ ...CARROM, launch_url: 'javascript:alert(1)' })
    expect(bridge.status.value).toBe('error')

    fromGame('ready')
    await settle()

    expect(tokenCalls(api)).toHaveLength(0)
    expect(gameWindow.postMessage).not.toHaveBeenCalled()
  })

  // KNOWN RED (source gap, predates Carrom): the `!target` branch of `open()` nulls
  // `origin` / `launchUrl` but not `gameUrl`, so the frame keeps the previous game's
  // src beside an error state for a different game. Both surfaces call `open()`
  // without a `close()` first (useRoomGameLobby.open, useGamesPage.selectGame).
  it('clears the previous game\'s frame URL when the next row is invalid and nothing closed in between', async () => {
    const { bridge } = await loadBridge()
    bridge.open(LUDO)
    expect(bridge.gameUrl.value).toBe(ORIGIN)

    bridge.open({ ...CARROM, launch_url: 'javascript:alert(1)' })

    expect(bridge.status.value).toBe('error')
    expect(bridge.gameUrl.value).toBeNull()
  })
})

describe('useFlyGameBridge — inbound GATE', () => {
  it('ignores a message from the wrong origin', async () => {
    const { bridge, api, deliver } = await loadBridge()
    bridge.open(LUDO)

    deliver({ source: 'flylive-ludo', type: 'ready' }, { origin: 'https://evil.example' })
    await settle()

    expect(api).not.toHaveBeenCalled()
  })

  it('ignores an origin that only differs by a trailing slash or a port', async () => {
    const { bridge, api, deliver } = await loadBridge()
    bridge.open(LUDO)

    deliver({ source: 'flylive-ludo', type: 'ready' }, { origin: `${ORIGIN}/` })
    deliver({ source: 'flylive-ludo', type: 'ready' }, { origin: `${ORIGIN}:8443` })
    await settle()

    expect(api).not.toHaveBeenCalled()
  })

  it('ignores a message from another window, even on the right origin', async () => {
    const { bridge, api, deliver } = await loadBridge()
    bridge.open(LUDO)

    deliver({ source: 'flylive-ludo', type: 'ready' }, { source: { postMessage: vi.fn() } })
    await settle()

    expect(api).not.toHaveBeenCalled()
  })

  it('ignores a message with the wrong `source` field, or no object at all', async () => {
    const { bridge, api, deliver } = await loadBridge()
    bridge.open(LUDO)

    deliver({ source: 'flylive', type: 'ready' })
    deliver({ type: 'ready' })
    deliver('ready')
    deliver(null)
    await settle()

    expect(api).not.toHaveBeenCalled()
  })

  it('ignores everything while no game is open', async () => {
    const { api, fromGame } = await loadBridge()

    fromGame('ready')
    await settle()

    expect(api).not.toHaveBeenCalled()
  })

  it('ignores unknown message types (Fly will add `coins` / `closed`)', async () => {
    const { bridge, fromGame, onExitRequested } = await loadBridge()
    bridge.open(LUDO)

    fromGame('coins', { balance: 1234 })
    fromGame('closed')

    expect(bridge.status.value).toBe('launching')
    expect(bridge.currentGame.value).toEqual(LUDO)
    expect(onExitRequested).not.toHaveBeenCalled()
  })

  it('checks the frame window at receipt time, so a reloaded frame is still recognised', async () => {
    const { bridge, api, deliver, gameWindow, fromGame, reloadFrame } = await loadBridge()
    bridge.open(LUDO)
    // Retry remounts the iframe: a new contentWindow replaces the old one.
    reloadFrame()

    // The old window is no longer this frame's.
    deliver({ source: 'flylive-ludo', type: 'ready' }, { source: gameWindow })
    await settle()
    expect(tokenCalls(api)).toHaveLength(0)

    fromGame('ready')
    await settle()
    expect(tokenCalls(api)).toHaveLength(1)
  })
})

describe('useFlyGameBridge — a game on a path (Carrom): GATE and targetOrigin stay on the BARE origin', () => {
  it('accepts `ready` from the bare origin and mints for fly-carrom', async () => {
    const { bridge, api, fromGame } = await loadBridge()
    bridge.open(CARROM)

    fromGame('ready')
    await settle()

    expect(tokenCalls(api)).toEqual([['/games/fly/token', { method: 'POST', body: { game_id: 'fly-carrom' } }]])
  })

  it('posts `launch` and `room` with the bare origin as targetOrigin, never the URL with the path', async () => {
    const { bridge, gameWindow, fromGame } = await loadBridge({ roomId: 7 })
    bridge.open(CARROM)

    fromGame('ready')
    await settle()

    expect(gameWindow.postMessage.mock.calls).toEqual([
      [{ source: 'flylive', type: 'launch', token: 'jwt-1' }, ORIGIN],
      [{ source: 'flylive', type: 'room', roomId: '7' }, ORIGIN],
    ])
    for (const [, target] of gameWindow.postMessage.mock.calls) {
      expect(target).not.toContain('/carrom')
      expect(target).not.toBe('*')
    }
    // The token still travels by message only — the frame src stays the launch URL.
    expect(bridge.gameUrl.value).toBe(`${ORIGIN}/carrom`)
  })

  it('posts only `launch` when not opened from a Room', async () => {
    const { bridge, gameWindow, fromGame } = await loadBridge({ roomId: null })
    bridge.open(CARROM)

    fromGame('ready')
    await settle()

    expect(gameWindow.postMessage.mock.calls).toEqual([
      [{ source: 'flylive', type: 'launch', token: 'jwt-1' }, ORIGIN],
    ])
  })

  it.each([
    ['the launch URL (a browser never sends it as an origin)', `${ORIGIN}/carrom`],
    ['the bare origin with a trailing slash', `${ORIGIN}/`],
    ['another host', 'https://evil.example'],
    ['another host on the same path', 'https://evil.example/carrom'],
  ])('drops a message whose origin is %s', async (_label, origin) => {
    const { bridge, api, gameWindow, deliver } = await loadBridge()
    bridge.open(CARROM)

    deliver({ source: 'flylive-ludo', type: 'ready' }, { origin })
    await settle()

    expect(api).not.toHaveBeenCalled()
    expect(gameWindow.postMessage).not.toHaveBeenCalled()
  })

  it('reads the Fly site\'s `flylive-ludo` source from Carrom too (one site, one protocol)', async () => {
    const { bridge, fromGame } = await loadBridge()
    bridge.open(CARROM)

    fromGame('launch_result', { ok: true, reason: null })

    expect(bridge.status.value).toBe('ready')
  })

  it('`return_to_room` closes it and clears the launch URL', async () => {
    const { bridge, fromGame, onExitRequested } = await loadBridge()
    bridge.open(CARROM)

    fromGame('return_to_room', { roomId: '7', matchId: 'm-1' })

    expect(bridge.gameUrl.value).toBeNull()
    expect(bridge.currentGame.value).toBeNull()
    expect(onExitRequested).toHaveBeenCalledOnce()
  })
})

describe('useFlyGameBridge — ready → launch', () => {
  it('mints exactly one token, posts `launch` to the exact origin, then `room` with the Room id', async () => {
    const { bridge, api, gameWindow, fromGame } = await loadBridge({ roomId: 7 })
    bridge.open(LUDO)

    fromGame('ready')
    await settle()

    expect(tokenCalls(api)).toEqual([['/games/fly/token', { method: 'POST', body: { game_id: 'fly-ludo' } }]])
    expect(gameWindow.postMessage.mock.calls).toEqual([
      [{ source: 'flylive', type: 'launch', token: 'jwt-1' }, ORIGIN],
      [{ source: 'flylive', type: 'room', roomId: '7' }, ORIGIN],
    ])
    // The token travels by message only — the frame src is still the bare origin.
    expect(bridge.gameUrl.value).toBe(ORIGIN)
  })

  it('never posts with a `*` target origin', async () => {
    const { bridge, gameWindow, fromGame } = await loadBridge()
    bridge.open(LUDO)

    fromGame('ready')
    await settle()

    for (const [, target] of gameWindow.postMessage.mock.calls) {
      expect(target).toBe(ORIGIN)
    }
  })

  it('posts no `room` message when not opened from a Room', async () => {
    const { bridge, gameWindow, fromGame } = await loadBridge({ roomId: null })
    bridge.open(LUDO)

    fromGame('ready')
    await settle()

    expect(gameWindow.postMessage.mock.calls).toEqual([
      [{ source: 'flylive', type: 'launch', token: 'jwt-1' }, ORIGIN],
    ])
  })

  it('stays loading until `launch_result ok:true`', async () => {
    const { bridge, fromGame } = await loadBridge()
    bridge.open(LUDO)

    fromGame('ready')
    await settle()
    expect(bridge.status.value).toBe('launching')

    fromGame('launch_result', { ok: true, reason: null })
    expect(bridge.status.value).toBe('ready')
  })

  it('mints and posts a SECOND token on a second `ready` (Fly session expiry)', async () => {
    vi.useFakeTimers()
    const { bridge, api, gameWindow, fromGame } = await loadBridge()
    bridge.open(LUDO)

    fromGame('ready')
    await settle()
    fromGame('launch_result', { ok: true, reason: null })

    vi.advanceTimersByTime(FLY_GAME_MIN_MINT_INTERVAL_MS)
    fromGame('ready')
    await settle()

    expect(tokenCalls(api)).toHaveLength(2)
    const launches = gameWindow.postMessage.mock.calls.filter(([m]) => m.type === 'launch')
    expect(launches.map(([m]) => m.token)).toEqual(['jwt-1', 'jwt-2'])
    // A re-login under a live board must not put the spinner back over it.
    expect(bridge.status.value).toBe('ready')
  })

  it('debounces rapid repeats: a burst costs one mint now and one when the window ends', async () => {
    vi.useFakeTimers()
    const { bridge, api, fromGame } = await loadBridge()
    bridge.open(LUDO)

    for (let i = 0; i < 10; i++) {
      fromGame('ready')
    }
    await settle()
    expect(tokenCalls(api)).toHaveLength(1)

    // The last `ready` is answered, not dropped — a game that really reloaded is
    // waiting for it.
    vi.advanceTimersByTime(FLY_GAME_MIN_MINT_INTERVAL_MS)
    await settle()
    expect(tokenCalls(api)).toHaveLength(2)

    vi.advanceTimersByTime(FLY_GAME_MIN_MINT_INTERVAL_MS * 3)
    await settle()
    expect(tokenCalls(api)).toHaveLength(2)
  })

  it('does not mint twice while a mint is still in flight', async () => {
    vi.useFakeTimers()
    const pending = deferred<{ data: { token: string; origin: string } }>()
    const api = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue({ data: { token: 'jwt-late', origin: ORIGIN } })
    const { bridge, fromGame } = await loadBridge({ api })
    bridge.open(LUDO)

    fromGame('ready')
    vi.advanceTimersByTime(FLY_GAME_MIN_MINT_INTERVAL_MS * 2)
    fromGame('ready')
    await settle()
    expect(tokenCalls(api)).toHaveLength(1)

    pending.resolve({ data: { token: 'jwt-1', origin: ORIGIN } })
    await settle()
    expect(tokenCalls(api)).toHaveLength(2)
  })

  it('drops a token that arrives after the game was closed', async () => {
    const pending = deferred<{ data: { token: string; origin: string } }>()
    const api = vi.fn().mockReturnValue(pending.promise)
    const { bridge, gameWindow, fromGame } = await loadBridge({ api })
    bridge.open(LUDO)

    fromGame('ready')
    bridge.close()
    pending.resolve({ data: { token: 'jwt-1', origin: ORIGIN } })
    await settle()

    expect(gameWindow.postMessage).not.toHaveBeenCalled()
    expect(bridge.status.value).toBe('idle')
  })
})

describe('useFlyGameBridge — game → host', () => {
  it('`return_to_room` closes the game and asks the surface to close', async () => {
    const { bridge, fromGame, onExitRequested } = await loadBridge()
    bridge.open(LUDO)

    fromGame('return_to_room', { roomId: '7', matchId: 'm-1' })

    expect(bridge.currentGame.value).toBeNull()
    expect(bridge.gameUrl.value).toBeNull()
    expect(bridge.status.value).toBe('idle')
    expect(onExitRequested).toHaveBeenCalledOnce()
  })

  it('`request_fullscreen` switches a sheet game to the full-screen layout', async () => {
    const { bridge, fromGame } = await loadBridge()
    bridge.open(HALF_FLY)
    expect(bridge.container.value?.mode).toBe('sheet')

    fromGame('request_fullscreen')

    expect(bridge.container.value).toEqual({ mode: 'overlay' })
    expect(bridge.isFullScreen.value).toBe(true)
  })

  it('`launch_result ok:false` shows the error state with the retry message', async () => {
    const { bridge, fromGame } = await loadBridge()
    bridge.open(LUDO)

    fromGame('launch_result', { ok: false, reason: 'token_expired' })

    expect(bridge.status.value).toBe('error')
    expect(bridge.errorMessage.value).toBe(FLY_GAME_LOGIN_FAILED_MESSAGE)
  })

  it('a failed mint shows the same error state', async () => {
    const api = vi.fn().mockRejectedValue(new Error('Too many attempts'))
    const { bridge, gameWindow, fromGame } = await loadBridge({ api })
    bridge.open(LUDO)

    fromGame('ready')
    await settle()

    expect(bridge.status.value).toBe('error')
    expect(bridge.errorMessage.value).toBe('Too many attempts')
    expect(gameWindow.postMessage).not.toHaveBeenCalled()
  })
})

describe('useFlyGameBridge.retry()', () => {
  it('reloads the frame and goes back to loading; the next `ready` mints at once', async () => {
    vi.useFakeTimers()
    const { bridge, api, fromGame } = await loadBridge()
    bridge.open(LUDO)
    fromGame('ready')
    await settle()
    fromGame('launch_result', { ok: false, reason: 'bad_token' })

    const retrying = bridge.retry()
    // The iframe is unmounted for a tick so it remounts and loads afresh.
    expect(bridge.gameUrl.value).toBeNull()
    await retrying

    expect(bridge.gameUrl.value).toBe(ORIGIN)
    expect(bridge.status.value).toBe('launching')
    expect(bridge.errorMessage.value).toBeNull()

    // Not held back by the mint window of the failed attempt.
    fromGame('ready')
    await settle()
    expect(tokenCalls(api)).toHaveLength(2)
  })

  it('reloads a game on a path at its launch URL, not the bare origin (Carrom)', async () => {
    vi.useFakeTimers()
    const { bridge, api, gameWindow, fromGame } = await loadBridge()
    bridge.open(CARROM)
    fromGame('ready')
    await settle()
    fromGame('launch_result', { ok: false, reason: 'bad_token' })

    const retrying = bridge.retry()
    expect(bridge.gameUrl.value).toBeNull()
    await retrying

    expect(bridge.gameUrl.value).toBe(`${ORIGIN}/carrom`)
    expect(bridge.status.value).toBe('launching')

    // The GATE and the targetOrigin did not move to the path.
    fromGame('ready')
    await settle()
    expect(tokenCalls(api)).toHaveLength(2)
    expect(tokenCalls(api)[1]).toEqual(['/games/fly/token', { method: 'POST', body: { game_id: 'fly-carrom' } }])
    for (const [, target] of gameWindow.postMessage.mock.calls) {
      expect(target).toBe(ORIGIN)
    }
  })

  it('does not load the launch URL after the game is closed during the unmounted tick', async () => {
    const { bridge } = await loadBridge()
    bridge.open(CARROM)

    const retrying = bridge.retry()
    bridge.close()
    await retrying

    expect(bridge.gameUrl.value).toBeNull()
    expect(bridge.status.value).toBe('idle')
  })

  it('does nothing when no game is open', async () => {
    const { bridge } = await loadBridge()

    await bridge.retry()

    expect(bridge.gameUrl.value).toBeNull()
    expect(bridge.status.value).toBe('idle')
  })
})

describe('useFlyGameBridge.close()', () => {
  it('clears the game and calls no API', async () => {
    const { bridge, api } = await loadBridge()
    bridge.open(LUDO)

    bridge.close()

    expect(bridge.currentGame.value).toBeNull()
    expect(bridge.container.value).toBeNull()
    expect(bridge.status.value).toBe('idle')
    expect(api).not.toHaveBeenCalled()
  })

  it('clears the launch URL of a game on a path, and ignores the origin afterwards (Carrom)', async () => {
    const { bridge, api, fromGame } = await loadBridge()
    bridge.open(CARROM)
    expect(bridge.gameUrl.value).toBe(`${ORIGIN}/carrom`)

    bridge.close()

    expect(bridge.gameUrl.value).toBeNull()
    expect(bridge.currentGame.value).toBeNull()
    fromGame('ready')
    await settle()
    expect(api).not.toHaveBeenCalled()
  })

  it('cancels a pending debounced mint', async () => {
    vi.useFakeTimers()
    const { bridge, api, fromGame } = await loadBridge()
    bridge.open(LUDO)
    fromGame('ready')
    fromGame('ready')
    await settle()

    bridge.close()
    vi.advanceTimersByTime(FLY_GAME_MIN_MINT_INTERVAL_MS * 2)
    await settle()

    expect(tokenCalls(api)).toHaveLength(1)
  })
})
