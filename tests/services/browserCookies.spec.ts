// ========================================
// browserCookies — plain document.cookie reads/writes (ADR 0048)
// ========================================
// No listener, no watcher, no cache: every call touches document.cookie once.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { readCookie, writeCookie } from '~/services/browserCookies'

// ========================================
// Helpers
// ========================================

/** Stub a `document` whose cookie getter returns `jar`. */
function stubJar(jar: string): void {
  vi.stubGlobal('document', { cookie: jar })
}

/** Stub a `document` that records every assignment to `document.cookie`. */
function stubWritableDocument(): string[] {
  const writes: string[] = []
  vi.stubGlobal('document', {
    get cookie() {
      return ''
    },
    set cookie(value: string) {
      writes.push(value)
    },
  })
  return writes
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// ========================================
// readCookie
// ========================================

describe('readCookie', () => {
  it('finds one cookie among several, tolerating spaces around pairs', () => {
    stubJar('a=1; XSRF-TOKEN=abc; theme=dark;  other = x ')
    expect(readCookie('XSRF-TOKEN')).toBe('abc')
    expect(readCookie('a')).toBe('1')
    expect(readCookie('theme')).toBe('dark')
    expect(readCookie('other')).toBe('x')
  })

  it('keeps everything after the first "=" (value containing "=")', () => {
    stubJar('a=1; token=abc==; b=2')
    expect(readCookie('token')).toBe('abc==')
  })

  it('matches the whole name, not a suffix or prefix', () => {
    stubJar('xauth=nope; auth2=nope; auth=yes')
    expect(readCookie('auth')).toBe('yes')
  })

  it('returns null when the cookie is absent', () => {
    stubJar('a=1; b=2')
    expect(readCookie('missing')).toBeNull()
  })

  it('returns null for an empty jar and for a pair with no "="', () => {
    stubJar('')
    expect(readCookie('a')).toBeNull()
    stubJar('flag; a=1')
    expect(readCookie('flag')).toBeNull()
  })

  it('returns null when the cookie is present but empty', () => {
    stubJar('a=; b=2')
    expect(readCookie('a')).toBeNull()
  })

  it('returns null for bad percent-encoding instead of throwing', () => {
    stubJar('bad=%E0%A4%A')
    expect(readCookie('bad')).toBeNull()
  })

  it('URI-decodes the value (%7C → |, %3D → =)', () => {
    stubJar('sanctum_token=12%7Cabcdef; XSRF-TOKEN=abc%3D')
    expect(readCookie('sanctum_token')).toBe('12|abcdef')
    expect(readCookie('XSRF-TOKEN')).toBe('abc=')
  })

  it('returns null when there is no document (node / SSR)', () => {
    vi.stubGlobal('document', undefined)
    expect(readCookie('a')).toBeNull()
  })

  it('returns null when reading document.cookie throws', () => {
    vi.stubGlobal('document', {
      get cookie(): string {
        throw new Error('SecurityError')
      },
    })
    expect(readCookie('a')).toBeNull()
  })
})

// ========================================
// writeCookie
// ========================================

describe('writeCookie', () => {
  it('assigns the exact string for a value with maxAge / path / SameSite / Secure', () => {
    const writes = stubWritableDocument()

    writeCookie('sanctum_token', '12|abc', { maxAge: 7776000, path: '/', sameSite: 'Lax', secure: true })

    expect(writes).toEqual(['sanctum_token=12%7Cabc; Max-Age=7776000; Path=/; SameSite=Lax; Secure'])
  })

  it('writes a session cookie (no Max-Age) with the default path "/" when options are omitted', () => {
    const writes = stubWritableDocument()

    writeCookie('a', 'b')

    expect(writes).toEqual(['a=b; Path=/'])
  })

  it('floors a fractional maxAge', () => {
    const writes = stubWritableDocument()

    writeCookie('a', 'b', { maxAge: 10.9 })

    expect(writes).toEqual(['a=b; Max-Age=10; Path=/'])
  })

  it('clears with null → "name=; Max-Age=0; Path=/"', () => {
    const writes = stubWritableDocument()

    writeCookie('auth', null)

    expect(writes).toEqual(['auth=; Max-Age=0; Path=/'])
  })

  it('clearing ignores maxAge and honours the path it was written with', () => {
    const writes = stubWritableDocument()

    writeCookie('auth', null, { maxAge: 999, path: '/app' })

    expect(writes).toEqual(['auth=; Max-Age=0; Path=/app'])
  })

  it('does not throw when the document.cookie setter throws', () => {
    vi.stubGlobal('document', {
      get cookie() {
        return ''
      },
      set cookie(_value: string) {
        throw new Error('SecurityError')
      },
    })

    expect(() => writeCookie('a', 'b')).not.toThrow()
  })

  it('is a no-op when there is no document', () => {
    vi.stubGlobal('document', undefined)
    expect(() => writeCookie('a', 'b')).not.toThrow()
  })
})
