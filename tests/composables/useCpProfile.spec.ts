import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref, readonly, toValue, watch, nextTick } from 'vue'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

let apiMock = vi.fn()
let normalized: { status?: number; message: string } = { message: 'x' }
vi.mock('~/composables/shared/useApi', () => ({
  useApi: () => ({ api: (...a: unknown[]) => apiMock(...a), normalizeError: () => normalized }),
}))

const user = { id: 1, name: 'n', signature: 'abc', avatar: null, vip_level: 0, gender: null, frame_id: null }
const profileData = { user, top_pair: null, pairs: [] }

beforeEach(async () => {
  setActivePinia(createPinia())
  apiMock = vi.fn().mockResolvedValue({ data: profileData })
  normalized = { message: 'x' }
  const { useCpStore } = await import('~/stores/cp')
  const g = globalThis as Record<string, unknown>
  g.ref = ref
  g.computed = computed
  g.readonly = readonly
  g.toValue = toValue
  g.watch = watch
  g.onScopeDispose = () => {}
  g.useCpStore = useCpStore
  vi.resetModules()
})

afterEach(() => {
  for (const key of ['ref', 'computed', 'readonly', 'toValue', 'watch', 'onScopeDispose', 'useCpStore']) Reflect.deleteProperty(globalThis, key)
})

async function make(sig: string | { value: string } = 'abc', visible?: { value: boolean }) {
  const { useCpStore } = await import('~/stores/cp')
  ;(globalThis as Record<string, unknown>).useCpStore = useCpStore
  const mod = await import('~/composables/cp/useCpProfile')
  return mod.useCpProfile(sig as never, visible as never)
}

describe('useCpProfile', () => {
  it('loads a profile into ready state', async () => {
    const p = await make()
    await p.refetch()
    expect(apiMock).toHaveBeenCalledWith('/cp/profile/abc')
    expect(p.status.value).toBe('ready')
    expect(p.profile.value).toEqual(profileData)
  })

  it('403 → blocked', async () => {
    normalized = { status: 403, message: 'no' }
    apiMock.mockRejectedValue(new Error('403'))
    const p = await make()
    await p.refetch()
    expect(p.status.value).toBe('blocked')
  })

  it('404 → not_found', async () => {
    normalized = { status: 404, message: 'no' }
    apiMock.mockRejectedValue(new Error('404'))
    const p = await make()
    await p.refetch()
    expect(p.status.value).toBe('not_found')
  })

  it('other failure → error, but a failed refetch keeps data on screen', async () => {
    normalized = { status: 500, message: 'down' }
    apiMock.mockRejectedValueOnce(new Error('500'))
    const p = await make()
    await vi.waitFor(() => expect(p.status.value).toBe('error'))

    apiMock.mockResolvedValueOnce({ data: profileData })
    await p.refetch()
    expect(p.status.value).toBe('ready')
    apiMock.mockRejectedValueOnce(new Error('500'))
    await p.refetch()
    expect(p.status.value).toBe('ready')
    expect(p.profile.value).not.toBeNull()
  })
})

describe('useCpProfile ordering and lazy trigger', () => {
  it('an older response never overwrites a newer one', async () => {
    const p = await make()
    let resolveOld: (v: unknown) => void = () => {}
    apiMock.mockImplementationOnce(() => new Promise((r) => { resolveOld = r }))
    const old = p.refetch()
    apiMock.mockResolvedValueOnce({ data: { ...profileData, pairs: [{ id: 'new' }] } })
    await p.refetch()
    resolveOld({ data: { ...profileData, pairs: [{ id: 'old' }] } })
    await old
    expect(p.profile.value).toEqual({ ...profileData, pairs: [{ id: 'new' }] })
  })

  it('fetches immediately when visible is omitted, and again on every signature change', async () => {
    const { ref: r } = await import('vue')
    const sig = r('abc')
    const p = await make(sig)
    await nextTick()
    expect(apiMock).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(p.status.value).toBe('ready'))
    apiMock.mockImplementationOnce(() => new Promise(() => {}))
    sig.value = 'xyz'
    await nextTick()
    expect(apiMock).toHaveBeenLastCalledWith('/cp/profile/xyz')
    expect(p.status.value).toBe('loading')
  })

  it('fetches only once visible, and refetches when the signature changes', async () => {
    const { ref: r } = await import('vue')
    const sig = r('abc')
    const visible = r(false)
    const p = await make(sig, visible)
    await nextTick()
    expect(apiMock).not.toHaveBeenCalled()
    expect(p.status.value).toBe('idle')
    visible.value = true
    await nextTick()
    expect(apiMock).toHaveBeenCalledTimes(1)
    await nextTick()
    visible.value = false
    visible.value = true
    await nextTick()
    expect(apiMock).toHaveBeenCalledTimes(1)
    sig.value = 'xyz'
    await nextTick()
    expect(apiMock).toHaveBeenLastCalledWith('/cp/profile/xyz')
    expect(apiMock).toHaveBeenCalledTimes(2)
  })
})

describe('useCpProfile realtime signal', () => {
  it('a signal never fetches while hidden or before the first fetch', async () => {
    vi.useFakeTimers()
    try {
      const { ref: r } = await import('vue')
      const { useCpStore } = await import('~/stores/cp')
      const visible = r(false)
      await make('abc', visible)
      const store = useCpStore()
      store.bumpPairSignal(false); await nextTick()
      await vi.advanceTimersByTimeAsync(1_001)
      expect(apiMock).not.toHaveBeenCalled()
      // Visible → first fetch; a later signal then refetches.
      visible.value = true
      await nextTick()
      expect(apiMock).toHaveBeenCalledTimes(1)
      store.bumpPairSignal(false); await nextTick()
      await vi.advanceTimersByTimeAsync(1_001)
      expect(apiMock).toHaveBeenCalledTimes(2)
      // Hidden again → signals are ignored.
      visible.value = false
      store.bumpPairSignal(false); await nextTick()
      await vi.advanceTimersByTimeAsync(1_001)
      expect(apiMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('N pair signals inside the debounce window = one refetch', async () => {
    vi.useFakeTimers()
    try {
      const { useCpStore } = await import('~/stores/cp')
      const p = await make()
      const store = useCpStore()
      await vi.advanceTimersByTimeAsync(0)
      expect(apiMock).toHaveBeenCalledTimes(1) // initial fetch
      store.bumpPairSignal(false); await nextTick()
      store.bumpPairSignal(true); await nextTick()
      store.bumpPairSignal(false); await nextTick()
      await vi.advanceTimersByTimeAsync(1_001)
      expect(apiMock).toHaveBeenCalledTimes(2)
      expect(p.status.value).toBe('ready')
    } finally {
      vi.useRealTimers()
    }
  })
})
