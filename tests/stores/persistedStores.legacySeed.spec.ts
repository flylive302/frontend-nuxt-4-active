// ========================================
// Persisted stores — localStorage + one-time legacy cookie seed (ADR 0048)
// ========================================
// cost-and-speed-tuning/15 acceptance: the room heartbeat's write
// (`useRoomSession().touchActiveRoom()` → `setActiveRoom`) no longer touches
// cookies, and a user mid-session on the OTA boot is still rehydrated (room
// marker), still signed in (token) and keeps the saved country — each seeded
// from the legacy cookie exactly once.
//
// Covers three stores (roomSession, auth, homeFeed) in one file because they
// share the harness and the same ADR 0048 contract.

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { nextTick } from 'vue'
import type { BootstrapRoom as Room } from '~/types/user/bootstrap'
import { createPersistedPinia, installBrowserFakes, type FakeStorage } from '../helpers/persistedPinia'

// ========================================
// Environment (must precede the store imports)
// ========================================

const fakes = installBrowserFakes()
const useCookieSpy = vi.fn()
vi.stubGlobal('useCookie', useCookieSpy)

const { useRoomSessionStore } = await import('~/stores/roomSession')
const { useAuthStore } = await import('~/stores/auth')
const { useHomeFeedStore } = await import('~/stores/homeFeed')
const { useRoomStore } = await import('~/stores/room')
const { useRoomSession } = await import('~/composables/room/useRoomSession')

// `useRoomSession` reaches both stores through Nuxt auto-imports; point those at
// the real stores (resolved against whichever Pinia is active when it is called).
vi.stubGlobal('useRoomStore', useRoomStore)
vi.stubGlobal('useRoomSessionStore', useRoomSessionStore)

/** What the previous build left in a cookie: `encodeURIComponent(JSON.stringify(pickedState))`. */
function legacyCookie(name: string, state: unknown): string {
  return `${name}=${encodeURIComponent(JSON.stringify(state))}`
}

function storedJson(key: string): unknown {
  const raw = fakes.localStorage.data.get(key)
  return raw === undefined ? undefined : JSON.parse(raw)
}

beforeEach(() => {
  fakes.reset()
  useCookieSpy.mockClear()
})

// ========================================
// roomSession — heartbeat write path
// ========================================

describe('roomSession persistence — heartbeat write', () => {
  it('setActiveRoom(42) writes localStorage "roomStore" with activeRoom.id 42 and never calls useCookie', async () => {
    createPersistedPinia(fakes.localStorage)
    const store = useRoomSessionStore()

    // The store call the heartbeat ends in. NOT the heartbeat itself:
    // `touchActiveRoom()` only reaches it while a room is current — that real
    // path is driven in 'useRoomSession.touchActiveRoom' below.
    store.setActiveRoom(42)
    await nextTick()

    expect(storedJson('roomStore')).toMatchObject({ activeRoom: { id: 42 } })
    expect(useCookieSpy).not.toHaveBeenCalled()
    expect(fakes.cookiesFactory).not.toHaveBeenCalled()
  })

  it('repeated heartbeats keep overwriting the same localStorage key and never read or write a cookie', async () => {
    createPersistedPinia(fakes.localStorage)
    const store = useRoomSessionStore()
    const readsAfterHydrate = fakes.cookieJar.reads()

    for (let id = 1; id <= 20; id++) {
      store.setActiveRoom(id)
      await nextTick()
    }

    expect(storedJson('roomStore')).toMatchObject({ activeRoom: { id: 20 } })
    expect(fakes.cookieJar.reads()).toBe(readsAfterHydrate)
    expect(fakes.cookieJar.writes).toEqual([])
    expect(useCookieSpy).not.toHaveBeenCalled()
  })

  it('setActiveRoom(null) persists the cleared marker', async () => {
    createPersistedPinia(fakes.localStorage)
    const store = useRoomSessionStore()
    store.setActiveRoom(42)
    await nextTick()

    store.setActiveRoom(null)
    await nextTick()

    expect(storedJson('roomStore')).toMatchObject({ activeRoom: null })
  })
})

