import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isReloadIntended, markReloadIntent } from '../../app/utils/reload-intent'

// ============================================================
// client-session-stability 01 — reload vs close at pagehide
//
// `pagehide` fires for both, but they need opposite seat handling: a close must
// free the seat immediately, a reload must stay silent so MSAB's 45s disconnect
// grace holds the seat for the rejoin.
// ============================================================

const store = new Map<string, string>()

vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v) },
  removeItem: (k: string) => { store.delete(k) },
})

beforeEach(() => {
  store.clear()
  vi.useRealTimers()
})

describe('reload intent', () => {
  it('is not set by default — a plain close still leaves eagerly', () => {
    expect(isReloadIntended()).toBe(false)
  })

  it('is detected immediately after being marked', () => {
    markReloadIntent()
    expect(isReloadIntended()).toBe(true)
  })

  it('expires, so a stale marker can never suppress a genuine leave', () => {
    markReloadIntent()
    // Advance past the 10s trust window.
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 11_000)

    expect(isReloadIntended()).toBe(false)
  })

  it('falls back to eager-leave when storage throws', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('unavailable') },
      setItem: () => { throw new Error('unavailable') },
    })

    expect(() => markReloadIntent()).not.toThrow()
    // Safe direction: a freed seat beats a stuck one.
    expect(isReloadIntended()).toBe(false)
  })
})
