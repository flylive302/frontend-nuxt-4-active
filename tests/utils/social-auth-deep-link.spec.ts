import { describe, expect, it } from 'vitest'
import { parseSocialAuthDeepLink } from '~/utils/social-auth-deep-link'

describe('parseSocialAuthDeepLink', () => {
  it('extracts the single-use code from a success callback URL', () => {
    const result = parseSocialAuthDeepLink('com.flylive.app://callback?code=abc123XYZ')
    expect(result).toEqual({ code: 'abc123XYZ' })
  })

  it('extracts the error message from a failure callback URL', () => {
    const result = parseSocialAuthDeepLink('com.flylive.app://callback?error=access_denied')
    expect(result).toEqual({ error: 'access_denied' })
  })

  it('decodes percent-encoded error messages', () => {
    const result = parseSocialAuthDeepLink('com.flylive.app://callback?error=Sign-in%20failed')
    expect(result.error).toBe('Sign-in failed')
  })

  it('ignores unrelated query params and keeps only code/error', () => {
    const result = parseSocialAuthDeepLink('com.flylive.app://callback?code=tok&state=web&foo=bar')
    expect(result).toEqual({ code: 'tok' })
  })

  it('returns an empty result for a callback URL with no params', () => {
    expect(parseSocialAuthDeepLink('com.flylive.app://callback')).toEqual({})
  })

  it('returns an empty result for an empty string', () => {
    expect(parseSocialAuthDeepLink('')).toEqual({})
  })

  it('returns an empty result for a garbage string', () => {
    expect(parseSocialAuthDeepLink('not a url at all')).toEqual({})
  })

  it('falls back to manual query parsing when the URL constructor rejects the input', () => {
    // A bare scheme-less fragment the URL constructor cannot parse.
    const result = parseSocialAuthDeepLink('?code=fallbackCode')
    expect(result).toEqual({ code: 'fallbackCode' })
  })
})
