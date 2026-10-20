import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, readonly } from 'vue'
import { useCpRewards } from '~/composables/cp/useCpRewards'

const apiMock = vi.fn()

vi.mock('~/composables/shared/useApi', () => ({
  useApi: () => ({
    api: apiMock,
    normalizeError: (e: unknown) => ({ message: (e as Error).message }),
  }),
}))

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.stubGlobal('ref', ref)
vi.stubGlobal('readonly', readonly)

const payload = {
  ranks: [
    { rank: 1, rewards: [] },
    { rank: 2, rewards: [] },
    { rank: 3, rewards: [] },
  ],
}

describe('useCpRewards', () => {
  beforeEach(() => {
    apiMock.mockReset()
  })

  it('fetches cp/rewards and stores the data', async () => {
    apiMock.mockResolvedValue({ data: payload })
    const r = useCpRewards()

    await r.fetchRewards()

    expect(apiMock).toHaveBeenCalledWith('/cp/rewards')
    expect(r.data.value).toEqual(payload)
    expect(r.error.value).toBeNull()
    expect(r.isLoading.value).toBe(false)
  })

  it('records the error and keeps data null on failure', async () => {
    apiMock.mockRejectedValue(new Error('boom'))
    const r = useCpRewards()

    await r.fetchRewards()

    expect(r.error.value).toBe('boom')
    expect(r.data.value).toBeNull()
    expect(r.isLoading.value).toBe(false)
  })

  it('ignores a second fetch while one is in flight', async () => {
    let resolve!: (v: unknown) => void
    apiMock.mockReturnValue(new Promise((res) => { resolve = res }))
    const r = useCpRewards()

    const first = r.fetchRewards()
    await r.fetchRewards()
    resolve({ data: payload })
    await first

    expect(apiMock).toHaveBeenCalledTimes(1)
  })
})
