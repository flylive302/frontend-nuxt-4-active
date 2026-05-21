import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

const mockToast = { add: vi.fn() }
vi.stubGlobal('useToast', () => mockToast)

const mockUserStore = { patchBalance: vi.fn() }
vi.stubGlobal('useUserStore', () => mockUserStore)

const mockApi = vi.fn(async (path: string) => {
  if (path.includes('/claim')) {
    return {
      success: true,
      message: 'ok',
      data: { reward: { id: 1 } },
    }
  }

  return { success: true, data: {} }
})

vi.stubGlobal('useApi', () => ({
  api: mockApi,
  normalizeError: () => ({ message: 'error' }),
}))

describe('rewards actions', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    const { useRewardsStore } = await import('../../app/stores/rewards')
    vi.stubGlobal('useRewardsStore', useRewardsStore)
  })

  it('claimAll processes claims sequentially', async () => {
    const { useRewardsStore } = await import('../../app/stores/rewards')
    const { useRewardsActions } = await import('../../app/composables/progression/useRewardsActions')
    const store = useRewardsStore()
    const { claimAll } = useRewardsActions()

    type RewardItem = (typeof store.pending.items)[number]
    store.pending.items = [
      { id: 101 } as unknown as RewardItem,
      { id: 102 } as unknown as RewardItem,
      { id: 103 } as unknown as RewardItem,
    ]

    const claimed = await claimAll()

    expect(claimed).toBe(3)
    expect(mockApi).toHaveBeenCalledWith('/user/rewards/101/claim', { method: 'POST' })
    expect(mockApi).toHaveBeenCalledWith('/user/rewards/102/claim', { method: 'POST' })
    expect(mockApi).toHaveBeenCalledWith('/user/rewards/103/claim', { method: 'POST' })
  })
})
