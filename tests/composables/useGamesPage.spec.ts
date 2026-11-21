// ========================================
// useGamesPage — the Fly games grid on the Discover page
// ========================================
// Vitest runs in a node environment and mounts no components, so everything the
// section does is decided here: when it shows, what it lists, and how a game opens
// and closes. The real catalogue and the real Fly bridge run underneath; only the
// network (`api`) and the browser (`window`, lifecycle hooks) are faked.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { effectScope, markRaw, nextTick, type EffectScope } from 'vue'
import { setupNuxtMocks, cleanupNuxtMocks, createMockApi } from '../helpers/nuxtMocks'
import {
  __resetBackDismissRegistry,
  dismissTopRegisteredOverlay,
  hasRegisteredOverlay,
} from '~/composables/shared/useBackDismiss'
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

/** A Fly game for the Games page only — and not `full`, to prove the overlay is always used. */
const FLY_HALF: GameCatalogEntry = {
  ...LUDO,
  game_id: 'fly-half',
  name: 'Half Fly',
  layout: 'half',
  places: ['games_page'],
}

/** A Fly game on a path of the same site as Ludo: no bare `origin`, only a `launch_url`. */
const CARROM: GameCatalogEntry = {
  ...LUDO,
  game_id: 'fly-carrom',
  name: 'Carrom',
  origin: null,
  launch_url: `${ORIGIN}/carrom`,
}

const FLY_ROOM_ONLY: GameCatalogEntry = { ...LUDO, game_id: 'fly-room', name: 'Room Fly', places: ['room_lobby'] }
const JOYPLAY_ROOM: GameCatalogEntry = {
  game_id: '10',
  name: 'Roulette',
  category: 'Casino',
  layout: 'half',
  provider: 'joyplay',
  places: ['room_lobby'],
}
const JOYPLAY_LEGACY: GameCatalogEntry = { game_id: '61', name: 'BigEater', category: 'Casino', layout: 'full' }
/** Placed at `games_page` on purpose: JoyPlay needs a Room, so it must still not be listed. */
const JOYPLAY_PAGE: GameCatalogEntry = { ...JOYPLAY_ROOM, game_id: '11', name: 'Slots', places: ['games_page'] }
const UNKNOWN_PROVIDER: GameCatalogEntry = { ...LUDO, game_id: 'alien', provider: 'alien' as never }

type MessageHandler = (event: Partial<MessageEvent>) => void

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Flush the microtasks a fetch → state chain needs. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

type CatalogAnswer = { data: GameCatalogEntry[] } | Promise<{ data: GameCatalogEntry[] }>

/** One API mock for both endpoints the page touches. */
function apiFor(catalog: CatalogAnswer | Error) {
  return vi.fn().mockImplementation(async (path: string) => {
    if (path === '/games') {
      if (catalog instanceof Error) throw catalog
      return catalog
    }
    if (path === '/games/fly/token') {
      return { data: { token: 'jwt-1', origin: ORIGIN } }
    }
    return { data: {} }
  })
}

let scope: EffectScope | null = null
let unmountHooks: Array<() => void> = []

/**
 * Mounts the composable the way a component would: inside an effect scope, with
 * `onMounted` run at once and `onBeforeUnmount` hooks held until `unmount()`.
 */