// ========================================
// useRoomSession.touchActiveRoom — the real heartbeat call
// ========================================
// cost-and-speed-tuning/15 AC: `touchActiveRoom()` writes localStorage and never
// calls the cookie helper. Real composable over the REAL `roomStore` +
// `roomSessionStore` and the real persisted-state plugin; only the Nuxt
// auto-import globals are stubbed (to those same real stores, above).

function makeRoom(id: number): Room {
  return { id, logo: `logo-${id}` } as Room
}

describe('useRoomSession.touchActiveRoom — real heartbeat path', () => {
  const HEARTBEATS = 20
  let setItemSpy: MockInstance<FakeStorage['setItem']>

  beforeEach(() => {
    setItemSpy = vi.spyOn(fakes.localStorage, 'setItem')
  })

  afterEach(() => {
    setItemSpy.mockRestore()
  })

  it(`${HEARTBEATS} heartbeats for room 7 write localStorage "roomStore" each time and never use a cookie`, async () => {
    createPersistedPinia(fakes.localStorage)
    useRoomStore().setCurrentRoom(makeRoom(7))
    // First `useRoomSessionStore()` of this Pinia: hydrates (and reads the seed cookie) here.
    const { touchActiveRoom } = useRoomSession()
    const cookieReadsAfterHydrate = fakes.cookieJar.reads()
    setItemSpy.mockClear()

    for (let beat = 0; beat < HEARTBEATS; beat++) {
      touchActiveRoom()
      await nextTick()
    }

    expect(storedJson('roomStore')).toMatchObject({ activeRoom: { id: 7 } })
    expect(setItemSpy).toHaveBeenCalledTimes(HEARTBEATS)
    expect(setItemSpy.mock.calls.every(([key]) => key === 'roomStore')).toBe(true)
    // The hot in-memory room is never part of the persisted blob.
    expect(Object.keys(storedJson('roomStore') as object)).not.toContain('currentRoom')
    expect(useCookieSpy).not.toHaveBeenCalled()
    expect(fakes.cookiesFactory).not.toHaveBeenCalled()
    expect(fakes.cookieJar.reads()).toBe(cookieReadsAfterHydrate)
    expect(fakes.cookieJar.writes).toEqual([])
  })

  it('with no currentRoom, heartbeats write nothing (no marker is created)', async () => {
    createPersistedPinia(fakes.localStorage)
    const { touchActiveRoom } = useRoomSession()
    setItemSpy.mockClear()

    for (let beat = 0; beat < HEARTBEATS; beat++) {
      touchActiveRoom()
      await nextTick()
    }

    expect(setItemSpy).not.toHaveBeenCalled()
    expect(fakes.localStorage.data.has('roomStore')).toBe(false)
    expect(useRoomSessionStore().activeRoom).toBeNull()
    expect(useCookieSpy).not.toHaveBeenCalled()
    expect(fakes.cookiesFactory).not.toHaveBeenCalled()
  })

  it('with no currentRoom, heartbeats leave an existing marker untouched (they never resurrect or refresh it)', async () => {
    const existing = JSON.stringify({ activeRoom: { id: 3, at: 1 } })
    fakes.localStorage.data.set('roomStore', existing)
    createPersistedPinia(fakes.localStorage)
    const { touchActiveRoom } = useRoomSession()
    setItemSpy.mockClear()

    for (let beat = 0; beat < HEARTBEATS; beat++) {
      touchActiveRoom()
      await nextTick()
    }

    expect(setItemSpy).not.toHaveBeenCalled()
    expect(fakes.localStorage.data.get('roomStore')).toBe(existing)
    expect(useRoomSessionStore().activeRoom).toEqual({ id: 3, at: 1 })
  })
})

// ========================================
// roomSession — legacy cookie seed
// ========================================

