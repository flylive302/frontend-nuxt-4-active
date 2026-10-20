import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref, watch, readonly } from 'vue'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

let apiMock = vi.fn()
vi.mock('~/composables/shared/useApi', () => ({
  useApi: () => ({
    api: (...args: unknown[]) => apiMock(...args),
    normalizeError: (e: unknown) => ({ message: String(e) }),
  }),
}))

let unmountFns: Array<() => void> = []
const WEEK = { week_key: '2026-W43', closes_at: '2026-10-26T00:00:00Z', server_time: '2026-10-20T00:00:00Z' }

function winner(rank: number) {
  return { week_key: '2026-W42', rank: 1, pair_id: rank, binder: null, partner: null, weekly_score: 1 }
}

async function setup() {
  const { useCpStore } = await import('~/stores/cp')
  ;(globalThis as Record<string, unknown>).useCpStore = useCpStore
  const store = useCpStore()
  const mod = await import('~/composables/cp/useCpHero')
  return { hero: mod.useCpHero(), store }
}

const calls = (url: string) => apiMock.mock.calls.filter(c => c[0] === url).length

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  unmountFns = []
  apiMock = vi.fn().mockImplementation((url: string) => {
    if (url === '/cp/history') return Promise.resolve({ data: { winners: [winner(1), winner(2)] } })
    if (url === '/cp/me') return Promise.resolve({ data: { pair: null, week: WEEK } })
    return Promise.reject(new Error('unexpected ' + url))
  })
  const g = globalThis as Record<string, unknown>
  Object.assign(g, { ref, computed, watch, readonly })
  g.onMounted = (fn: () => void) => fn()
  g.onUnmounted = (fn: () => void) => { unmountFns.push(fn) }
  vi.resetModules()
})

afterEach(() => {
  unmountFns.forEach(fn => fn())
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.resetModules()
  for (const key of ['useCpStore', 'ref', 'computed', 'watch', 'readonly', 'onMounted', 'onUnmounted']) {
    Reflect.deleteProperty(globalThis, key)
  }
})

describe('useCpHero', () => {
  it('fetches history on mount', async () => {
    const { hero } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls('/cp/history')).toBe(1)
    expect(hero.winners.value).toHaveLength(2)
  })

  it('fills the week via cp/me when the store has none', async () => {
    const { store } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls('/cp/me')).toBe(1)
    expect(store.week?.week_key).toBe('2026-W43')
  })

  it('skips cp/me when the week is already known', async () => {
    const { useCpStore } = await import('~/stores/cp')
    setActivePinia(createPinia())
    useCpStore().setWeek(WEEK)
    await setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls('/cp/me')).toBe(0)
  })

  it('refetches history once, debounced, on weekClosedSignal', async () => {
    const { store } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    store.weekClosedSignal++
    store.weekClosedSignal++
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls('/cp/history')).toBe(2)
  })

  it('keeps the previous winners when a refetch fails', async () => {
    const { hero, store } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    apiMock.mockRejectedValue(new Error('x'))
    store.weekClosedSignal++
    await vi.advanceTimersByTimeAsync(1000)
    expect(hero.winners.value).toHaveLength(2)
  })
})
