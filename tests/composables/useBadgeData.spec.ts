// ========================================
// useBadgeData Composable Tests
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
  createMockApi,
} from '../helpers/nuxtMocks'

// Mock logger
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

// Mock badges store
function createMockBadgesStore(overrides: Record<string, unknown> = {}) {
  return {
    catalog: { items: [], loading: false, error: null, hasMore: true },
    userBadges: { items: [], loading: false, error: null, hasMore: true },
    categories: [],
    stats: null,
    currentCategory: null,
    setCatalog: vi.fn(),
    setCatalogLoading: vi.fn(),
    setCatalogError: vi.fn(),
    resetCatalog: vi.fn(),
    setUserBadges: vi.fn(),
    setUserBadgesLoading: vi.fn(),
    setUserBadgesError: vi.fn(),
    resetUserBadges: vi.fn(),
    setCategories: vi.fn(),
    setStats: vi.fn(),
    setCurrentCategory: vi.fn(),
    setLastFetchedAt: vi.fn(),
    ...overrides,
  }
}

let useBadgeData: () => ReturnType<typeof import('~/composables/progression/useBadgeData')['useBadgeData']>

describe('useBadgeData', () => {
  let mockApi: ReturnType<typeof createMockApi>
  let badgesStore: ReturnType<typeof createMockBadgesStore>

  beforeEach(async () => {
    mockApi = createMockApi()
    badgesStore = createMockBadgesStore()

    setupNuxtMocks({ api: mockApi })
    ;(globalThis as Record<string, unknown>).useBadgesStore = () => badgesStore

    const mod = await import('~/composables/progression/useBadgeData')
    useBadgeData = mod.useBadgeData
  })

  afterEach(() => {
    cleanupNuxtMocks()
    Reflect.deleteProperty(globalThis, 'useBadgesStore')
    vi.restoreAllMocks()
  })

  // ========================================
  // fetchCatalog
  // ========================================

  describe('fetchCatalog', () => {
    it('should call API and write to store', async () => {
      const mockBadges = [{ id: 1, name: 'Test Badge' }]
      mockApi.api.mockResolvedValueOnce({ data: mockBadges })

      const { fetchCatalog } = useBadgeData()
      await fetchCatalog()

      expect(mockApi.api).toHaveBeenCalledWith('/badges', { params: {} })
      expect(badgesStore.setCatalogLoading).toHaveBeenCalledWith(true)
      expect(badgesStore.setCatalog).toHaveBeenCalledWith(mockBadges)
      expect(badgesStore.setCatalogLoading).toHaveBeenCalledWith(false)
    })

    it('should pass category param when provided', async () => {
      mockApi.api.mockResolvedValueOnce({ data: [] })

      const { fetchCatalog } = useBadgeData()
      await fetchCatalog({ category: 'wealth' })

      expect(mockApi.api).toHaveBeenCalledWith('/badges', {
        params: { category: 'wealth' },
      })
    })

    it('should skip when already loading', async () => {
      badgesStore.catalog.loading = true

      const { fetchCatalog } = useBadgeData()
      await fetchCatalog()

      expect(mockApi.api).not.toHaveBeenCalled()
    })

    it('should skip when no more data', async () => {
      badgesStore.catalog.hasMore = false

      const { fetchCatalog } = useBadgeData()
      await fetchCatalog()

      expect(mockApi.api).not.toHaveBeenCalled()
    })

    it('should reset catalog before fetching when reset=true', async () => {
      badgesStore.catalog.hasMore = false
      mockApi.api.mockResolvedValueOnce({ data: [] })

      const { fetchCatalog } = useBadgeData()
      await fetchCatalog({}, true)

      expect(badgesStore.resetCatalog).toHaveBeenCalled()
    })

    it('should handle API errors gracefully', async () => {
      mockApi.api.mockRejectedValueOnce(new Error('Network fail'))

      const { fetchCatalog } = useBadgeData()
      await fetchCatalog()

      expect(badgesStore.setCatalogError).toHaveBeenCalledWith('Network fail')
      expect(badgesStore.setCatalogLoading).toHaveBeenCalledWith(false)
    })
  })

  // ========================================
  // fetchUserBadges
  // ========================================

  describe('fetchUserBadges', () => {
    it('should call API and write to store', async () => {
      const mockUserBadges = [{ id: 1, badge_id: 10 }]
      mockApi.api.mockResolvedValueOnce({ data: mockUserBadges })

      const { fetchUserBadges } = useBadgeData()
      await fetchUserBadges()

      expect(mockApi.api).toHaveBeenCalledWith('/user/badges')
      expect(badgesStore.setUserBadges).toHaveBeenCalledWith(mockUserBadges)
    })

    it('should skip when already loading', async () => {
      badgesStore.userBadges.loading = true

      const { fetchUserBadges } = useBadgeData()
      await fetchUserBadges()

      expect(mockApi.api).not.toHaveBeenCalled()
    })
  })

  // ========================================
  // fetchStats
  // ========================================

  describe('fetchStats', () => {
    it('should call API and write to store', async () => {
      const mockStats = { total: 5, by_category: {} }
      mockApi.api.mockResolvedValueOnce({ data: mockStats })

      const { fetchStats } = useBadgeData()
      await fetchStats()

      expect(mockApi.api).toHaveBeenCalledWith('/user/badges/stats')
      expect(badgesStore.setStats).toHaveBeenCalledWith(mockStats)
    })
  })

  // ========================================
  // setCategory
  // ========================================

  describe('setCategory', () => {
    it('should update store category and re-fetch catalog', async () => {
      mockApi.api.mockResolvedValueOnce({ data: [] })

      const { setCategory } = useBadgeData()
      await setCategory('charm')

      expect(badgesStore.setCurrentCategory).toHaveBeenCalledWith('charm')
      expect(badgesStore.resetCatalog).toHaveBeenCalled()
    })

    it('should clear category when null', async () => {
      mockApi.api.mockResolvedValueOnce({ data: [] })

      const { setCategory } = useBadgeData()
      await setCategory(null)

      expect(badgesStore.setCurrentCategory).toHaveBeenCalledWith(null)
    })
  })
})
