// ========================================
// useRoomGames — canPlay gate tests
// ========================================
// Covers the wealth-level floor on the games button. The button is the ONLY
// thing standing between a low-level player and the panel, so a regression here
// is invisible in the UI until the wrong population sees it.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { watch } from 'vue'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
  createMockApi,
  createMockAuthStore,
  createMockBalanceStore,
  createMockBootstrapStore,
} from '../helpers/nuxtMocks'
import { MIN_WEALTH_LEVEL_FOR_GAMES } from '~/constants/games'
import type { GameCatalogEntry } from '~/types/room/games'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

/**
 * Wealth XP that lands on each level, given the shared mock level table
 * (Bronze 0 → 1, Silver 100 → 2, Gold 500 → 3).
 */
const XP = {
  LEVEL_1: '0',
  LEVEL_2: '100',
  LEVEL_3: '500',
} as const

async function loadRoomGames(options: {
  wealthXp?: string
  gamesEnabled?: boolean | null
  userId?: number | null
  bootstrapReady?: boolean
  api?: ReturnType<typeof vi.fn>
} = {}) {
  const {
    wealthXp = XP.LEVEL_2,
    gamesEnabled = true,
    userId = 1,
    bootstrapReady = true,
    api = vi.fn().mockResolvedValue({ data: {} }),
  } = options

  const authStore = createMockAuthStore({
    user: userId === null ? null : { id: userId, name: 'Test User' },
  })
  const balanceStore = createMockBalanceStore({
    wealthXp,
    charmXp: '0',
  })
  const bootstrapStore = createMockBootstrapStore({
    gamesEnabled,
    isReady: bootstrapReady,
  })

  setupNuxtMocks({ authStore, balanceStore, bootstrapStore, api: createMockApi({ api }) })

  // Auto-imports `useRoomGames` relies on that the shared helper does not provide.
  const { useLevelLookup } = await import('~/composables/shared/useLevelLookup')
  ;(globalThis as Record<string, unknown>).useLevelLookup = useLevelLookup
  ;(globalThis as Record<string, unknown>).useRoomStore = () => ({ currentRoom: { id: 7 } })
  ;(globalThis as Record<string, unknown>).useRouter = () => ({ push: vi.fn() })
  ;(globalThis as Record<string, unknown>).watch = watch
  // The message-bridge listeners are registered in lifecycle hooks. Outside a
  // component instance Vue would only warn, but the no-op keeps the log clean.
  ;(globalThis as Record<string, unknown>).onMounted = vi.fn()
  ;(globalThis as Record<string, unknown>).onBeforeUnmount = vi.fn()

  const { useRoomGames } = await import('~/composables/room/useRoomGames')

  return { games: useRoomGames(), api }
}

async function loadCanPlay(options: Parameters<typeof loadRoomGames>[0] = {}) {
  return (await loadRoomGames(options)).games.canPlay
}

afterEach(() => {
  cleanupNuxtMocks()
  for (const key of ['useLevelLookup', 'useRoomStore', 'useRouter', 'watch', 'onMounted', 'onBeforeUnmount']) {
    Reflect.deleteProperty(globalThis, key)
  }
  vi.restoreAllMocks()
})

describe('useRoomGames.canPlay — wealth level floor', () => {
  it('is the documented threshold of 2', () => {
    expect(MIN_WEALTH_LEVEL_FOR_GAMES).toBe(2)
  })

  it('hides the button below the threshold (wealth level 1)', async () => {
    const canPlay = await loadCanPlay({ wealthXp: XP.LEVEL_1 })
    expect(canPlay.value).toBe(false)
  })

  it('shows the button exactly at the threshold (wealth level 2)', async () => {
    const canPlay = await loadCanPlay({ wealthXp: XP.LEVEL_2 })
    expect(canPlay.value).toBe(true)
  })

  it('shows the button above the threshold (wealth level 3)', async () => {
    const canPlay = await loadCanPlay({ wealthXp: XP.LEVEL_3 })
    expect(canPlay.value).toBe(true)
  })

  it('hides the button while bootstrap has not landed, even on high XP', async () => {
    // `getLevelFromXp` returns level 0 until the level table is ready — the gate
    // must fail closed rather than flash the button and retract it.
    const canPlay = await loadCanPlay({ wealthXp: XP.LEVEL_3, bootstrapReady: false })
    expect(canPlay.value).toBe(false)
  })
})

