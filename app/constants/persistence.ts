// ========================================
// Persistence Constants
// ========================================
//
// Storage keys and cookie names the persisted Pinia stores and the API layer
// read. Cookie-backed persistence was retired by ADR 0048 (cost-and-speed-tuning
// 15): every store now persists to localStorage, and the cookies below are only
// read once, as a legacy seed, on the first boot after the OTA that moved them.
//
// ⚠️ Renaming any of these orphans every existing user's saved value — the
// store reads empty once, with no error anywhere.

// ----------------------------------------
// localStorage keys
// ----------------------------------------

/**
 * `auth.token`. Its own key on purpose: `auth.user` already persists to
 * localStorage under the bare store id `auth`, and two entries on one storage
 * with one key overwrite each other.
 */
export const AUTH_TOKEN_STORAGE_KEY = 'auth-token'

/**
 * `roomSession` (activeRoom marker, minimized room, previous route). Keeps the
 * legacy `roomStore` name so the seed cookie and the new key share one name.
 */
export const ROOM_SESSION_STORAGE_KEY = 'roomStore'

/** `homeFeed` browse choices (country + live-only). Equal to the store id. */
export const HOME_FEED_STORAGE_KEY = 'homeFeed'

// ----------------------------------------
// Cookies
// ----------------------------------------

/**
 * The durable Sanctum bearer token cookie the pre-ADR-0048 build wrote and read
 * on every request. Still WRITTEN on login/logout (`auth.setToken` →
 * `services/legacyAuthCookies.ts`). Readers (checked 2026-11-08): this build
 * only as the one-time seed of `AUTH_TOKEN_STORAGE_KEY`; the static
 * `public/welcome/index.html` pre-paint redirect guard; an older bundle after an
 * OTA rollback. Not the backend, MSAB, the Nitro routes, or the native shell.
 */
export const LEGACY_TOKEN_COOKIE = 'sanctum_token'

/** Lifetime of `LEGACY_TOKEN_COOKIE`, in seconds — matches backend Sanctum expiration (90 days). */
export const LEGACY_TOKEN_COOKIE_MAX_AGE_S = 90 * 24 * 60 * 60

/**
 * The `pinia-plugin-persistedstate` cookie the pre-ADR-0048 build kept
 * `{"token": …}` in (named after the store id). Seed fallback only; expired on
 * the next login/logout.
 */
export const LEGACY_AUTH_PERSIST_COOKIE = 'auth'

/** Laravel's CSRF cookie, echoed back as `X-XSRF-TOKEN` when the browser can see it. */
export const XSRF_COOKIE = 'XSRF-TOKEN'
