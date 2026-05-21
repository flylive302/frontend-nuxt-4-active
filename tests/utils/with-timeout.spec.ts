import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { withTimeout } from '../../app/utils/with-timeout'

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('resolves with the value when the promise settles before the deadline', async () => {
    const result = withTimeout(Promise.resolve('done'), 1_000, 'op')

    await expect(result).resolves.toBe('done')
  })

  it('rejects with a labelled timeout error when the promise never settles', async () => {
    const pending = new Promise<string>(() => {}) // never settles
    const result = withTimeout(pending, 1_000, 'joinRoom')

    const assertion = expect(result).rejects.toThrow('joinRoom timed out after 1000ms')
    await vi.advanceTimersByTimeAsync(1_000)
    await assertion
  })

  it('clears the timeout timer once the promise resolves (no dangling timer)', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')

    await withTimeout(Promise.resolve(42), 5_000, 'op')

    expect(clearSpy).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('propagates the original rejection rather than the timeout when the promise rejects first', async () => {
    const result = withTimeout(Promise.reject(new Error('upstream failure')), 1_000, 'op')

    await expect(result).rejects.toThrow('upstream failure')
  })
})
