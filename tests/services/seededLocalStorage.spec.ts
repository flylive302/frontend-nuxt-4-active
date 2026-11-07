// ========================================
// seededLocalStorage — localStorage persist storage, seeded once from a legacy cookie (ADR 0048)
// ========================================
// The OTA that moves cookie-backed stores to localStorage must sign nobody out
// and drop no room rehydration, and must never revive a logged-out session.

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { legacyCookieSeed, seededLocalStorage } from '~/services/seededLocalStorage'
import { createFakeStorage, stubCookieDocument, type FakeStorage } from '../helpers/persistedPinia'

// ========================================
// Fakes
// ========================================

let storage: FakeStorage
let getItem: MockInstance<FakeStorage['getItem']>
let setItem: MockInstance<FakeStorage['setItem']>

beforeEach(() => {
  storage = createFakeStorage()
  getItem = vi.spyOn(storage, 'getItem')
  setItem = vi.spyOn(storage, 'setItem')
  vi.stubGlobal('localStorage', storage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ========================================
// seededLocalStorage
// ========================================

describe('seededLocalStorage', () => {
  it('an existing localStorage value wins and the seed is NOT called', () => {
    storage.data.set('k', '{"a":1}')
    const seed = vi.fn(() => '{"a":"from-cookie"}')

    expect(seededLocalStorage(seed).getItem('k')).toBe('{"a":1}')
    expect(seed).not.toHaveBeenCalled()
  })

  it('an absent key calls the seed, writes the value through and returns it', () => {
    const seed = vi.fn(() => '{"a":"seeded"}')

    expect(seededLocalStorage(seed).getItem('k')).toBe('{"a":"seeded"}')
    expect(storage.data.get('k')).toBe('{"a":"seeded"}')
    expect(seed).toHaveBeenCalledTimes(1)
  })

  it('seeds exactly once: the second getItem reads the written-through value', () => {
    const seed = vi.fn(() => '{"a":"seeded"}')
    const store = seededLocalStorage(seed)

    store.getItem('k')
    expect(store.getItem('k')).toBe('{"a":"seeded"}')
    expect(seed).toHaveBeenCalledTimes(1)
  })

  it('a stored {"token":null} blocks the seed (a logged-out user is never revived by a lingering cookie)', () => {
    storage.data.set('auth-token', '{"token":null}')
    const seed = vi.fn(() => '{"token":"stale-cookie-token"}')

    expect(seededLocalStorage(seed).getItem('auth-token')).toBe('{"token":null}')
    expect(seed).not.toHaveBeenCalled()
  })

  it('a seed returning null writes nothing and returns null', () => {
    const seed = vi.fn((): string | null => null)

    expect(seededLocalStorage(seed).getItem('k')).toBeNull()
    expect(setItem).not.toHaveBeenCalled()
    expect(storage.data.has('k')).toBe(false)
  })

  it('setItem writes straight to localStorage and never consults the seed', () => {
    const seed = vi.fn(() => '{"a":"seeded"}')

    seededLocalStorage(seed).setItem('k', '{"a":2}')

    expect(storage.data.get('k')).toBe('{"a":2}')
    expect(seed).not.toHaveBeenCalled()
  })

  it('localStorage.getItem throwing does not throw (falls through to the seed)', () => {
    getItem.mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const store = seededLocalStorage(() => '{"a":"seeded"}')

    expect(() => store.getItem('k')).not.toThrow()
    expect(store.getItem('k')).toBe('{"a":"seeded"}')
  })

  it('localStorage.setItem throwing (quota) does not throw, on write or on seed write-through', () => {
    setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const store = seededLocalStorage(() => '{"a":"seeded"}')

    expect(() => store.setItem('k', 'v')).not.toThrow()
    expect(() => store.getItem('k')).not.toThrow()
    expect(store.getItem('k')).toBe('{"a":"seeded"}')
  })

  it('a localStorage property access that throws degrades to "nothing persisted"', () => {
    vi.stubGlobal('localStorage', undefined)
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get(): Storage {
        throw new Error('SecurityError')
      },
    })
    const store = seededLocalStorage(() => null)

    expect(() => store.setItem('k', 'v')).not.toThrow()
    expect(store.getItem('k')).toBeNull()
  })

  it('no localStorage global at all degrades to "nothing persisted"', () => {
    vi.stubGlobal('localStorage', undefined)
    const store = seededLocalStorage(() => null)

    expect(() => store.setItem('k', 'v')).not.toThrow()
    expect(store.getItem('k')).toBeNull()
  })
})

// ========================================
// legacyCookieSeed
// ========================================

describe('legacyCookieSeed', () => {
  it('returns the decoded cookie when it is valid JSON (the decoded cookie IS the serialized state)', () => {
    const state = { activeRoom: { id: 42, at: 1 } }
    stubCookieDocument(`roomStore=${encodeURIComponent(JSON.stringify(state))}`)

    expect(legacyCookieSeed('roomStore')()).toBe(JSON.stringify(state))
  })

  it('ignores a cookie that is not JSON', () => {
    stubCookieDocument('roomStore=not-json')
    expect(legacyCookieSeed('roomStore')()).toBeNull()
  })

  it('returns null when the cookie is absent', () => {
    stubCookieDocument('other=1')
    expect(legacyCookieSeed('roomStore')()).toBeNull()
  })
})
