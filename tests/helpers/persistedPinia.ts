// ========================================
// Persisted-Pinia test harness (ADR 0048)
// ========================================
// Real Pinia + the real `pinia-plugin-persistedstate` over fake browser
// globals, so a spec can watch what a persisted store actually reads and
// writes. Nuxt auto-imports are not available under Vitest's node environment,
// so the few globals the stores use (`ref`, `computed`,
// `piniaPluginPersistedstate`) are stubbed here.
//
// Usage — call `installBrowserFakes()` at module top level BEFORE dynamically
// importing a store (`auth` reads `piniaPluginPersistedstate` at definition
// time), then `fakes.reset()` in `beforeEach`.

import { vi } from 'vitest'
import { computed, createApp, ref } from 'vue'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import type { StorageLike } from 'pinia-plugin-persistedstate'

// ========================================
// Types
// ========================================

export interface FakeStorage extends StorageLike {
  readonly data: Map<string, string>
}

export interface FakeCookieJar {
  /** Replace the whole `document.cookie` string the page "has". */
  set(jar: string): void
  /** Number of times `document.cookie` was READ. */
  readonly reads: () => number
  /** Every string assigned to `document.cookie`, in order. */
  readonly writes: string[]
  reset(): void
}

export interface BrowserFakes {
  localStorage: FakeStorage
  sessionStorage: FakeStorage
  cookieJar: FakeCookieJar
  /** The `piniaPluginPersistedstate.cookies()` factory spy. */
  cookiesFactory: ReturnType<typeof vi.fn>
  /** Empty both storages and the cookie jar. Call in `beforeEach`. */
  reset(): void
}

// ========================================
// Fakes
// ========================================

export function createFakeStorage(): FakeStorage {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  }
}

function createFakeCookieJar(): { jar: FakeCookieJar; document: { cookie: string } } {
  let current = ''
  let reads = 0
  const writes: string[] = []
  const document = {
    get cookie(): string {
      reads += 1
      return current
    },
    set cookie(value: string) {
      writes.push(value)
    },
  }
  const jar: FakeCookieJar = {
    set: (value) => {
      current = value
    },
    reads: () => reads,
    writes,
    reset: () => {
      current = ''
      reads = 0
      writes.length = 0
    },
  }
  return { jar, document }
}

/**
 * Stub ONLY the global `document` with a fake cookie jar holding `initial`, and
 * return the jar (`writes` records every `document.cookie = …` assignment).
 * For service-level specs that read or write cookies and need nothing else;
 * pair with `vi.unstubAllGlobals()` in `afterEach`.
 */
export function stubCookieDocument(initial = ''): FakeCookieJar {
  const { jar, document } = createFakeCookieJar()
  jar.set(initial)
  vi.stubGlobal('document', document)
  return jar
}

/**
 * Stub every global a persisted store touches. `cookies` is what
 * `piniaPluginPersistedstate.cookies()` returns; by default it throws on use so
 * a store that regresses to cookie persistence fails loudly (and the factory
 * spy records that it was asked for at all).
 */
export function installBrowserFakes(options: { cookies?: () => StorageLike } = {}): BrowserFakes {
  const localStorage = createFakeStorage()
  const sessionStorage = createFakeStorage()
  const { jar, document } = createFakeCookieJar()

  const cookiesFactory = vi.fn(
    options.cookies ??
      (() => {
        throw new Error('piniaPluginPersistedstate.cookies() must not be used (ADR 0048)')
      }),
  )

  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('localStorage', localStorage)
  vi.stubGlobal('sessionStorage', sessionStorage)
  vi.stubGlobal('document', document)
  vi.stubGlobal('piniaPluginPersistedstate', {
    cookies: cookiesFactory,
    localStorage: () => localStorage,
    sessionStorage: () => sessionStorage,
  })

  return {
    localStorage,
    sessionStorage,
    cookieJar: jar,
    cookiesFactory,
    reset() {
      localStorage.data.clear()
      sessionStorage.data.clear()
      jar.reset()
    },
  }
}

// ========================================
// Pinia
// ========================================

/**
 * A fresh Pinia with the persisted-state plugin installed and made active — the
 * same shape the Nuxt module gives the app. Stores created from it hydrate from
 * `localStorage` (or their own `storage`) synchronously.
 */
export function createPersistedPinia(defaultStorage: StorageLike): Pinia {
  const pinia = createPinia()
  // Plugins are queued until the pinia is installed on an app.
  createApp({}).use(pinia)
  pinia.use(createPersistedState({ storage: defaultStorage }))
  setActivePinia(pinia)
  return pinia
}
