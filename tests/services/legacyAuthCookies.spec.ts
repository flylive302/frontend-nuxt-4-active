// ========================================
// legacyAuthCookies — the one-time token seed and the rollback mirror (ADR 0048)
// ========================================
// `auth.token` persists to localStorage; the cookies the previous build used are
// read once as a seed (`legacyAuthTokenSeed`) and kept in step on login/logout
// (`mirrorLegacyTokenCookie`) for the welcome-page guard and OTA rollback.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { legacyAuthTokenSeed, mirrorLegacyTokenCookie } from '~/services/legacyAuthCookies'
import { stubCookieDocument } from '../helpers/persistedPinia'

afterEach(() => {
  vi.unstubAllGlobals()
})

// ========================================
// legacyAuthTokenSeed
// ========================================

describe('legacyAuthTokenSeed', () => {
  const authCookie = (value: unknown) => `auth=${encodeURIComponent(JSON.stringify(value))}`

  it('adopts the sanctum_token cookie as {"token":"…"}', () => {
    stubCookieDocument(`sanctum_token=${encodeURIComponent('12|abcdef')}`)
    expect(legacyAuthTokenSeed()).toBe(JSON.stringify({ token: '12|abcdef' }))
  })

  it('sanctum_token wins over the auth cookie', () => {
    stubCookieDocument(`${authCookie({ token: 'from-auth' })}; sanctum_token=${encodeURIComponent('1|from-sanctum')}`)
    expect(legacyAuthTokenSeed()).toBe(JSON.stringify({ token: '1|from-sanctum' }))
  })

  it('falls back to the auth cookie when there is no sanctum_token', () => {
    stubCookieDocument(authCookie({ token: '7|from-auth' }))
    expect(legacyAuthTokenSeed()).toBe(JSON.stringify({ token: '7|from-auth' }))
  })

  it.each([
    ['null token', { token: null }],
    ['empty token', { token: '' }],
    ['non-string token', { token: 123 }],
    ['no token key', {}],
  ])('rejects an auth cookie with a %s', (_label, value) => {
    stubCookieDocument(authCookie(value))
    expect(legacyAuthTokenSeed()).toBeNull()
  })

  it('rejects an auth cookie that is not JSON', () => {
    stubCookieDocument('auth=garbage')
    expect(legacyAuthTokenSeed()).toBeNull()
  })

  it('unwraps a JSON-quoted sanctum_token (%2212345%22 → token "12345")', () => {
    stubCookieDocument('sanctum_token=%2212345%22')
    expect(legacyAuthTokenSeed()).toBe(JSON.stringify({ token: '12345' }))
  })

  it('returns null when neither cookie exists', () => {
    stubCookieDocument('theme=dark')
    expect(legacyAuthTokenSeed()).toBeNull()
  })
})

// ========================================
// mirrorLegacyTokenCookie
// ========================================

describe('mirrorLegacyTokenCookie', () => {
  it('writes sanctum_token (90 days, Lax, Secure) and clears the old auth persist cookie', () => {
    const { writes } = stubCookieDocument()

    mirrorLegacyTokenCookie('12|abc')

    expect(writes).toEqual([
      'sanctum_token=12%7Cabc; Max-Age=7776000; Path=/; SameSite=Lax; Secure',
      'auth=; Max-Age=0; Path=/',
    ])
  })

  it('on null clears both cookies (sanctum_token with the attributes it was written with)', () => {
    const { writes } = stubCookieDocument()

    mirrorLegacyTokenCookie(null)

    expect(writes).toEqual([
      'sanctum_token=; Max-Age=0; Path=/; SameSite=Lax; Secure',
      'auth=; Max-Age=0; Path=/',
    ])
  })
})