describe('useRoomGames.canPlay — existing gates still hold', () => {
  it('hides the button when the kill switch is off', async () => {
    const canPlay = await loadCanPlay({ wealthXp: XP.LEVEL_3, gamesEnabled: false })
    expect(canPlay.value).toBe(false)
  })

  it('hides the button when the server has not reported the flag yet', async () => {
    const canPlay = await loadCanPlay({ wealthXp: XP.LEVEL_3, gamesEnabled: null })
    expect(canPlay.value).toBe(false)
  })

  it('hides the button when signed out', async () => {
    const canPlay = await loadCanPlay({ wealthXp: XP.LEVEL_3, userId: null })
    expect(canPlay.value).toBe(false)
  })
})

// ========================================
// Picker → game: open(game), retry, close, stale launches
// ========================================

const ROULETTE: GameCatalogEntry = { game_id: '10', name: 'Roulette', category: 'Casino', layout: 'half' }
const LUCKY_77: GameCatalogEntry = { game_id: '26', name: 'Lucky 77', category: 'Slots', layout: 'tall' }
const BIG_EATER: GameCatalogEntry = { game_id: '61', name: 'BigEater', category: 'Casino', layout: 'full' }

const LAUNCH_URL = 'https://joysdk.com/game?token=abc'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** API mock answering launch with `url`, everything else with an empty body. */
function apiLaunching(url = LAUNCH_URL) {
  return vi.fn().mockImplementation(async (path: string) =>
    path === '/games/launch' ? { data: { url, expires_at: '2026-11-04T12:00:00Z' } } : { data: {} },
  )
}

function callsTo(api: ReturnType<typeof vi.fn>, path: string) {
  return api.mock.calls.filter(([calledPath]) => calledPath === path)
}

describe('useRoomGames.open(game)', () => {
  it('starts with no game and no session — opening the surface alone mints nothing', async () => {
    const { games, api } = await loadRoomGames({ api: apiLaunching() })

    expect(games.currentGame.value).toBeNull()
    expect(games.container.value).toBeNull()
    expect(games.status.value).toBe('idle')
    expect(api).not.toHaveBeenCalled()
  })

  it('POSTs the room id and the game id as a STRING, then attaches the url', async () => {
    const { games, api } = await loadRoomGames({ api: apiLaunching() })

    await games.open(ROULETTE)

    expect(api).toHaveBeenCalledWith('/games/launch', {
      method: 'POST',
      body: { room_id: 7, game_id: '10' },
    })
    expect(games.gameUrl.value).toBe(LAUNCH_URL)
    expect(games.status.value).toBe('loading')
    expect(games.currentGame.value).toEqual(ROULETTE)
  })

  it('coerces a numeric game id to a string (a number 422s on the server)', async () => {
    const { games, api } = await loadRoomGames({ api: apiLaunching() })

    await games.open({ ...ROULETTE, game_id: 10 as unknown as string })

    expect(callsTo(api, '/games/launch')[0]?.[1]).toMatchObject({ body: { game_id: '10' } })
  })

  it('remembers the game and shows the spinner state before the request resolves', async () => {
    const pending = deferred<unknown>()
    const { games } = await loadRoomGames({ api: vi.fn().mockReturnValue(pending.promise) })

    const opening = games.open(BIG_EATER)

    // The container must switch the moment the tile is tapped, not when the
    // session arrives — otherwise a full game flashes the picker first.
    expect(games.status.value).toBe('launching')
    expect(games.currentGame.value).toEqual(BIG_EATER)
    expect(games.isFullScreen.value).toBe(true)

    pending.resolve({ data: { url: LAUNCH_URL, expires_at: '' } })
    await opening
  })

  it('ignores a second tap while a launch is in flight', async () => {
    const pending = deferred<unknown>()
    const { games, api } = await loadRoomGames({ api: vi.fn().mockReturnValue(pending.promise) })

    const first = games.open(ROULETTE)
    await games.open(LUCKY_77)

    expect(callsTo(api, '/games/launch')).toHaveLength(1)
    expect(games.currentGame.value).toEqual(ROULETTE)

    pending.resolve({ data: { url: LAUNCH_URL, expires_at: '' } })
    await first
  })

  it('does nothing when the player cannot play', async () => {
    const { games, api } = await loadRoomGames({ api: apiLaunching(), gamesEnabled: false })

    await games.open(ROULETTE)

    expect(api).not.toHaveBeenCalled()
    expect(games.currentGame.value).toBeNull()
    expect(games.status.value).toBe('idle')
  })

  it('surfaces a launch failure and keeps the game for a retry', async () => {
    const api = vi.fn().mockRejectedValue(new Error('Games are down'))
    const { games } = await loadRoomGames({ api })

    await games.open(ROULETTE)

    expect(games.status.value).toBe('error')
    expect(games.errorMessage.value).toBe('Games are down')
    expect(games.gameUrl.value).toBeNull()
    expect(games.currentGame.value).toEqual(ROULETTE)
  })
})

