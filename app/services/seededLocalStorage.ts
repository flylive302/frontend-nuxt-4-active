// ========================================
// Persisted-store storage: localStorage, seeded once from a legacy cookie
// ========================================
//
// ADR 0048 retired `piniaPluginPersistedstate.cookies()`: its `getItem` /
// `setItem` call Nuxt's `useCookie()` on every store write, and outside an
// effect scope each call leaks a `cookieStore` listener (see
// `services/browserCookies.ts`). The stores that used it now persist to
// localStorage through this storage, which adopts the value the previous build
// left in a cookie the first time its key is missing — so the OTA that moves
// them signs nobody out and drops no room rehydration.

import type { StorageLike } from 'pinia-plugin-persistedstate'
import { readCookie } from '~/services/browserCookies'

// ========================================
// Storage
// ========================================

/**
 * localStorage-backed persist storage with a one-time legacy seed.
 *
 * `seed` runs only while the key is ABSENT from localStorage. The value it
 * returns (already the serialized JSON the persist plugin expects) is written
 * through, so the next read comes from localStorage and the legacy source is
 * never consulted again for that key. That includes a logged-out
 * `{"token":null}`: once a key exists, a cookie left behind by the old build
 * cannot bring a session back.
 *
 * Every localStorage access is guarded — a blocked or full storage degrades to
 * "nothing persisted", never to a thrown error inside a store write.
 */
export function seededLocalStorage(seed: () => string | null): StorageLike {
  return {
    getItem(key) {
      const current = safeGet(key)
      if (current !== null) return current

      const seeded = seed()
      if (seeded !== null) safeSet(key, seeded)
      return seeded
    },
    setItem(key, value) {
      safeSet(key, value)
    },
  }
}

// ========================================
// Legacy seeds
// ========================================

/**
 * Seed from a cookie `piniaPluginPersistedstate.cookies()` wrote. That storage
 * stored `encodeURIComponent(JSON)`, so the decoded cookie IS the serialized
 * state. A value that is not JSON is ignored rather than adopted — adopting it
 * would fail every hydrate until the next write.
 */
export function legacyCookieSeed(cookieName: string): () => string | null {
  return () => {
    const value = readCookie(cookieName)
    return value !== null && isJson(value) ? value : null
  }
}

// ========================================
// Helpers
// ========================================

function storageOrNull(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    // Some WebViews throw on the property access itself when storage is disabled.
    return null
  }
}

function safeGet(key: string): string | null {
  try {
    return storageOrNull()?.getItem(key) ?? null
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    storageOrNull()?.setItem(key, value)
  } catch {
    // Quota exceeded / storage disabled — persistence is best-effort.
  }
}

function isJson(value: string): boolean {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}
