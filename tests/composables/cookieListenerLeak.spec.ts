// ========================================
// Cookie listener leak — regression (ADR 0048, cost-and-speed-tuning/15)
// ========================================
// Nuxt's `useCookie()` called outside an effect scope installs a `cookieStore`
// "change" listener that nothing ever removes. It used to leak from `useApi`'s
// request hook (two per request) and from `piniaPluginPersistedstate.cookies()`
// storage (auth, roomSession, homeFeed). On the A6x that reached 43,403
// handler calls per 45 s of gifting.
//
// This spec fakes `useCookie` the way Nuxt behaves (one `cookieStore` listener
// per call) and drives the real `useApi` hooks and the real persisted stores.
// If anything on those paths goes back to `useCookie()`, the counts grow.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineStore } from 'pinia'
import { nextTick, ref } from 'vue'
import type { FetchContext } from 'ofetch'
import { createPersistedPinia, installBrowserFakes } from '../helpers/persistedPinia'

// ========================================
// Types
// ========================================

type RequestHook = (ctx: FetchContext) => void
interface CapturedClientOptions {
  onRequest?: RequestHook
}

// ========================================
// Mocks — ofetch, as a tiny stand-in that runs the real onRequest hook
// ========================================

const { createdOptions, clientCalls } = vi.hoisted(() => ({
  createdOptions: [] as CapturedClientOptions[],
  clientCalls: [] as Array<{ headers: Headers }>,
}))

vi.mock('ofetch', () => ({
  ofetch: {
    create: (opts: CapturedClientOptions) => {
      createdOptions.push(opts)
      // Mimics ofetch: run onRequest with the call's options, then "respond".
      return vi.fn(async (_url: string, callOptions: Record<string, unknown> = {}) => {
        const options: { headers?: HeadersInit } = { ...callOptions }
        opts.onRequest?.({ options } as unknown as FetchContext)
        clientCalls.push({ headers: options.headers as Headers })
        return {}
      })
    },
  },
}))

vi.mock('~/composables/shared/useClientInfo', () => ({ getClientType: () => 'web' }))
vi.mock('~/composables/shared/useDeviceId', () => ({ useDeviceId: () => 'device-1' }))

// ========================================
// Environment — Nuxt's useCookie, faked to leak exactly as the real one does
// ========================================

const cookieStoreAddEventListener = vi.fn()
vi.stubGlobal('cookieStore', { addEventListener: cookieStoreAddEventListener })

/** Mimics Nuxt: every call outside a scope installs a never-removed "change" listener. */
const useCookieFake = vi.fn((_name: string) => {
  const cookieStore = (globalThis as { cookieStore?: { addEventListener: (type: string, handler: () => void) => void } }).cookieStore
  cookieStore?.addEventListener('change', () => undefined)
  return ref<string | null>(null)
})
vi.stubGlobal('useCookie', useCookieFake)

const fakes = installBrowserFakes({
  // A store that regresses to `.cookies()` persists through useCookie again.
  cookies: () => ({
    getItem: (key: string) => useCookieFake(key).value,
    setItem: (key: string, value: string) => {
      useCookieFake(key).value = value
    },
  }),
})

vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'https://api.test/api' } }))
vi.stubGlobal('useBlockedState', () => ({ enterBlocked: vi.fn(), resumeAfterBlock: vi.fn() }))
vi.stubGlobal('useConnectivityStore', () => ({ recordFailure: vi.fn(), resetFailures: vi.fn() }))

const { useRoomSessionStore } = await import('~/stores/roomSession')
const { useAuthStore } = await import('~/stores/auth')
const { useHomeFeedStore } = await import('~/stores/homeFeed')
vi.stubGlobal('useAuthStore', useAuthStore)
const { useApi } = await import('~/composables/shared/useApi')

// Store definitions run at import time; capture what they asked for before any
// test (the canary below deliberately calls `cookies()`).
const cookiesFactoryCallsAtImport = fakes.cookiesFactory.mock.calls.length

const N = 50

function listenerCount(): number {
  return cookieStoreAddEventListener.mock.calls.length
}

