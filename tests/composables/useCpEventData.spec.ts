import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref, watch, readonly, nextTick } from 'vue'

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

const WEEK_MS = 7 * 24 * 3600 * 1000

function user(id: number) {
  return { id, name: 'n', signature: 's', avatar: null, vip_level: 0, gender: null, frame_id: null }
}
function pair(id: number) {
  return {
    pair_id: id, binder: user(id), partner: user(id + 1000), bound_at: '', days: 1,
    lifetime_intimacy: 1, weekly_score: 1, lifetime_rank: null, weekly_rank: null,
  }
}
function week(key: string, closesInMs: number) {
  return {
    week_key: key,
    closes_at: new Date(Date.now() + closesInMs).toISOString(),
    server_time: new Date().toISOString(),
  }
}

let currentWeek = week('2026-W43', WEEK_MS)
let listPayload: { top: unknown[]; page: unknown[]; next_offset: number | null }
let unmountFns: Array<() => void> = []
let pollSeconds = 30

function listResponse() {
  return { data: { ...listPayload, week: currentWeek } }
}

async function setup() {
  const { useCpStore } = await import('~/stores/cp')
  ;(globalThis as Record<string, unknown>).useCpStore = useCpStore
  const mod = await import('~/composables/cp/useCpEventData')
  return { data: mod.useCpEventData(), store: useCpStore() }
}

function calls(prefix: string): number {
  return apiMock.mock.calls.filter(c => String(c[0]) === prefix).length
}

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  unmountFns = []
  visibility.value = 'visible'
  pollSeconds = 30
  currentWeek = week('2026-W43', WEEK_MS)
  listPayload = { top: [pair(1)], page: [pair(4)], next_offset: 1 }
  apiMock = vi.fn().mockImplementation((url: string) => {
    if (url === '/cp/list') return Promise.resolve(listResponse())
    if (url === '/cp/me') return Promise.resolve({ data: { pair: null, week: currentWeek } })
    if (url === '/cp/list/page') return Promise.resolve({ data: { page: [pair(5)], next_offset: null } })
    return Promise.reject(new Error('unexpected ' + url))
  })
  const g = globalThis as Record<string, unknown>
  g.ref = ref
  g.computed = computed
  g.watch = watch
  g.readonly = readonly
  g.onMounted = (fn: () => void) => fn()
  g.onUnmounted = (fn: () => void) => { unmountFns.push(fn) }
  g.useBootstrapStore = () => ({ cpConfig: { poll_seconds: pollSeconds } })
  vi.resetModules()
})

afterEach(() => {
  for (const fn of unmountFns) fn()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.resetModules()
  for (const key of ['useCpStore', 'ref', 'computed', 'watch', 'readonly', 'onMounted', 'onUnmounted', 'useBootstrapStore']) {
    Reflect.deleteProperty(globalThis, key)
  }
})

