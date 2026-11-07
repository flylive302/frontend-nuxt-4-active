// ========================================
// auth store — persist entries never share a storage key (account-bans 03)
// ========================================
// pinia-plugin-persistedstate defaults every entry's key to the store id. Two
// entries on the same storage with the same key overwrite each other: adding
// `blockInfo` without its own key silently stopped `user` from persisting.
//
// ADR 0048 (cost-and-speed-tuning 15): the token entry moved off
// `piniaPluginPersistedstate.cookies()` onto `seededLocalStorage(...)`, whose
// storage is a real object. It is mocked to the label 'localStorage' here (it
// IS localStorage-backed) so the (storage, key) uniqueness check stays
// meaningful instead of every object stringifying to `[object Object]`.
// The legacy-cookie seed lives in `services/legacyAuthCookies` and is mocked
// separately, so the seeding test can assert the token entry is wired with
// `legacyAuthTokenSeed` itself (the function, not a look-alike).

import { describe, it, expect, vi } from 'vitest'
import { ref, computed } from 'vue'
import { AUTH_TOKEN_STORAGE_KEY } from '~/constants/persistence'

type PersistEntry = { key?: string; pick?: string[]; storage: unknown }

const { captured, seededLocalStorageMock, legacyAuthTokenSeedMock } = vi.hoisted(() => ({
  captured: { id: '', persist: [] as PersistEntry[] },
  seededLocalStorageMock: vi.fn((_seed: unknown) => 'localStorage'),
  legacyAuthTokenSeedMock: vi.fn(),
}))

vi.mock('pinia', () => ({
  defineStore: (id: string, _setup: unknown, options: { persist: PersistEntry[] }) => {
    captured.id = id
    captured.persist = options.persist
    return () => ({})
  },
}))

vi.mock('~/services/seededLocalStorage', () => ({
  seededLocalStorage: seededLocalStorageMock,
}))

vi.mock('~/services/legacyAuthCookies', () => ({
  legacyAuthTokenSeed: legacyAuthTokenSeedMock,
  mirrorLegacyTokenCookie: vi.fn(),
}))

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => 'cookies',
  localStorage: () => 'localStorage',
  sessionStorage: () => 'sessionStorage',
})

await import('~/stores/auth')

describe('auth store persist config', () => {
  it('every (storage, key) pair is unique', () => {
    const pairs = captured.persist.map((p) => `${String(p.storage)}::${p.key ?? captured.id}`)
    expect(new Set(pairs).size).toBe(pairs.length)
  })

  it('blockInfo is persisted (survives kill + relaunch) on durable storage', () => {
    const entry = captured.persist.find((p) => p.pick?.includes('blockInfo'))
    expect(entry?.storage).toBe('localStorage')
  })

  it('the token entry persists under its own "auth-token" key on localStorage', () => {
    const entry = captured.persist.find((p) => p.pick?.includes('token'))

    expect(entry?.key).toBe(AUTH_TOKEN_STORAGE_KEY)
    expect(entry?.key).toBe('auth-token')
    expect(entry?.storage).toBe('localStorage')
    expect(entry?.pick).toEqual(['token'])
  })

  it('the token entry is seeded once from the legacy auth cookies', () => {
    expect(seededLocalStorageMock).toHaveBeenCalledWith(legacyAuthTokenSeedMock)
  })

  it('the token key differs from the user entry key (the store id), so the two cannot overwrite each other', () => {
    const tokenEntry = captured.persist.find((p) => p.pick?.includes('token'))
    const userEntry = captured.persist.find((p) => p.pick?.includes('user'))

    expect(userEntry?.key ?? captured.id).toBe('auth')
    expect(tokenEntry?.key).not.toBe(userEntry?.key ?? captured.id)
  })

  it('no entry persists through cookies()', () => {
    expect(captured.persist.length).toBeGreaterThan(0)
    expect(captured.persist.map((p) => p.storage)).not.toContain('cookies')
  })

  it('msabToken stays on per-tab sessionStorage', () => {
    const entry = captured.persist.find((p) => p.pick?.includes('msabToken'))
    expect(entry?.storage).toBe('sessionStorage')
  })
})