async function mountPage(catalog: CatalogAnswer | Error = { data: [LUDO] }) {
  const api = apiFor(catalog)
  setupNuxtMocks({ api: createMockApi({ api }) })

  let handler: MessageHandler | null = null
  ;(globalThis as Record<string, unknown>).window = {
    addEventListener: vi.fn((type: string, fn: MessageHandler) => {
      if (type === 'message') handler = fn
    }),
    removeEventListener: vi.fn(),
  }
  ;(globalThis as Record<string, unknown>).onMounted = (fn: () => void) => fn()
  ;(globalThis as Record<string, unknown>).onBeforeUnmount = (fn: () => void) => {
    unmountHooks.push(fn)
  }
  ;(globalThis as Record<string, unknown>).nextTick = nextTick

  const { useGamesPage } = await import('~/composables/games/useGamesPage')
  scope = effectScope()
  const page = scope.run(() => useGamesPage())!

  // The iframe the game would be in: the page binds it through `v-model:frame`.
  const gameWindow = { postMessage: vi.fn() }
  page.frame.value = markRaw({ contentWindow: gameWindow }) as unknown as HTMLIFrameElement

  await settle()

  function fromGame(type: string, extra: Record<string, unknown> = {}) {
    if (!handler) throw new Error('message listener was never registered')
    handler({
      origin: ORIGIN,
      source: gameWindow as unknown as MessageEventSource,
      data: { source: 'flylive-ludo', type, ...extra },
    })
  }

  function unmount() {
    for (const hook of unmountHooks) hook()
    scope?.stop()
  }

  return { page, api, gameWindow, fromGame, unmount }
}

function catalogCalls(api: ReturnType<typeof vi.fn>) {
  return api.mock.calls.filter(([path]) => path === '/games')
}

beforeEach(() => {
  unmountHooks = []
  __resetBackDismissRegistry()
})

afterEach(() => {
  scope?.stop()
  scope = null
  cleanupNuxtMocks()
  for (const key of ['window', 'onMounted', 'onBeforeUnmount', 'nextTick']) {
    Reflect.deleteProperty(globalThis, key)
  }
  vi.restoreAllMocks()
})

describe('useGamesPage — the section is hidden unless there is a game to show', () => {
  it('asks for the catalogue once on mount, and shows nothing until it answers', async () => {
    const pending = deferred<{ data: GameCatalogEntry[] }>()
    const { page, api } = await mountPage(pending.promise)

    expect(catalogCalls(api)).toEqual([['/games']])
    expect(page.isSectionVisible.value).toBe(false)

    pending.resolve({ data: [LUDO] })
    await settle()

    expect(page.isSectionVisible.value).toBe(true)
    expect(catalogCalls(api)).toHaveLength(1)
  })

  it('shows nothing while the catalogue is loading', async () => {
    const pending = deferred<{ data: GameCatalogEntry[] }>()
    const { page } = await mountPage(pending.promise)

    expect(page.isSectionVisible.value).toBe(false)
    expect(page.games.value).toEqual([])

    pending.resolve({ data: [LUDO] })
    await settle()

    expect(page.isSectionVisible.value).toBe(true)
  })

  it('shows nothing when the catalogue request fails', async () => {
    const { page, api } = await mountPage(new Error('Server down'))

    expect(page.isSectionVisible.value).toBe(false)
    expect(page.games.value).toEqual([])
    // No retry loop behind the player's back.
    expect(catalogCalls(api)).toHaveLength(1)
  })

  it('shows nothing when the server answers with something that is not a list', async () => {
    const { page } = await mountPage({ data: null } as unknown as CatalogAnswer)

    expect(page.isSectionVisible.value).toBe(false)
  })

  it('shows nothing when the list is empty', async () => {
    const { page } = await mountPage({ data: [] })

    expect(page.isSectionVisible.value).toBe(false)
  })

  it('shows nothing when no game is meant for the Games page (non-tester)', async () => {
    const { page } = await mountPage({ data: [FLY_ROOM_ONLY, JOYPLAY_ROOM, JOYPLAY_LEGACY] })

    expect(page.isSectionVisible.value).toBe(false)
    expect(page.games.value).toEqual([])
  })

  it('shows nothing when the only Games-page game is JoyPlay (it needs a Room)', async () => {
    const { page } = await mountPage({ data: [JOYPLAY_PAGE] })

    expect(page.isSectionVisible.value).toBe(false)
  })

  it('shows nothing for a Fly game with no usable origin, or an unknown provider', async () => {
    const { page } = await mountPage({
      data: [{ ...LUDO, origin: 'https://evil.example/path' }, UNKNOWN_PROVIDER],
    })

    expect(page.isSectionVisible.value).toBe(false)
  })
})