describe('useCpEventData', () => {
  it('fetches list + me on mount', async () => {
    const { store } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls('/cp/list')).toBe(1)
    expect(calls('/cp/me')).toBe(1)
    expect(store.podium).toHaveLength(1)
  })

  it('polls every poll_seconds and stops on unmount', async () => {
    await setup()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(calls('/cp/list')).toBe(2)
    unmountFns.forEach(fn => fn())
    await vi.advanceTimersByTimeAsync(120_000)
    expect(calls('/cp/list')).toBe(2)
  })

  it('skips poll ticks while the tab is hidden', async () => {
    await setup()
    await vi.advanceTimersByTimeAsync(0)
    visibility.value = 'hidden'
    await vi.advanceTimersByTimeAsync(90_000)
    expect(calls('/cp/list')).toBe(1)
    visibility.value = 'visible'
    await vi.advanceTimersByTimeAsync(30_000)
    expect(calls('/cp/list')).toBe(2)
  })

  it('a fetch requested during a flight runs once after it, N requests coalesce into one trailing fetch', async () => {
    const { data } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls('/cp/list')).toBe(1)
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => { release = r })
    const impl = apiMock.getMockImplementation()!
    apiMock.mockImplementation(async (url: string) => {
      if (url === '/cp/list') await gate
      return impl(url)
    })
    const first = data.refetch()
    const second = data.refetch()
    const third = data.refetch()
    expect(calls('/cp/list')).toBe(2)
    release()
    await Promise.all([first, second, third])
    expect(calls('/cp/list')).toBe(3)
    expect(calls('/cp/me')).toBe(3)
  })

  it('loadMore requests next_offset, appends, and stops when next_offset is null', async () => {
    const { data, store } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    await data.loadMore()
    expect(apiMock).toHaveBeenCalledWith('/cp/list/page', { query: { offset: 1 } })
    expect(store.rows.map(p => p.pair_id)).toEqual([4, 5])
    expect(store.nextOffset).toBeNull()
    await data.loadMore()
    expect(calls('/cp/list/page')).toBe(1)
  })

  it('loadMore never requests past the offset cap', async () => {
    listPayload = { top: [], page: [pair(4)], next_offset: 501 }
    const { data } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    await data.loadMore()
    expect(calls('/cp/list/page')).toBe(0)
  })

  it('a failed loadMore sets loadMoreError (not error), pauses infinite scroll, and retries via loadMore', async () => {
    const { data, store } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    const impl = apiMock.getMockImplementation()!
    apiMock.mockImplementation((url: string) => (url === '/cp/list/page' ? Promise.reject(new Error('down')) : impl(url)))
    await data.loadMore()
    expect(data.loadMoreError.value).toContain('down')
    expect(data.error.value).toBeNull()
    expect(data.canLoadMore.value).toBe(false)
    expect(store.rows.map(p => p.pair_id)).toEqual([4])

    apiMock.mockImplementation(impl)
    await data.loadMore()
    expect(data.loadMoreError.value).toBeNull()
    expect(store.rows.map(p => p.pair_id)).toEqual([4, 5])
  })

  it('a burst of signals debounces into one refetch', async () => {
    const { store } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    store.bumpPairSignal(false); await nextTick()
    store.bumpPairSignal(false); await nextTick()
    store.bumpPairSignal(false); await nextTick()
    await vi.advanceTimersByTimeAsync(999)
    expect(calls('/cp/list')).toBe(1)
    await vi.advanceTimersByTimeAsync(2)
    expect(calls('/cp/list')).toBe(2)
  })
})

describe('realtime signals', () => {
  it('N pair signals inside the window = one refetch', async () => {
    const { store } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    store.bumpPairSignal(false); await nextTick()
    store.bumpPairSignal(false); await nextTick()
    store.bumpPairSignal(true); await nextTick()
    await vi.advanceTimersByTimeAsync(1_001)
    expect(calls('/cp/list')).toBe(2)
  })

  it('a week-closed signal refetches once and a new week_key is picked up', async () => {
    const { store } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    currentWeek = week('2026-W44', WEEK_MS)
    store.bumpWeekClosedSignal(); await nextTick()
    store.bumpPairSignal(false); await nextTick()
    await vi.advanceTimersByTimeAsync(1_001)
    expect(calls('/cp/list')).toBe(2)
    expect(store.weekKey).toBe('2026-W44')
  })

  it('no refetch after unmount', async () => {
    const { store } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    unmountFns.forEach(fn => fn())
    store.bumpPairSignal(false); await nextTick()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(calls('/cp/list')).toBe(1)
  })
})

describe('week roll (countdown zero)', () => {
  it('retries with jitter until week_key changes, then stops', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    currentWeek = week('2026-W43', 10_000)
    const { store } = await setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(store.weekKey).toBe('2026-W43')

    await vi.advanceTimersByTimeAsync(10_000) // countdown hits 0
    await vi.advanceTimersByTimeAsync(1_000) // retry 1 → same week
    expect(calls('/cp/list')).toBe(2)

    currentWeek = week('2026-W44', WEEK_MS)
    await vi.advanceTimersByTimeAsync(1_000) // retry 2 → new week
    expect(store.weekKey).toBe('2026-W44')
    const after = calls('/cp/list')
    await vi.advanceTimersByTimeAsync(5_000) // poll interval not reached; no more retries
    expect(calls('/cp/list')).toBe(after)
  })

  it('gives up after the max tries when the week never changes', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    currentWeek = week('2026-W43', 1_000)
    // Freeze the stale week even as responses arrive.
    const frozen = currentWeek
    apiMock.mockImplementation((url: string) => {
      if (url === '/cp/list') return Promise.resolve({ data: { ...listPayload, week: { ...frozen, server_time: new Date().toISOString() } } })
      return Promise.resolve({ data: { pair: null, week: frozen } })
    })
    await setup()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(1_000) // zero
    await vi.advanceTimersByTimeAsync(20_000) // < poll (30 s); only retries run
    expect(calls('/cp/list')).toBe(1 + 6)
  })
})