/** Run the real `onRequest` hook once and return the headers it set. */
function runOnRequest(): Headers {
  useApi()
  const hook = createdOptions.at(-1)?.onRequest
  if (!hook) throw new Error('onRequest not captured')
  const options: { headers: HeadersInit } = { headers: {} }
  hook({ options } as unknown as FetchContext)
  return options.headers as Headers
}

beforeEach(() => {
  fakes.reset()
  clientCalls.length = 0
  cookieStoreAddEventListener.mockClear()
  useCookieFake.mockClear()
  fakes.cookiesFactory.mockClear()
})

// ========================================
// Store definitions
// ========================================

describe('store definitions', () => {
  it('auth, roomSession and homeFeed never ask for piniaPluginPersistedstate.cookies()', () => {
    expect(cookiesFactoryCallsAtImport).toBe(0)
  })
})

// ========================================
// Harness canary — the detector must be able to fail
// ========================================

describe('harness canary', () => {
  it('a store persisted through cookies() DOES leak one listener per write (so a regression would be caught)', async () => {
    createPersistedPinia(fakes.localStorage)
    const useCanary = defineStore(
      'canary',
      () => {
        const count = ref(0)
        return { count }
      },
      { persist: { key: 'canary', storage: piniaPluginPersistedstate.cookies() } },
    )
    const canary = useCanary()
    const afterHydrate = listenerCount()
    expect(afterHydrate).toBeGreaterThan(0)

    for (let i = 1; i <= 10; i++) {
      canary.count = i
      await nextTick()
    }

    expect(listenerCount()).toBe(afterHydrate + 10)
    expect(useCookieFake).toHaveBeenCalled()
  })
})

// ========================================
// useApi — onRequest
// ========================================

describe('useApi request hook', () => {
  it(`${N} onRequest invocations never call useCookie or add a cookieStore listener`, () => {
    createPersistedPinia(fakes.localStorage)
    useAuthStore().setToken('77|storetoken')
    const before = listenerCount()

    for (let i = 0; i < N; i++) runOnRequest()

    expect(useCookieFake).not.toHaveBeenCalled()
    expect(listenerCount()).toBe(before)
    expect(listenerCount()).toBe(0)
  })

  it(`${N} real api() calls never call useCookie or add a cookieStore listener`, async () => {
    createPersistedPinia(fakes.localStorage)
    useAuthStore().setToken('77|storetoken')
    const { api } = useApi()

    for (let i = 0; i < N; i++) await api('/rooms')

    expect(clientCalls).toHaveLength(N)
    expect(useCookieFake).not.toHaveBeenCalled()
    expect(listenerCount()).toBe(0)
  })

  it('sends Authorization as "Bearer <store token>"', () => {
    createPersistedPinia(fakes.localStorage)
    useAuthStore().setToken('77|storetoken')

    expect(runOnRequest().get('Authorization')).toBe('Bearer 77|storetoken')
  })

  it('sends no Authorization header when the store has no token', () => {
    createPersistedPinia(fakes.localStorage)

    expect(runOnRequest().has('Authorization')).toBe(false)
  })

  it('does not read the token from a sanctum_token cookie once the store is hydrated', () => {
    createPersistedPinia(fakes.localStorage)
    useAuthStore().setToken('77|storetoken')
    fakes.cookieJar.set('sanctum_token=99%7Cstale-cookie')

    expect(runOnRequest().get('Authorization')).toBe('Bearer 77|storetoken')
  })

  it('takes the token seeded from the legacy sanctum_token cookie on first boot', () => {
    fakes.cookieJar.set('sanctum_token=12%7Cabcdef')
    createPersistedPinia(fakes.localStorage)

    expect(runOnRequest().get('Authorization')).toBe('Bearer 12|abcdef')
  })

  it('sends X-XSRF-TOKEN from the XSRF-TOKEN cookie, URI-decoded (abc%3D → abc=)', () => {
    createPersistedPinia(fakes.localStorage)
    fakes.cookieJar.set('theme=dark; XSRF-TOKEN=abc%3D')

    expect(runOnRequest().get('X-XSRF-TOKEN')).toBe('abc=')
  })

  it('omits X-XSRF-TOKEN when the cookie is absent', () => {
    createPersistedPinia(fakes.localStorage)

    expect(runOnRequest().has('X-XSRF-TOKEN')).toBe(false)
  })

  it('keeps the standard headers and credentials', () => {
    createPersistedPinia(fakes.localStorage)
    useApi()
    const hook = createdOptions.at(-1)?.onRequest
    const options: { headers: HeadersInit; credentials?: string } = { headers: {} }
    hook?.({ options } as unknown as FetchContext)
    const headers = options.headers as Headers

    expect(headers.get('Accept')).toBe('application/json')
    expect(headers.get('X-Client-Type')).toBe('web')
    expect(headers.get('X-Device-ID')).toBe('device-1')
    expect(headers.get('X-Correlation-ID')).toBeTruthy()
    expect(options.credentials).toBe('include')
  })
})

