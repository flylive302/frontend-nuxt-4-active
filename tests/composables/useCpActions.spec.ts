import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

let apiMock = vi.fn()
let normalized: { status?: number; message: string } = { message: 'boom' }
vi.mock('~/composables/shared/useApi', () => ({
  useApi: () => ({ api: (...a: unknown[]) => apiMock(...a), normalizeError: () => normalized }),
}))

const toast = { add: vi.fn() }
const store = { resetEvent: vi.fn() }

beforeEach(() => {
  apiMock = vi.fn().mockResolvedValue({})
  normalized = { message: 'boom' }
  toast.add.mockClear()
  store.resetEvent.mockClear()
  const g = globalThis as Record<string, unknown>
  g.ref = ref
  g.computed = computed
  g.useToast = () => toast
  g.useCpStore = () => store
  vi.resetModules()
})

afterEach(() => {
  for (const key of ['ref', 'computed', 'useToast', 'useCpStore']) Reflect.deleteProperty(globalThis, key)
})

async function make() {
  const mod = await import('~/composables/cp/useCpActions')
  return mod.useCpActions()
}

describe('useCpActions.breakPair', () => {
  it('POSTs the break, toasts, and refetches after success', async () => {
    const { breakPair } = await make()
    const onSettled = vi.fn()
    const ok = await breakPair(7, { onSettled })
    expect(apiMock).toHaveBeenCalledWith('/cp/pairs/7/break', { method: 'POST' })
    expect(ok).toBe(true)
    expect(toast.add).toHaveBeenCalledTimes(1)
    expect(onSettled).toHaveBeenCalledTimes(1)
  })

  it('does not touch local data before the server answers (no optimistic removal)', async () => {
    let resolve!: () => void
    apiMock.mockReturnValue(new Promise<void>((r) => { resolve = r }))
    const { breakPair } = await make()
    const onSettled = vi.fn()
    const pending = breakPair(7, { onSettled })
    expect(onSettled).not.toHaveBeenCalled()
    expect(store.resetEvent).not.toHaveBeenCalled()
    resolve()
    await pending
    expect(onSettled).toHaveBeenCalledTimes(1)
  })

  it('treats 409 as already broken: refetches, no error toast', async () => {
    normalized = { status: 409, message: 'conflict' }
    apiMock.mockRejectedValue(new Error('409'))
    const { breakPair } = await make()
    const onSettled = vi.fn()
    expect(await breakPair(7, { onSettled })).toBe(true)
    expect(onSettled).toHaveBeenCalledTimes(1)
    expect(toast.add).not.toHaveBeenCalled()
  })

  it('treats 403 (pair no longer active) as already broken: refetches, no error toast', async () => {
    normalized = { status: 403, message: 'forbidden' }
    apiMock.mockRejectedValue(new Error('403'))
    const { breakPair } = await make()
    const onSettled = vi.fn()
    expect(await breakPair(7, { onSettled })).toBe(true)
    expect(onSettled).toHaveBeenCalledTimes(1)
    expect(toast.add).not.toHaveBeenCalled()
  })

  it('other failures toast an error and do not refetch', async () => {
    normalized = { status: 500, message: 'server' }
    apiMock.mockRejectedValue(new Error('500'))
    const { breakPair } = await make()
    const onSettled = vi.fn()
    expect(await breakPair(7, { onSettled })).toBe(false)
    expect(onSettled).not.toHaveBeenCalled()
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
  })

  it('ignores a second tap while one break is in flight', async () => {
    let resolve!: () => void
    apiMock.mockReturnValue(new Promise<void>((r) => { resolve = r }))
    const { breakPair, isBreaking } = await make()
    const first = breakPair(7)
    expect(isBreaking.value).toBe(true)
    expect(await breakPair(7)).toBe(false)
    expect(apiMock).toHaveBeenCalledTimes(1)
    resolve()
    await first
    expect(isBreaking.value).toBe(false)
  })
})
