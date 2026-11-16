// ========================================
// useRoomGameLobby — one Room games surface, two providers
// ========================================
// The risk is cross-wiring: a Fly game sent down JoyPlay's `/games/launch` (it
// 422s, or worse, a future id collides), or JoyPlay losing its launch path.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { markRaw, nextTick, watch } from 'vue'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
  createMockApi,
  createMockAuthStore,
  createMockBalanceStore,
  createMockBootstrapStore,
} from '../helpers/nuxtMocks'
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
const LAUNCH_URL = 'https://joysdk.com/game?token=abc'

const ROULETTE: GameCatalogEntry = {
  game_id: '10', name: 'Roulette', category: 'Casino', layout: 'half',
  provider: 'joyplay', places: ['room_lobby'], origin: null,
}
const LUDO: GameCatalogEntry = {
  game_id: 'fly-ludo', name: 'Ludo', category: 'Casual', layout: 'full',
  provider: 'fly', places: ['room_lobby', 'games_page'], origin: ORIGIN,
}

function apiMock() {
  return vi.fn().mockImplementation(async (path: string) => {
    if (path === '/games/launch') return { data: { url: LAUNCH_URL, expires_at: '' } }
    if (path === '/games/fly/token') return { data: { token: 'jwt-1', origin: ORIGIN } }
    return { data: {} }
  })
}

function callsTo(api: ReturnType<typeof vi.fn>, path: string) {
  return api.mock.calls.filter(([calledPath]) => calledPath === path)
}

async function loadLobby(options: { gamesEnabled?: boolean } = {}) {
  const api = apiMock()
  setupNuxtMocks({
    authStore: createMockAuthStore({ user: { id: 1, name: 'Test User' } }),
    balanceStore: createMockBalanceStore({ wealthXp: '500', charmXp: '0' }),
    bootstrapStore: createMockBootstrapStore({ gamesEnabled: options.gamesEnabled ?? true, isReady: true }),
    api: createMockApi({ api }),
  })

  let handler: ((event: Partial<MessageEvent>) => void) | null = null
  ;(globalThis as Record<string, unknown>).window = {
    addEventListener: vi.fn((type: string, fn: typeof handler) => {
      if (type === 'message') handler = fn
    }),
    removeEventListener: vi.fn(),
  }
  const { useLevelLookup } = await import('~/composables/shared/useLevelLookup')
  ;(globalThis as Record<string, unknown>).useLevelLookup = useLevelLookup
  ;(globalThis as Record<string, unknown>).useRoomStore = () => ({ currentRoom: { id: 42 } })
  ;(globalThis as Record<string, unknown>).useRouter = () => ({ push: vi.fn() })
  ;(globalThis as Record<string, unknown>).watch = watch
  ;(globalThis as Record<string, unknown>).nextTick = nextTick
  ;(globalThis as Record<string, unknown>).onMounted = (fn: () => void) => fn()
  ;(globalThis as Record<string, unknown>).onBeforeUnmount = vi.fn()

  const onExitRequested = vi.fn()
  const { useRoomGameLobby } = await import('~/composables/room/useRoomGameLobby')
  const lobby = useRoomGameLobby({ onExitRequested })

  const gameWindow = { postMessage: vi.fn() }
  // markRaw: Vue never proxies a real HTMLIFrameElement, so the fake must not be either.
  lobby.frame.value = markRaw({ contentWindow: gameWindow }) as unknown as HTMLIFrameElement

  function fromFly(type: string, extra: Record<string, unknown> = {}) {
    handler?.({ origin: ORIGIN, source: gameWindow as unknown as MessageEventSource, data: { source: 'flylive-ludo', type, ...extra } })
  }

  return { lobby, api, gameWindow, fromFly, onExitRequested }
}

async function settle() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

