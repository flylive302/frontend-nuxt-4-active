import { describe, it, expect } from 'vitest'
import { resolveMediaTransportUrl } from '../../app/utils/mediaTransport'

describe('resolveMediaTransportUrl', () => {
  it('returns the Laravel hosting_url in production', () => {
    expect(
      resolveMediaTransportUrl('wss://mumbai.audio.flyliveapp.com', false),
    ).toBe('wss://mumbai.audio.flyliveapp.com')
  })

  it('ignores the hosting_url in development so the local config URL is used', () => {
    expect(
      resolveMediaTransportUrl('wss://mumbai.audio.flyliveapp.com', true),
    ).toBeUndefined()
  })

  it('returns undefined in production when no hosting_url is provided', () => {
    expect(resolveMediaTransportUrl(null, false)).toBeUndefined()
    expect(resolveMediaTransportUrl(undefined, false)).toBeUndefined()
  })

  it('never returns a localhost endpoint from a provided hosting_url', () => {
    const url = resolveMediaTransportUrl('wss://frankfurt.audio.flyliveapp.com', false)

    expect(url).not.toContain('localhost')
  })
})
