// ========================================
// pretty-id-auction-enabled middleware Tests (pretty-id step 2)
// ========================================
// The Rare Auction route gate reads the combined event + auction flag from the
// bootstrap store, waits for a cold-start bootstrap to settle (bounded), and
// 404s when off.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive, watch } from 'vue'
import { PRETTY_ID_GATE_WAIT_MS } from '../../app/constants/bootstrap'

type Phase = 'idle' | 'loading' | 'complete' | 'error'

const store = reactive({ phase: 'complete' as Phase, prettyIdAuctionEnabled: false })

vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn)
vi.stubGlobal('useBootstrapStore', () => store)
vi.stubGlobal('watch', watch)
vi.stubGlobal('createError', (opts: { statusCode: number }) => Object.assign(new Error('Not Found'), opts))

const { default: middleware } = await import('~/middleware/pretty-id-auction-enabled')
const run = () => (middleware as () => Promise<void>)()

describe('pretty-id-auction-enabled', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    store.phase = 'complete'
    store.prettyIdAuctionEnabled = false
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('404s when the auction flag is off', async () => {
    await expect(run()).rejects.toMatchObject({ statusCode: 404 })
  })

  it('passes when the auction flag is on', async () => {
    store.prettyIdAuctionEnabled = true
    await expect(run()).resolves.toBeUndefined()
  })

  it('waits for a cold-start bootstrap, then passes when it turns the flag on', async () => {
    store.phase = 'loading'
    const result = run()
    let settled = false
    result.then(() => { settled = true }, () => { settled = true })
    await vi.advanceTimersByTimeAsync(1000)
    expect(settled).toBe(false)

    store.prettyIdAuctionEnabled = true
    store.phase = 'complete'
    await expect(result).resolves.toBeUndefined()
  })

  it('waits for a cold-start bootstrap, then 404s when the flag stays off', async () => {
    store.phase = 'idle'
    const result = run()
    const assertion = expect(result).rejects.toMatchObject({ statusCode: 404 })
    store.phase = 'complete'
    await assertion
  })

  it('counts a failed bootstrap as off', async () => {
    store.phase = 'loading'
    const result = run()
    const assertion = expect(result).rejects.toMatchObject({ statusCode: 404 })
    store.phase = 'error'
    await assertion
  })

  it('gives up waiting after the bound and treats a hung bootstrap as off', async () => {
    store.phase = 'loading'
    const result = run()
    const assertion = expect(result).rejects.toMatchObject({ statusCode: 404 })
    await vi.advanceTimersByTimeAsync(PRETTY_ID_GATE_WAIT_MS)
    await assertion
  })
})