afterEach(() => {
  cleanupNuxtMocks()
  for (const key of ['window', 'useLevelLookup', 'useRoomStore', 'useRouter', 'watch', 'nextTick', 'onMounted', 'onBeforeUnmount']) {
    Reflect.deleteProperty(globalThis, key)
  }
  vi.restoreAllMocks()
})

describe('useRoomGameLobby — dispatch by provider', () => {
  it('opens a JoyPlay game through /games/launch, exactly as before', async () => {
    const { lobby, api } = await loadLobby()

    await lobby.open(ROULETTE)

    expect(callsTo(api, '/games/launch')).toEqual([['/games/launch', { method: 'POST', body: { room_id: 42, game_id: '10' } }]])
    expect(lobby.gameUrl.value).toBe(LAUNCH_URL)
    expect(lobby.container.value?.mode).toBe('sheet')
  })

  it('treats a row with no provider (pre-fly-games backend) as JoyPlay', async () => {
    const { lobby, api } = await loadLobby()

    await lobby.open({ game_id: '10', name: 'Roulette', category: 'Casino', layout: 'half' })

    expect(callsTo(api, '/games/launch')).toHaveLength(1)
  })

  it('opens a Fly game in the shared frame without ever calling /games/launch', async () => {
    const { lobby, api } = await loadLobby()

    await lobby.open(LUDO)

    expect(lobby.gameUrl.value).toBe(ORIGIN)
    expect(lobby.status.value).toBe('launching')
    expect(lobby.isFullScreen.value).toBe(true)
    expect(lobby.currentGame.value).toEqual(LUDO)
    expect(callsTo(api, '/games/launch')).toHaveLength(0)
  })

  it('tells the Fly game which Room it was opened from', async () => {
    const { lobby, gameWindow, fromFly } = await loadLobby()
    await lobby.open(LUDO)

    fromFly('ready')
    await settle()

    expect(gameWindow.postMessage).toHaveBeenCalledWith({ source: 'flylive', type: 'room', roomId: '42' }, ORIGIN)
  })

  it('refuses a game with an unknown provider', async () => {
    const { lobby, api } = await loadLobby()

    await lobby.open({ ...ROULETTE, provider: 'someone-else' })

    expect(api).not.toHaveBeenCalled()
    expect(lobby.currentGame.value).toBeNull()
  })

  it('applies the Room games button gate to Fly games too', async () => {
    const { lobby } = await loadLobby({ gamesEnabled: false })

    await lobby.open(LUDO)

    expect(lobby.currentGame.value).toBeNull()
  })
})

describe('useRoomGameLobby — leaving', () => {
  it('closing a Fly game calls neither /games/close nor any other API', async () => {
    const { lobby, api } = await loadLobby()
    await lobby.open(LUDO)

    await lobby.close()

    expect(api).not.toHaveBeenCalled()
    expect(lobby.currentGame.value).toBeNull()
    expect(lobby.container.value).toBeNull()
  })

  it('closing a JoyPlay game still ends its server session', async () => {
    const { lobby, api } = await loadLobby()
    await lobby.open(ROULETTE)

    await lobby.close()

    expect(callsTo(api, '/games/close')).toHaveLength(1)
  })

  it('`return_to_room` from the Fly game closes the surface', async () => {
    const { lobby, fromFly, onExitRequested } = await loadLobby()
    await lobby.open(LUDO)

    fromFly('return_to_room', { roomId: '42', matchId: null })

    expect(onExitRequested).toHaveBeenCalledOnce()
    expect(lobby.currentGame.value).toBeNull()
  })

  it('retry on a Fly game reloads its frame, not a JoyPlay launch', async () => {
    const { lobby, api, fromFly } = await loadLobby()
    await lobby.open(LUDO)
    fromFly('launch_result', { ok: false, reason: 'x' })
    expect(lobby.status.value).toBe('error')

    await lobby.retry()

    expect(lobby.status.value).toBe('launching')
    expect(lobby.gameUrl.value).toBe(ORIGIN)
    expect(callsTo(api, '/games/launch')).toHaveLength(0)
  })
})
