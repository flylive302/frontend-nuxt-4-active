// ========================================
// pretty-id-landing middleware Tests (pretty-id step 2)
// ========================================
// `/pretty-id` is entry-only: it replaces itself with the landing tab —
// Choose ID while the auction is off, Rare Auction while it is on.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'

const store = reactive({ prettyIdAuctionEnabled: false })
const navigateTo = vi.fn((to: string, opts: unknown) => ({ to, opts }))

vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn)
vi.stubGlobal('useBootstrapStore', () => store)
vi.stubGlobal('navigateTo', navigateTo)

const { default: middleware } = await import('~/middleware/pretty-id-landing')
const run = () => (middleware as () => unknown)()

describe('pretty-id-landing', () => {
  beforeEach(() => {
    navigateTo.mockClear()
    store.prettyIdAuctionEnabled = false
  })

  it('redirects to Choose ID (replace) when the auction is off', () => {
    run()
    expect(navigateTo).toHaveBeenCalledWith('/pretty-id/choose', { replace: true })
  })

  it('redirects to Rare Auction (replace) when the auction is on', () => {
    store.prettyIdAuctionEnabled = true
    run()
    expect(navigateTo).toHaveBeenCalledWith('/pretty-id/auction', { replace: true })
  })

  it('returns the redirect so the router follows it', () => {
    expect(run()).toEqual({ to: '/pretty-id/choose', opts: { replace: true } })
  })
})