// ========================================
// Persisted stores — writes
// ========================================

describe('persisted store writes', () => {
  it(`${N} roomSession.setActiveRoom writes (the call the heartbeat ends in) never call useCookie or add a listener`, async () => {
    createPersistedPinia(fakes.localStorage)
    const store = useRoomSessionStore()
    const before = listenerCount()

    for (let id = 1; id <= N; id++) {
      store.setActiveRoom(id)
      await nextTick()
    }

    expect(JSON.parse(fakes.localStorage.data.get('roomStore') ?? '{}')).toMatchObject({ activeRoom: { id: N } })
    expect(useCookieFake).not.toHaveBeenCalled()
    expect(listenerCount()).toBe(before)
    expect(listenerCount()).toBe(0)
  })

  it(`${N} auth.patchProfile / setUser / setToken writes never call useCookie or add a listener`, async () => {
    createPersistedPinia(fakes.localStorage)
    const store = useAuthStore()
    const before = listenerCount()

    store.setUser({ id: 1, name: 'First', followers_count: 0, following_count: 0 } as never)
    for (let i = 1; i <= N; i++) {
      store.patchProfile({ name: `Name ${i}` } as never)
      store.setToken(`${i}|token`)
      await nextTick()
    }

    expect(JSON.parse(fakes.localStorage.data.get('auth') ?? '{}')).toMatchObject({ user: { name: `Name ${N}` } })
    expect(JSON.parse(fakes.localStorage.data.get('auth-token') ?? '{}')).toEqual({ token: `${N}|token` })
    expect(useCookieFake).not.toHaveBeenCalled()
    expect(listenerCount()).toBe(before)
    expect(listenerCount()).toBe(0)
  })

  it(`${N} homeFeed.setCountry writes never call useCookie or add a listener`, async () => {
    createPersistedPinia(fakes.localStorage)
    const store = useHomeFeedStore()
    const before = listenerCount()

    for (let i = 1; i <= N; i++) {
      store.setCountry(`C${i}`)
      await nextTick()
    }

    expect(JSON.parse(fakes.localStorage.data.get('homeFeed') ?? '{}')).toMatchObject({ selectedCountry: `C${N}` })
    expect(useCookieFake).not.toHaveBeenCalled()
    expect(listenerCount()).toBe(before)
    expect(listenerCount()).toBe(0)
  })
})

// ========================================
// Everything together — a gifting-window shaped burst
// ========================================

describe('combined burst', () => {
  it(`${N} requests + ${N} writes on every persisted store leave the listener count at zero`, async () => {
    createPersistedPinia(fakes.localStorage)
    const room = useRoomSessionStore()
    const auth = useAuthStore()
    const feed = useHomeFeedStore()
    auth.setToken('1|token')
    fakes.cookieJar.set('XSRF-TOKEN=abc%3D')
    const { api } = useApi()
    const before = listenerCount()

    for (let i = 1; i <= N; i++) {
      await api('/gifts')
      runOnRequest()
      room.setActiveRoom(i)
      feed.setCountry(`C${i}`)
      auth.setToken(`${i}|token`)
      await nextTick()
    }

    expect(useCookieFake).toHaveBeenCalledTimes(0)
    expect(listenerCount()).toBe(before)
    expect(listenerCount()).toBe(0)
    expect(fakes.cookiesFactory).not.toHaveBeenCalled()
  })
})
