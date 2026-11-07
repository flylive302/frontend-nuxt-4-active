// ========================================
// Browser cookies — plain reads and writes, nothing left behind
// ========================================
//
// ⛔ Never call Nuxt's `useCookie()` outside a component / effect scope on the
// client (ADR 0048). Every call installs a `cookieStore` "change" listener (or a
// BroadcastChannel where `cookieStore` is missing), a deep `watch` and — when a
// `maxAge` is set — a timer, and only `onScopeDispose` removes them. Called from
// a fetch hook, a store's persistence or a timer there is no scope, so each call
// leaked one listener for the life of the page. On the A6x that grew to 43,403
// handler calls (10 s of main thread) per 45 s gifting window
// (gift-authority-tick-fanout/17).
//
// These helpers touch `document.cookie` once per call and keep nothing.

// ========================================
// Types
// ========================================

export interface CookieWriteOptions {
  /** Lifetime in seconds. Omitted = session cookie. Ignored when clearing. */
  maxAge?: number
  /** Defaults to `/`; clearing must use the path the cookie was written with. */
  path?: string
  sameSite?: 'Lax' | 'Strict' | 'None'
  secure?: boolean
}

// ========================================
// Reads
// ========================================

/**
 * URI-decoded value of one cookie, or `null` when it is absent, empty, or not
 * valid percent-encoding. No listener, no watcher, no cache.
 */
export function readCookie(name: string): string | null {
  const raw = readRawCookie(name)
  if (raw === null || raw === '') return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return null
  }
}

// ========================================
// Writes
// ========================================

/**
 * Set a cookie, or clear it with `null`. Fails silently: a blocked cookie jar
 * must never break the caller (a login, a logout).
 */
export function writeCookie(name: string, value: string | null, options: CookieWriteOptions = {}): void {
  if (typeof document === 'undefined') return

  const parts = [`${name}=${value === null ? '' : encodeURIComponent(value)}`]
  if (value === null) parts.push('Max-Age=0')
  else if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`)
  parts.push(`Path=${options.path ?? '/'}`)
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)
  if (options.secure) parts.push('Secure')

  try {
    document.cookie = parts.join('; ')
  } catch {
    // Sandboxed / cookie-disabled context — nothing to do.
  }
}

// ========================================
// Helpers
// ========================================

function readRawCookie(name: string): string | null {
  if (typeof document === 'undefined') return null

  let jar: string
  try {
    jar = document.cookie
  } catch {
    return null
  }

  for (const pair of jar.split(';')) {
    const eq = pair.indexOf('=')
    if (eq === -1) continue
    if (pair.slice(0, eq).trim() === name) return pair.slice(eq + 1).trim()
  }
  return null
}