describe('useRoomGames — layout → container', () => {
  it('renders half and tall games in a sheet and a full game in the overlay', async () => {
    const { games } = await loadRoomGames({ api: apiLaunching() })

    await games.open(ROULETTE)
    expect(games.container.value?.mode).toBe('sheet')
    expect(games.isFullScreen.value).toBe(false)
    await games.close()

    await games.open(LUCKY_77)
    expect(games.container.value).toMatchObject({ mode: 'sheet', panelClass: expect.stringContaining('aspect-[2/3]') })
    expect(games.isFullScreen.value).toBe(false)
    await games.close()

    await games.open(BIG_EATER)
    expect(games.container.value).toEqual({ mode: 'overlay' })
    expect(games.isFullScreen.value).toBe(true)
  })
})

describe('useRoomGames.retry()', () => {
  it('relaunches the same game the player picked, not a lobby', async () => {
    const api = vi.fn()
      .mockRejectedValueOnce(new Error('Games are down'))
      .mockResolvedValueOnce({ data: { url: LAUNCH_URL, expires_at: '' } })
    const { games } = await loadRoomGames({ api })

    await games.open(LUCKY_77)
    expect(games.status.value).toBe('error')

    await games.retry()

    const launches = callsTo(api, '/games/launch')
    expect(launches).toHaveLength(2)
    expect(launches[1]?.[1]).toEqual({ method: 'POST', body: { room_id: 7, game_id: '26' } })
    expect(games.status.value).toBe('loading')
    expect(games.gameUrl.value).toBe(LAUNCH_URL)
    expect(games.errorMessage.value).toBeNull()
  })

  it('does nothing when no game was picked', async () => {
    const { games, api } = await loadRoomGames({ api: apiLaunching() })

    await games.retry()

    expect(api).not.toHaveBeenCalled()
  })
})

