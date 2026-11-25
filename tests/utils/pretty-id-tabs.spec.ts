import { describe, it, expect } from 'vitest'
import { prettyIdDefaultRoute, prettyIdTabs } from '../../app/utils/pretty-id-tabs'

describe('prettyIdTabs', () => {
  it('auction off: Choose ID first, then Rare Auction', () => {
    expect(prettyIdTabs(false)).toEqual([
      { to: '/pretty-id/choose', label: 'Choose ID' },
      { to: '/pretty-id/auction', label: 'Rare Auction' },
    ])
  })

  it('auction on: Rare Auction first, then Choose ID', () => {
    expect(prettyIdTabs(true)).toEqual([
      { to: '/pretty-id/auction', label: 'Rare Auction' },
      { to: '/pretty-id/choose', label: 'Choose ID' },
    ])
  })
})

describe('prettyIdDefaultRoute', () => {
  it('lands on Choose ID when the auction is off', () => {
    expect(prettyIdDefaultRoute(false)).toBe('/pretty-id/choose')
  })

  it('lands on Rare Auction when the auction is on', () => {
    expect(prettyIdDefaultRoute(true)).toBe('/pretty-id/auction')
  })

  it('always lands on the first tab', () => {
    for (const on of [false, true]) {
      expect(prettyIdDefaultRoute(on)).toBe(prettyIdTabs(on)[0]!.to)
    }
  })
})