describe('roomSession persistence — legacy cookie seed', () => {
  const marker = { id: 42, at: 1_700_000_000_000 }
  const legacy = { userRoom: null, previousRoute: '/rooms/42', minimizedRoom: null, activeRoom: marker }

  it('hydrates the legacy activeRoom marker when localStorage is empty, and writes it through', () => {
    fakes.cookieJar.set(legacyCookie('roomStore', legacy))

    createPersistedPinia(fakes.localStorage)
    const store = useRoomSessionStore()

    expect(store.activeRoom).toEqual(marker)
    expect(store.previousRoute).toBe('/rooms/42')
    expect(storedJson('roomStore')).toMatchObject({ activeRoom: marker })
  })

  it('seeds exactly once: a second fresh Pinia + store reads localStorage and never re-reads the cookie', () => {
    fakes.cookieJar.set(legacyCookie('roomStore', legacy))
    createPersistedPinia(fakes.localStorage)
    useRoomSessionStore()
    const readsAfterFirstBoot = fakes.cookieJar.reads()
    expect(readsAfterFirstBoot).toBeGreaterThan(0)

    // Prove the second boot cannot be served by the cookie.
    fakes.cookieJar.set('')
    createPersistedPinia(fakes.localStorage)
    const second = useRoomSessionStore()

    expect(second.activeRoom).toEqual(marker)
    expect(fakes.cookieJar.reads()).toBe(readsAfterFirstBoot)
  })

  it('an existing localStorage value wins over a lingering cookie', () => {
    fakes.localStorage.data.set('roomStore', JSON.stringify({ activeRoom: { id: 7, at: 5 } }))
    fakes.cookieJar.set(legacyCookie('roomStore', legacy))

    createPersistedPinia(fakes.localStorage)
    const store = useRoomSessionStore()

    expect(store.activeRoom).toEqual({ id: 7, at: 5 })
    expect(fakes.cookieJar.reads()).toBe(0)
  })

  it('no cookie and no localStorage → default state, nothing written', () => {
    createPersistedPinia(fakes.localStorage)
    const store = useRoomSessionStore()

    expect(store.activeRoom).toBeNull()
    expect(fakes.localStorage.data.has('roomStore')).toBe(false)
  })
})

// ========================================
// auth — token seed
// ========================================

describe('auth persistence — legacy token seed', () => {
  it('adopts the legacy sanctum_token cookie into authStore.token and writes "auth-token"', () => {
    fakes.cookieJar.set('sanctum_token=12%7Cabcdef')

    createPersistedPinia(fakes.localStorage)
    const store = useAuthStore()

    expect(store.token).toBe('12|abcdef')
    expect(storedJson('auth-token')).toEqual({ token: '12|abcdef' })
  })

  it('falls back to the old "auth" persist cookie when there is no sanctum_token', () => {
    fakes.cookieJar.set(legacyCookie('auth', { token: '9|fromauth' }))

    createPersistedPinia(fakes.localStorage)

    expect(useAuthStore().token).toBe('9|fromauth')
    expect(storedJson('auth-token')).toEqual({ token: '9|fromauth' })
  })

  it('seeds exactly once: the second boot reads "auth-token" and not the cookie', () => {
    fakes.cookieJar.set('sanctum_token=12%7Cabcdef')
    createPersistedPinia(fakes.localStorage)
    useAuthStore()
    const readsAfterFirstBoot = fakes.cookieJar.reads()
    expect(readsAfterFirstBoot).toBeGreaterThan(0)

    fakes.cookieJar.set('')
    createPersistedPinia(fakes.localStorage)
    const second = useAuthStore()

    expect(second.token).toBe('12|abcdef')
    expect(fakes.cookieJar.reads()).toBe(readsAfterFirstBoot)
  })

  it('a logged-out {"token":null} in localStorage is never revived by a lingering cookie', () => {
    fakes.localStorage.data.set('auth-token', JSON.stringify({ token: null }))
    fakes.cookieJar.set('sanctum_token=12%7Cabcdef')

    createPersistedPinia(fakes.localStorage)

    expect(useAuthStore().token).toBeNull()
  })

  it('setToken persists to "auth-token" and mirrors the legacy cookie without useCookie', async () => {
    createPersistedPinia(fakes.localStorage)
    const store = useAuthStore()

    store.setToken('55|newtoken')
    await nextTick()

    expect(storedJson('auth-token')).toEqual({ token: '55|newtoken' })
    expect(fakes.cookieJar.writes).toContain('sanctum_token=55%7Cnewtoken; Max-Age=7776000; Path=/; SameSite=Lax; Secure')
    expect(useCookieSpy).not.toHaveBeenCalled()
  })

  it('logout clears the persisted token and both legacy cookies', async () => {
    createPersistedPinia(fakes.localStorage)
    const store = useAuthStore()
    store.setToken('55|newtoken')
    await nextTick()
    fakes.cookieJar.writes.length = 0

    store.logout()
    await nextTick()

    expect(storedJson('auth-token')).toEqual({ token: null })
    expect(fakes.cookieJar.writes).toEqual([
      'sanctum_token=; Max-Age=0; Path=/; SameSite=Lax; Secure',
      'auth=; Max-Age=0; Path=/',
    ])
  })
})

