import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref, watch, readonly } from 'vue'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

const visibility = ref<'visible' | 'hidden'>('visible')
vi.mock('@vueuse/core', async importOriginal => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useDocumentVisibility: () => visibility,
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
function allTimePair(rank: number) {
  return {
    pair_id: 500 + rank, binder: user(rank), partner: user(rank + 100), bound_at: '', days: 1,
    lifetime_intimacy: 1000 - rank, weekly_score: 0, lifetime_rank: rank, weekly_rank: null,
  }
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
  visibility.value = 'visible'
  apiMock = vi.fn().mockResolvedValue({
    data: { week_key: '2026-W42', winners: [winner(1), winner(2, null)], all_time: [allTimePair(1), allTimePair(2)] },
  })
  const g = globalThis as Record<string, unknown>
  Object.assign(g, { ref, computed, watch, readonly })
  g.onMounted = (fn: () => void) => fn()
  g.onUnmounted = (fn: () => void) => { unmountFns.push(fn) }
  g.useBootstrapStore = () => ({ cpConfig: { poll_seconds: 30 } })
  vi.resetModules()
})

afterEach(() => {
  unmountFns.forEach(fn => fn())
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.resetModules()
  for (const key of ['useCpStore', 'ref', 'computed', 'watch', 'readonly', 'onMounted', 'onUnmounted', 'useBootstrapStore']) {
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

  it('exposes the all-time top 50 in server order', async () => {
    const { square } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(square.allTime.value.map(p => p.lifetime_rank)).toEqual([1, 2])
    expect(square.isAllTimeEmpty.value).toBe(false)
    expect(square.hasLoaded.value).toBe(true)
  })

  it('treats a response without all_time (older backend) as an empty list', async () => {
    apiMock.mockResolvedValue({ data: { week_key: '2026-W42', winners: [winner(1)] } })
    const { square } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(square.allTime.value).toEqual([])
    expect(square.isAllTimeEmpty.value).toBe(true)
    expect(square.isEmpty.value).toBe(false)
  })

  it('polls every poll_seconds so a broken pair leaves, and stops on unmount', async () => {
    const { square } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    apiMock.mockResolvedValue({ data: { week_key: '2026-W42', winners: [winner(2)], all_time: [allTimePair(1)] } })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(calls()).toBe(2)
    expect(square.pairs.value.map(p => p.pair_id)).toEqual([2])
    expect(square.allTime.value).toHaveLength(1)
    unmountFns.forEach(fn => fn())
    await vi.advanceTimersByTimeAsync(120_000)
    expect(calls()).toBe(2)
  })

  it('skips poll ticks while the tab is hidden', async () => {
    await setup()
    await vi.advanceTimersByTimeAsync(0)
    visibility.value = 'hidden'
    await vi.advanceTimersByTimeAsync(90_000)
    expect(calls()).toBe(1)
    visibility.value = 'visible'
    await vi.advanceTimersByTimeAsync(30_000)
    expect(calls()).toBe(2)
  })

  it('keeps the last good data when a poll fails', async () => {
    const { square } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    apiMock.mockRejectedValue(new Error('down'))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(square.error.value).toContain('down')
    expect(square.allTime.value).toHaveLength(2)
    expect(square.hasLoaded.value).toBe(true)
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
    apiMock.mockResolvedValue({ data: { week_key: null, winners: [], all_time: [] } })
    const { square } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(square.isEmpty.value).toBe(true)
    expect(square.pairs.value).toEqual([])
    expect(square.isAllTimeEmpty.value).toBe(true)
  })

  it('surfaces an error and is not empty', async () => {
    apiMock.mockRejectedValue(new Error('boom'))
    const { square } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(square.error.value).toContain('boom')
    expect(square.isEmpty.value).toBe(false)
    expect(square.isAllTimeEmpty.value).toBe(false)
    expect(square.hasLoaded.value).toBe(false)
  })
})
