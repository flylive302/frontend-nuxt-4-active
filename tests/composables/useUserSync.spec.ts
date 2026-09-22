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
  createMockBalanceStore,
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

  it('happy path: setUser + balance seed called with response data, badges setters called', async () => {
    const authStore = createMockAuthStore({ token: 'valid-token', user: null })
    const balanceStore = createMockBalanceStore({ seq: 0 })
    const badgesStore = createMockBadgesStore()
    const api = createMockApi()
    const responseData = {
      id: 1,
      name: 'Alice',
      coins: '1000',
      diamonds: '5',
      wealth_xp: '10',
      charm_xp: '20',
      equipped_badges: [{ id: 1 }],
      badge_slot_limit: 3,
    }
    api.api.mockResolvedValue({ data: responseData })
    setupNuxtMocks({ authStore, balanceStore, api })
    vi.stubGlobal('useBadgesStore', () => badgesStore)

    const { useUserSync } = await import('~/composables/shared/useUserSync')
    const { syncUser } = useUserSync()
    await syncUser()

    expect(authStore.setUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Alice', coins: '1000' })
    )
    expect(balanceStore.seed).toHaveBeenCalledWith(responseData)
    expect(badgesStore.setEquippedBadges).toHaveBeenCalledWith([{ id: 1 }])
    expect(badgesStore.setBadgeSlotLimit).toHaveBeenCalledWith(3)
  })

  it('balance-race: seq push mid-flight → balance store NOT seeded, but authStore.user is still replaced', async () => {
    const authStore = createMockAuthStore({
      token: 'valid-token',
      user: { id: 1, name: 'Alice', coins: '900', diamonds: '2', wealth_xp: '1', charm_xp: '2' },
    })
    const balanceStore = createMockBalanceStore({ seq: 5 })
    const badgesStore = createMockBadgesStore()
    const api = createMockApi()
    let resolveApi!: (v: unknown) => void
    api.api.mockReturnValue(new Promise((resolve) => { resolveApi = resolve }))
    setupNuxtMocks({ authStore, balanceStore, api })
    vi.stubGlobal('useBadgesStore', () => badgesStore)

    const { useUserSync } = await import('~/composables/shared/useUserSync')
    const { syncUser } = useUserSync()

    const pending = syncUser()

    // Simulate a seq-guarded balance push racing the fetch.
    balanceStore.seq = 6

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

    // authStore is always replaced wholesale with the raw response.
    expect(authStore.setUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Alice', coins: '1000' })
    )
    // But the balance store keeps whatever the mid-flight push left — no seed.
    expect(balanceStore.seed).not.toHaveBeenCalled()
  })

  it('no race: seq unchanged → balance store seeded from response', async () => {
    const authStore = createMockAuthStore({
      token: 'valid-token',
      user: { id: 1, name: 'Alice', coins: '900', diamonds: '2', wealth_xp: '1', charm_xp: '2' },
    })
    const balanceStore = createMockBalanceStore({ seq: 5 })
    const badgesStore = createMockBadgesStore()
    const api = createMockApi()
    const responseData = {
      id: 1,
      name: 'Alice',
      coins: '1000',
      diamonds: '5',
      wealth_xp: '10',
      charm_xp: '20',
      equipped_badges: [],
      badge_slot_limit: 0,
    }
    api.api.mockResolvedValue({ data: responseData })
    setupNuxtMocks({ authStore, balanceStore, api })
    vi.stubGlobal('useBadgesStore', () => badgesStore)

    const { useUserSync } = await import('~/composables/shared/useUserSync')
    const { syncUser } = useUserSync()
    await syncUser()

    expect(authStore.setUser).toHaveBeenCalledWith(
      expect.objectContaining({ coins: '1000', diamonds: '5', wealth_xp: '10', charm_xp: '20' })
    )
    expect(balanceStore.seed).toHaveBeenCalledWith(responseData)
  })

  it('dedupe: concurrent calls share one request; a later call issues a new one', async () => {
    const authStore = createMockAuthStore({ token: 'valid-token', user: null })
    const balanceStore = createMockBalanceStore()
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
    setupNuxtMocks({ authStore, balanceStore, api })
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
    const authStore = createMockAuthStore({ token: 'valid-token', user: null })
    const balanceStore = createMockBalanceStore()
    const badgesStore = createMockBadgesStore()
    const api = createMockApi()
    let resolveApi!: (v: unknown) => void
    api.api.mockReturnValue(new Promise((resolve) => { resolveApi = resolve }))
    setupNuxtMocks({ authStore, balanceStore, api })
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
    expect(balanceStore.seed).not.toHaveBeenCalled()
  })

  it('api rejects → no throw, setUser not called', async () => {
    const authStore = createMockAuthStore({ token: 'valid-token', user: null })
    const balanceStore = createMockBalanceStore()
    const badgesStore = createMockBadgesStore()
    const api = createMockApi()
    api.api.mockRejectedValue(new Error('Network error'))
    setupNuxtMocks({ authStore, balanceStore, api })
    vi.stubGlobal('useBadgesStore', () => badgesStore)

    const { useUserSync } = await import('~/composables/shared/useUserSync')
    const { syncUser } = useUserSync()

    await expect(syncUser()).resolves.toBeUndefined()
    expect(authStore.setUser).not.toHaveBeenCalled()
  })
})
