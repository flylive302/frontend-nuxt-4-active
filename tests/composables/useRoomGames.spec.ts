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
  createMockAuthStore,
  createMockBootstrapStore,
} from '../helpers/nuxtMocks'
import { MIN_WEALTH_LEVEL_FOR_GAMES } from '~/constants/games'

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

async function loadCanPlay(options: {
  wealthXp?: string
  gamesEnabled?: boolean | null
  userId?: number | null
  bootstrapReady?: boolean
} = {}) {
  const {
    wealthXp = XP.LEVEL_2,
    gamesEnabled = true,
    userId = 1,
    bootstrapReady = true,
  } = options

  const authStore = createMockAuthStore({
    user: userId === null ? null : { id: userId, name: 'Test User', wealth_xp: wealthXp, charm_xp: '0' },
  })
  const bootstrapStore = createMockBootstrapStore({
    gamesEnabled,
    isReady: bootstrapReady,
  })

  setupNuxtMocks({ authStore, bootstrapStore })

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

  return useRoomGames().canPlay
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