describe('useGamesPage — what the grid lists', () => {
  it('lists one tile per Fly game placed at `games_page`, in server order', async () => {
    const { page } = await mountPage({ data: [LUDO, FLY_HALF] })

    expect(page.isSectionVisible.value).toBe(true)
    expect(page.games.value).toEqual([LUDO, FLY_HALF])
  })

  it('lists a Carrom row (null origin, launch_url on a path) next to Ludo', async () => {
    const { page } = await mountPage({ data: [LUDO, CARROM] })

    expect(page.isSectionVisible.value).toBe(true)
    expect(page.games.value).toEqual([LUDO, CARROM])
  })

  it('leaves out a Carrom row whose launch_url is unusable — even beside a valid origin', async () => {
    const { page } = await mountPage({
      data: [
        LUDO,
        { ...CARROM, game_id: 'bad-slash', launch_url: `${ORIGIN}/carrom/` },
        { ...CARROM, game_id: 'bad-origin', origin: ORIGIN, launch_url: 'not a url' },
        { ...CARROM, game_id: 'bad-mismatch', origin: ORIGIN, launch_url: 'https://evil.example/carrom' },
      ],
    })

    expect(page.games.value).toEqual([LUDO])
  })

  it('hides the section when the only Games-page game is a Carrom row with an unusable launch_url', async () => {
    const { page } = await mountPage({ data: [{ ...CARROM, launch_url: `${ORIGIN}/carrom?x=1` }] })

    expect(page.isSectionVisible.value).toBe(false)
  })

  it('leaves out room-lobby-only games, JoyPlay games and unknown providers', async () => {
    const { page } = await mountPage({
      data: [JOYPLAY_ROOM, FLY_ROOM_ONLY, LUDO, JOYPLAY_PAGE, JOYPLAY_LEGACY, UNKNOWN_PROVIDER, FLY_HALF],
    })

    expect(page.games.value.map((game) => game.game_id)).toEqual(['fly-ludo', 'fly-half'])
  })
})

describe('useGamesPage — opening a game', () => {
  it('opens the bare game origin full-screen on a tile tap', async () => {
    const { page } = await mountPage()
    expect(page.isOverlayOpen.value).toBe(false)

    page.selectGame(LUDO)

    expect(page.isOverlayOpen.value).toBe(true)
    expect(page.gameUrl.value).toBe(ORIGIN)
    expect(page.gameTitle.value).toBe('Ludo')
    expect(page.status.value).toBe('launching')
  })

  it('opens a Carrom tile at its launch URL and mints for it from the bare origin', async () => {
    const { page, api, gameWindow, fromGame } = await mountPage({ data: [LUDO, CARROM] })

    page.selectGame(CARROM)

    expect(page.isOverlayOpen.value).toBe(true)
    expect(page.gameUrl.value).toBe(`${ORIGIN}/carrom`)
    expect(page.gameTitle.value).toBe('Carrom')

    fromGame('ready')
    await settle()

    expect(api).toHaveBeenCalledWith('/games/fly/token', { method: 'POST', body: { game_id: 'fly-carrom' } })
    expect(gameWindow.postMessage.mock.calls).toEqual([
      [{ source: 'flylive', type: 'launch', token: 'jwt-1' }, ORIGIN],
    ])
  })

  it('uses the full-screen layer even for a game whose layout is not `full`', async () => {
    const { page } = await mountPage({ data: [FLY_HALF] })

    page.selectGame(FLY_HALF)

    expect(page.isOverlayOpen.value).toBe(true)
  })

  it('ignores a tap on a non-Fly game', async () => {
    const { page, api } = await mountPage({ data: [LUDO] })

    page.selectGame(JOYPLAY_PAGE)
    page.selectGame(JOYPLAY_LEGACY)
    page.selectGame(UNKNOWN_PROVIDER)

    expect(page.isOverlayOpen.value).toBe(false)
    expect(page.gameUrl.value).toBeNull()
    expect(api).not.toHaveBeenCalledWith('/games/launch', expect.anything())
  })

  it('completes the handshake with NO `room` message', async () => {
    const { page, api, gameWindow, fromGame } = await mountPage()
    page.selectGame(LUDO)

    fromGame('ready')
    await settle()

    expect(api).toHaveBeenCalledWith('/games/fly/token', { method: 'POST', body: { game_id: 'fly-ludo' } })
    expect(gameWindow.postMessage.mock.calls).toEqual([
      [{ source: 'flylive', type: 'launch', token: 'jwt-1' }, ORIGIN],
    ])

    fromGame('launch_result', { ok: true, reason: null })
    expect(page.status.value).toBe('ready')
  })

  it('does not fetch the catalogue again when a game opens or closes', async () => {
    const { page, api } = await mountPage({ data: [LUDO, FLY_HALF] })

    page.selectGame(LUDO)
    page.closeGame()
    page.selectGame(FLY_HALF)
    page.closeGame()
    await settle()

    expect(catalogCalls(api)).toHaveLength(1)
  })
})

