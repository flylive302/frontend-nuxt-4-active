// ========================================
// pretty-id-enabled middleware Tests (pretty-id 04)
// ========================================
// The Pretty ID route gate reads the server flag from the bootstrap store,
// waits for a cold-start bootstrap to settle (bounded), and 404s when off.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive, watch } from 'vue'
import { PRETTY_ID_GATE_WAIT_MS } from '../../app/constants/bootstrap'

type Phase = 'idle' | 'loading' | 'complete' | 'error'

const store = reactive({ phase: 'complete' as Phase, prettyIdEnabled: false })

vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn)
vi.stubGlobal('useBootstrapStore', () => store)
vi.stubGlobal('watch', watch)
vi.stubGlobal('createError', (opts: { statusCode: number }) => Object.assign(new Error('Not Found'), opts))

const { default: middleware } = await import('~/middleware/pretty-id-enabled')
const run = () => (middleware as () => Promise<void>)()

describe('pretty-id-enabled', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    store.phase = 'complete'
    store.prettyIdEnabled = false
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('404s when the server flag is off', async () => {
    await expect(run()).rejects.toMatchObject({ statusCode: 404 })
  })

  it('passes when the server flag is on', async () => {
    store.prettyIdEnabled = true
    await expect(run()).resolves.toBeUndefined()
  })

  it('waits for a cold-start bootstrap, then passes when it turns the flag on', async () => {
    store.phase = 'loading'
    const result = run()
    let settled = false
    result.then(() => { settled = true }, () => { settled = true })
    await vi.advanceTimersByTimeAsync(1000)
    expect(settled).toBe(false)

    store.prettyIdEnabled = true
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
