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

function user(id: number) {
  return { id, name: 'n', signature: 's', avatar: null, vip_level: 0, gender: null, frame_id: null }
}
function winner(rank: number, binder: unknown = user(rank)) {
  return { week_key: '2026-W42', rank, pair_id: rank, binder, partner: user(rank + 100), weekly_score: 50 * rank }
}

async function setup() {
  const { useCpStore } = await import('~/stores/cp')
  ;(globalThis as Record<string, unknown>).useCpStore = useCpStore
  const mod = await import('~/composables/cp/useCpSquare')
  return { square: mod.useCpSquare(), store: useCpStore() }
}

const calls = () => apiMock.mock.calls.filter(c => c[0] === '/cp/square').length

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  unmountFns = []
  apiMock = vi.fn().mockResolvedValue({ data: { week_key: '2026-W42', winners: [winner(1), winner(2, null)] } })
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

describe('useCpSquare', () => {
  it('fetches on mount and adapts winners to pair cards', async () => {
    const { square } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls()).toBe(1)
    expect(square.weekKey.value).toBe('2026-W42')
    expect(square.pairs.value).toHaveLength(2)
    expect(square.pairs.value[1]!.binder.name).toBe('Deleted user')
    expect(square.pairs.value[0]!.weekly_score).toBe(50)
    expect(square.isEmpty.value).toBe(false)
  })

  it('refetches once, debounced, when weekClosedSignal bumps', async () => {
    const { store } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    store.weekClosedSignal++
    store.weekClosedSignal++
    await vi.advanceTimersByTimeAsync(0)
    expect(calls()).toBe(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls()).toBe(2)
  })

  it('reports empty before the first close', async () => {
    apiMock.mockResolvedValue({ data: { week_key: null, winners: [] } })
    const { square } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(square.isEmpty.value).toBe(true)
    expect(square.pairs.value).toEqual([])
  })

  it('surfaces an error and is not empty', async () => {
    apiMock.mockRejectedValue(new Error('boom'))
    const { square } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(square.error.value).toContain('boom')
    expect(square.isEmpty.value).toBe(false)
  })
})
