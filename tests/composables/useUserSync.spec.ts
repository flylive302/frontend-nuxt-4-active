// ========================================
// User Sync Composable Tests
// ========================================
// Covers GATE (no token) → EXECUTE (fetch + seed stores) → REACT (swallow errors),
// plus the module-level inflight dedupe and the balance-race guard.

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
  createMockAuthStore,
  createMockApi,
} from '../helpers/nuxtMocks'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

function createMockBadgesStore(overrides: Record<string, unknown> = {}) {
  return {
    setEquippedBadges: vi.fn(),
    setBadgeSlotLimit: vi.fn(),
    ...overrides,
  }
}

describe('useUserSync', () => {
  afterEach(() => {
    cleanupNuxtMocks()
    Reflect.deleteProperty(globalThis, 'useBadgesStore')
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('GATE: no token → api not called', async () => {
    const api = createMockApi()
    const badgesStore = createMockBadgesStore()
    setupNuxtMocks({
      authStore: createMockAuthStore({ token: null }),
      api,
    })
    vi.stubGlobal('useBadgesStore', () => badgesStore)

    const { useUserSync } = await import('~/composables/shared/useUserSync')
    const { syncUser } = useUserSync()
    await syncUser()

    expect(api.api).not.toHaveBeenCalled()
  })

  it('happy path: setUser called with response data, badges setters called', async () => {
    const authStore = createMockAuthStore({ token: 'valid-token', user: null, lastBalanceSeq: 0 })
    const badgesStore = createMockBadgesStore()
    const api = createMockApi()
    api.api.mockResolvedValue({
      data: {
        id: 1,
        name: 'Alice',
        coins: '1000',
        diamonds: '5',
        wealth_xp: '10',
        charm_xp: '20',
        equipped_badges: [{ id: 1 }],
        badge_slot_limit: 3,
      },
    })
    setupNuxtMocks({ authStore, api })
    vi.stubGlobal('useBadgesStore', () => badgesStore)

    const { useUserSync } = await import('~/composables/shared/useUserSync')
    const { syncUser } = useUserSync()
    await syncUser()

    expect(authStore.setUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Alice', coins: '1000' })
    )
    expect(badgesStore.setEquippedBadges).toHaveBeenCalledWith([{ id: 1 }])
    expect(badgesStore.setBadgeSlotLimit).toHaveBeenCalledWith(3)
  })

  it('balance-race: seq increases mid-flight → store balance fields win, other fields from response', async () => {
    const authStore = createMockAuthStore({
      token: 'valid-token',
      user: { id: 1, name: 'Alice', coins: '900', diamonds: '2', wealth_xp: '1', charm_xp: '2' },
      lastBalanceSeq: 5,
    })
    const badgesStore = createMockBadgesStore()
    const api = createMockApi()
    let resolveApi!: (v: unknown) => void
    api.api.mockReturnValue(new Promise((resolve) => { resolveApi = resolve }))
    setupNuxtMocks({ authStore, api })
    vi.stubGlobal('useBadgesStore', () => badgesStore)

    const { useUserSync } = await import('~/composables/shared/useUserSync')
    const { syncUser } = useUserSync()

    const pending = syncUser()

    // Mutate the store mid-flight to simulate a balance push racing the fetch.
    const mutable = authStore as unknown as { lastBalanceSeq: number, user: { coins: string } }
    mutable.lastBalanceSeq = 6
    mutable.user.coins = '900'

    resolveApi({
      data: {
        id: 1,
        name: 'Alice',
        coins: '1000',
        diamonds: '5',
        wealth_xp: '10',
        charm_xp: '20',
        equipped_badges: [],
        badge_slot_limit: 0,
      },
    })
    await pending

    expect(authStore.setUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Alice',
        coins: '900',
        diamonds: '2',
        wealth_xp: '1',
        charm_xp: '2',
      })
    )
  })

  it('no race: seq unchanged → setUser receives response coins verbatim', async () => {
    const authStore = createMockAuthStore({
      token: 'valid-token',
      user: { id: 1, name: 'Alice', coins: '900', diamonds: '2', wealth_xp: '1', charm_xp: '2' },
      lastBalanceSeq: 5,
    })
    const badgesStore = createMockBadgesStore()
    const api = createMockApi()
    api.api.mockResolvedValue({
      data: {
        id: 1,
        name: 'Alice',
        coins: '1000',
        diamonds: '5',
        wealth_xp: '10',
        charm_xp: '20',
        equipped_badges: [],
        badge_slot_limit: 0,
      },
    })
    setupNuxtMocks({ authStore, api })
    vi.stubGlobal('useBadgesStore', () => badgesStore)

    const { useUserSync } = await import('~/composables/shared/useUserSync')
    const { syncUser } = useUserSync()
    await syncUser()

    expect(authStore.setUser).toHaveBeenCalledWith(
      expect.objectContaining({ coins: '1000', diamonds: '5', wealth_xp: '10', charm_xp: '20' })
    )
  })

  it('dedupe: concurrent calls share one request; a later call issues a new one', async () => {
    const authStore = createMockAuthStore({ token: 'valid-token', user: null, lastBalanceSeq: 0 })
    const badgesStore = createMockBadgesStore()
    const api = createMockApi()
    api.api.mockResolvedValue({
      data: {
        id: 1,
        name: 'Alice',
        coins: '1000',
        diamonds: '5',
        wealth_xp: '10',
        charm_xp: '20',
        equipped_badges: [],
        badge_slot_limit: 0,
      },
    })
    setupNuxtMocks({ authStore, api })
    vi.stubGlobal('useBadgesStore', () => badgesStore)

    const { useUserSync } = await import('~/composables/shared/useUserSync')
    const { syncUser } = useUserSync()

    const [a, b] = [syncUser(), syncUser()]
    await Promise.all([a, b])
    expect(api.api).toHaveBeenCalledTimes(1)

    await syncUser()
    expect(api.api).toHaveBeenCalledTimes(2)
  })

  it('logout mid-flight: token cleared before response resolves → setUser not called', async () => {
    const authStore = createMockAuthStore({ token: 'valid-token', user: null, lastBalanceSeq: 0 })
    const badgesStore = createMockBadgesStore()
    const api = createMockApi()
    let resolveApi!: (v: unknown) => void
    api.api.mockReturnValue(new Promise((resolve) => { resolveApi = resolve }))
    setupNuxtMocks({ authStore, api })
    vi.stubGlobal('useBadgesStore', () => badgesStore)

    const { useUserSync } = await import('~/composables/shared/useUserSync')
    const { syncUser } = useUserSync()

    const pending = syncUser()
    ;(authStore as unknown as { token: string | null }).token = null

    resolveApi({
      data: {
        id: 1,
        name: 'Alice',
        coins: '1000',
        diamonds: '5',
        wealth_xp: '10',
        charm_xp: '20',
        equipped_badges: [],
        badge_slot_limit: 0,
      },
    })
    await pending

    expect(authStore.setUser).not.toHaveBeenCalled()
  })

  it('api rejects → no throw, setUser not called', async () => {
    const authStore = createMockAuthStore({ token: 'valid-token', user: null, lastBalanceSeq: 0 })
    const badgesStore = createMockBadgesStore()
    const api = createMockApi()
    api.api.mockRejectedValue(new Error('Network error'))
    setupNuxtMocks({ authStore, api })
    vi.stubGlobal('useBadgesStore', () => badgesStore)

    const { useUserSync } = await import('~/composables/shared/useUserSync')
    const { syncUser } = useUserSync()

    await expect(syncUser()).resolves.toBeUndefined()
    expect(authStore.setUser).not.toHaveBeenCalled()
  })
})