// ========================================
// homeFeed — country seed
// ========================================

describe('homeFeed persistence — legacy country seed', () => {
  it('adopts selectedCountry and liveOnly from the legacy homeFeed cookie and writes "homeFeed"', () => {
    fakes.cookieJar.set(legacyCookie('homeFeed', { selectedCountry: 'PK', liveOnly: false }))

    createPersistedPinia(fakes.localStorage)
    const store = useHomeFeedStore()

    expect(store.selectedCountry).toBe('PK')
    expect(store.liveOnly).toBe(false)
    expect(storedJson('homeFeed')).toEqual({ selectedCountry: 'PK', liveOnly: false })
  })

  it('seeds exactly once: the second boot reads localStorage and not the cookie', () => {
    fakes.cookieJar.set(legacyCookie('homeFeed', { selectedCountry: 'PK', liveOnly: false }))
    createPersistedPinia(fakes.localStorage)
    useHomeFeedStore()
    const readsAfterFirstBoot = fakes.cookieJar.reads()
    expect(readsAfterFirstBoot).toBeGreaterThan(0)

    fakes.cookieJar.set('')
    createPersistedPinia(fakes.localStorage)
    const second = useHomeFeedStore()

    expect(second.selectedCountry).toBe('PK')
    expect(fakes.cookieJar.reads()).toBe(readsAfterFirstBoot)
  })

  it('setCountry persists to localStorage and never touches useCookie', async () => {
    createPersistedPinia(fakes.localStorage)
    const store = useHomeFeedStore()

    store.setCountry('US')
    await nextTick()

    expect(storedJson('homeFeed')).toMatchObject({ selectedCountry: 'US' })
    expect(useCookieSpy).not.toHaveBeenCalled()
  })

  it('rateLimitedUntil is not persisted', async () => {
    createPersistedPinia(fakes.localStorage)
    const store = useHomeFeedStore()

    store.setRateLimitedUntil(123)
    await nextTick()

    expect(JSON.stringify(storedJson('homeFeed') ?? {})).not.toContain('rateLimitedUntil')
  })
})

// ========================================
// No store asks for cookie persistence
// ========================================

describe('no store persists through cookies()', () => {
  it('importing and instantiating all three stores never calls piniaPluginPersistedstate.cookies()', () => {
    createPersistedPinia(fakes.localStorage)
    useRoomSessionStore()
    useAuthStore()
    useHomeFeedStore()

    expect(fakes.cookiesFactory).not.toHaveBeenCalled()
    expect(useCookieSpy).not.toHaveBeenCalled()
  })
})