describe('useGamesPage — leaving a game stays on the page', () => {
  it('closes on the game\'s own `return_to_room`, and the grid stays', async () => {
    const { page, fromGame } = await mountPage()
    page.selectGame(LUDO)
    expect(page.isOverlayOpen.value).toBe(true)

    fromGame('return_to_room')

    expect(page.isOverlayOpen.value).toBe(false)
    expect(page.gameUrl.value).toBeNull()
    expect(page.status.value).toBe('idle')
    expect(page.isSectionVisible.value).toBe(true)
  })

  it('closes on ← and ✕ (closeGame), and the grid stays', async () => {
    const { page } = await mountPage()
    page.selectGame(LUDO)

    page.closeGame()

    expect(page.isOverlayOpen.value).toBe(false)
    expect(page.gameUrl.value).toBeNull()
    expect(page.isSectionVisible.value).toBe(true)
  })

  it('closes on Android back, and registers only while a game is open', async () => {
    const { page } = await mountPage()
    expect(hasRegisteredOverlay()).toBe(false)

    page.selectGame(LUDO)
    await nextTick()
    expect(hasRegisteredOverlay()).toBe(true)

    expect(dismissTopRegisteredOverlay()).toBe(true)

    expect(page.isOverlayOpen.value).toBe(false)
    await nextTick()
    expect(hasRegisteredOverlay()).toBe(false)
  })

  it('can open the same game again after closing it', async () => {
    const { page } = await mountPage()

    page.selectGame(LUDO)
    page.closeGame()
    page.selectGame(LUDO)

    expect(page.isOverlayOpen.value).toBe(true)
    expect(page.gameUrl.value).toBe(ORIGIN)
  })

  it('closes the open game when the page unmounts', async () => {
    const { page, unmount } = await mountPage()
    page.selectGame(LUDO)

    unmount()

    expect(page.isOverlayOpen.value).toBe(false)
    expect(page.gameUrl.value).toBeNull()
    expect(hasRegisteredOverlay()).toBe(false)
  })

  it('drops a launch token that arrives after the player has left the game', async () => {
    const pendingToken = deferred<{ data: { token: string; origin: string } }>()
    const { page, api, gameWindow, fromGame } = await mountPage()
    api.mockImplementation(async (path: string) => {
      if (path === '/games/fly/token') return pendingToken.promise
      return { data: {} }
    })
    page.selectGame(LUDO)
    fromGame('ready')
    await settle()

    page.closeGame()
    pendingToken.resolve({ data: { token: 'late', origin: ORIGIN } })
    await settle()

    expect(gameWindow.postMessage).not.toHaveBeenCalled()
  })
})