describe('useRoomGames.close()', () => {
  it('ends the session, clears the game and returns to the picker state', async () => {
    const { games, api } = await loadRoomGames({ api: apiLaunching() })
    await games.open(ROULETTE)

    await games.close()

    expect(games.currentGame.value).toBeNull()
    expect(games.container.value).toBeNull()
    expect(games.gameUrl.value).toBeNull()
    expect(games.status.value).toBe('idle')
    expect(games.errorMessage.value).toBeNull()
    expect(callsTo(api, '/games/close')).toHaveLength(1)
  })

  it('does not call /games/close when nothing was ever launched', async () => {
    // Open the picker, look, leave: the commonest path, and it must not spend
    // one of the shared 20-a-minute calls.
    const { games, api } = await loadRoomGames({ api: apiLaunching() })

    await games.close()

    expect(api).not.toHaveBeenCalled()
  })

  it('does not call /games/close twice for one session', async () => {
    // In-game exit closes the session, then the page closes the surface, which
    // closes again.
    const { games, api } = await loadRoomGames({ api: apiLaunching() })
    await games.open(ROULETTE)

    await games.close()
    await games.close()

    expect(callsTo(api, '/games/close')).toHaveLength(1)
  })

  it('still ends the server session when the launch has not answered yet', async () => {
    const pending = deferred<unknown>()
    const api = vi.fn().mockImplementation((path: string) =>
      path === '/games/launch' ? pending.promise : Promise.resolve({ data: {} }),
    )
    const { games } = await loadRoomGames({ api })

    const opening = games.open(ROULETTE)
    await games.close()

    expect(callsTo(api, '/games/close')).toHaveLength(1)

    pending.resolve({ data: { url: LAUNCH_URL, expires_at: '' } })
    await opening
  })

  it('swallows a failed /games/close — the server session expires on its own', async () => {
    const api = vi.fn().mockImplementation(async (path: string) => {
      if (path === '/games/close') throw new Error('offline')
      return { data: { url: LAUNCH_URL, expires_at: '' } }
    })
    const { games } = await loadRoomGames({ api })
    await games.open(ROULETTE)

    await expect(games.close()).resolves.toBeUndefined()
    expect(games.currentGame.value).toBeNull()
  })
})

describe('useRoomGames — stale launches', () => {
  it('discards a launch response that arrives after close()', async () => {
    const pending = deferred<{ data: { url: string; expires_at: string } }>()
    const api = vi.fn().mockImplementation((path: string) =>
      path === '/games/launch' ? pending.promise : Promise.resolve({ data: {} }),
    )
    const { games } = await loadRoomGames({ api })

    const opening = games.open(ROULETTE)
    await games.close()
    pending.resolve({ data: { url: LAUNCH_URL, expires_at: '' } })
    await opening

    // Reopening the surface must find the picker, not a game nobody picked.
    expect(games.gameUrl.value).toBeNull()
    expect(games.currentGame.value).toBeNull()
    expect(games.status.value).toBe('idle')
  })

  it('discards a launch FAILURE that arrives after close()', async () => {
    const pending = deferred<never>()
    const api = vi.fn().mockImplementation((path: string) =>
      path === '/games/launch' ? pending.promise : Promise.resolve({ data: {} }),
    )
    const { games } = await loadRoomGames({ api })

    const opening = games.open(ROULETTE)
    await games.close()
    pending.reject(new Error('late failure'))
    await opening

    expect(games.status.value).toBe('idle')
    expect(games.errorMessage.value).toBeNull()
  })

  it('lets a newer launch win over an older one that resolves last', async () => {
    const first = deferred<{ data: { url: string; expires_at: string } }>()
    const second = deferred<{ data: { url: string; expires_at: string } }>()
    const pendingLaunches = [first, second]
    const api = vi.fn().mockImplementation((path: string) =>
      path === '/games/launch' ? pendingLaunches.shift()!.promise : Promise.resolve({ data: {} }),
    )
    const { games } = await loadRoomGames({ api })

    const openingA = games.open(ROULETTE) // tap A, then ← back before it answers
    await games.close()
    const openingB = games.open(LUCKY_77) // tap B

    second.resolve({ data: { url: 'https://joysdk.com/b', expires_at: '' } })
    await openingB
    first.resolve({ data: { url: 'https://joysdk.com/a', expires_at: '' } })
    await openingA

    expect(games.gameUrl.value).toBe('https://joysdk.com/b')
    expect(games.currentGame.value).toEqual(LUCKY_77)
  })
})
