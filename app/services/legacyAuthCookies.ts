// ========================================
// Legacy auth cookies — the one-time token seed and the rollback mirror
// ========================================
//
// Before ADR 0048 the Sanctum token lived in two cookies: `sanctum_token`
// (written by `auth.setToken`, read on every request by `useApi` and on every
// boot by the old `plugins/auth.ts`) and `auth` (the persisted-state cookie,
// `{"token": …}`). It now persists to localStorage (`AUTH_TOKEN_STORAGE_KEY`).
// This module is the only code that still touches those cookies, with plain
// `document.cookie` access — no `useCookie()`, no listeners.

import {
  LEGACY_AUTH_PERSIST_COOKIE,
  LEGACY_TOKEN_COOKIE,
  LEGACY_TOKEN_COOKIE_MAX_AGE_S,
} from '~/constants/persistence'
import { readCookie, writeCookie } from '~/services/browserCookies'

// ========================================
// Seed
// ========================================

/**
 * Seed for `auth.token`'s `seededLocalStorage`: the serialized `{"token": …}`
 * the old build left, or `null`.
 *
 * `sanctum_token` first: the old auth plugin treated it as authoritative and
 * overwrote the persisted token with it on every boot. The persist cookie is
 * the fallback for a user who only has that one.
 */
export function legacyAuthTokenSeed(): string | null {
  const token = unwrapJsonString(readCookie(LEGACY_TOKEN_COOKIE))
  if (token) return JSON.stringify({ token })

  const persisted = readCookie(LEGACY_AUTH_PERSIST_COOKIE)
  return persisted !== null && hasToken(persisted) ? persisted : null
}

// ========================================
// Mirror
// ========================================

/**
 * Keep `sanctum_token` in step with the token (login, logout) — called by
 * `auth.setToken`, so it runs only when the token changes.
 *
 * Two readers depend on it:
 * - `public/welcome/index.html`'s pre-paint guard redirects a signed-in visitor
 *   to `/` when this cookie is present (its fallback when `localStorage.auth`
 *   is gone).
 * - An OTA rollback: the previous bundle reads `sanctum_token` as the source of
 *   truth, so mirroring keeps a user who signed in after this OTA signed in on
 *   the old one, and clearing it on logout stops the old one reviving a session.
 *
 * The old persist cookie is cleared on every change so it can never disagree.
 */
export function mirrorLegacyTokenCookie(token: string | null): void {
  writeCookie(LEGACY_TOKEN_COOKIE, token, {
    maxAge: LEGACY_TOKEN_COOKIE_MAX_AGE_S,
    path: '/',
    sameSite: 'Lax',
    secure: true,
  })
  writeCookie(LEGACY_AUTH_PERSIST_COOKIE, null, { path: '/' })
}

// ========================================
// Helpers
// ========================================

/**
 * Nuxt's `useCookie` JSON-quoted a string only when the raw string itself
 * parsed as non-string JSON (e.g. all digits). Sanctum tokens (`<id>|<secret>`)
 * never do, but unwrap the quoted form anyway so either encoding seeds.
 */
function unwrapJsonString(value: string | null): string | null {
  if (value === null || !value.startsWith('"')) return value
  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'string' ? parsed : value
  } catch {
    return value
  }
}

/** True when `serialized` is JSON of the shape `{"token": "<non-empty>"}`. */
function hasToken(serialized: string): boolean {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    return false
  }
  if (typeof parsed !== 'object' || parsed === null) return false
  const token = (parsed as { token?: unknown }).token
  return typeof token === 'string' && token.length > 0
}
