/**
 * plugins/nav-direction.client.ts — the Pretty ID tab group is resolved per
 * navigation, so the slide direction follows the on-screen tab order.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

type Guard = (to: { path: string }, from: { path: string }) => void

// vitest runs in node: stub just the bit of `document` the plugin touches.
const rootEl = { dataset: {} as Record<string, string | undefined> }
vi.stubGlobal('document', { documentElement: rootEl })
vi.stubGlobal('history', { state: { position: 0 } })

const store = { prettyIdAuctionEnabled: false }
let guard: Guard

vi.stubGlobal('defineNuxtPlugin', (fn: () => void) => fn)
vi.stubGlobal('useBootstrapStore', () => store)
vi.stubGlobal('useRouter', () => ({
  beforeEach: (fn: Guard) => { guard = fn },
  afterEach: () => {},
}))

const CHOOSE = '/pretty-id/choose'
const AUCTION = '/pretty-id/auction'

describe('nav-direction plugin — Pretty ID tabs', () => {
  beforeEach(async () => {
    store.prettyIdAuctionEnabled = false
    delete rootEl.dataset.nav
    const plugin = (await import('../../app/plugins/nav-direction.client')).default as unknown as () => void
    plugin()
  })

  const nav = (from: string, to: string): string | undefined => {
    guard({ path: to }, { path: from })
    return rootEl.dataset.nav
  }

  it('auction off: Choose → Auction is forward, Auction → Choose is back', () => {
    expect(nav(CHOOSE, AUCTION)).toBe('forward')
    expect(nav(AUCTION, CHOOSE)).toBe('back')
  })

  it('auction on: Auction → Choose is forward, Choose → Auction is back', () => {
    store.prettyIdAuctionEnabled = true
    expect(nav(AUCTION, CHOOSE)).toBe('forward')
    expect(nav(CHOOSE, AUCTION)).toBe('back')
  })
})
