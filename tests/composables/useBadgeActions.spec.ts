// ========================================
// useBadgeActions Composable Tests
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
    isTogglingDisplay: null as number | null,
    userBadges: {
      items: [
        { id: 1, badge_id: 10, is_displayed: false, badge: { id: 10, name: 'Test Badge' } },
        { id: 2, badge_id: 20, is_displayed: true, badge: { id: 20, name: 'Other Badge' } },
      ],
    },
    stats: { total: 2, by_category: {} },
    setIsTogglingDisplay: vi.fn((id: number | null) => {
      badgesStore.isTogglingDisplay = id
    }),
    updateUserBadgeDisplay: vi.fn(),
    addUserBadge: vi.fn(),
    incrementStatsTotal: vi.fn(),
    ...overrides,
  }
}

// Mock toast
function createMockToast() {
  return {
    add: vi.fn(),
  }
}

let useBadgeActions: () => ReturnType<typeof import('~/composables/progression/useBadgeActions')['useBadgeActions']>
let badgesStore: ReturnType<typeof createMockBadgesStore>
let mockToast: ReturnType<typeof createMockToast>

describe('useBadgeActions', () => {
  let mockApi: ReturnType<typeof createMockApi>

  beforeEach(async () => {
    mockApi = createMockApi()
    badgesStore = createMockBadgesStore()
    mockToast = createMockToast()

    setupNuxtMocks({ api: mockApi })
    ;(globalThis as Record<string, unknown>).useBadgesStore = () => badgesStore
    ;(globalThis as Record<string, unknown>).useToast = () => mockToast

    const mod = await import('~/composables/progression/useBadgeActions')
    useBadgeActions = mod.useBadgeActions
  })

  afterEach(() => {
    cleanupNuxtMocks()
    Reflect.deleteProperty(globalThis, 'useBadgesStore')
    Reflect.deleteProperty(globalThis, 'useToast')
    vi.restoreAllMocks()
  })

  // ========================================
  // toggleDisplay
  // ========================================

  describe('toggleDisplay', () => {
    it('should call API and show success toast', async () => {
      mockApi.api.mockResolvedValueOnce({ success: true, data: {} })

      const { toggleDisplay } = useBadgeActions()
      const result = await toggleDisplay(1)

      expect(result).toBe(true)
      expect(mockApi.api).toHaveBeenCalledWith('/user/badges/1/toggle-display', { method: 'POST' })
      expect(badgesStore.updateUserBadgeDisplay).toHaveBeenCalledWith(1, true)
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'success' })
      )
    })

    it('should rollback on API error and show error toast', async () => {
      mockApi.api.mockRejectedValueOnce(new Error('Server error'))

      const { toggleDisplay } = useBadgeActions()
      const result = await toggleDisplay(1)

      expect(result).toBe(false)
      // First call: optimistic update, second call: rollback
      expect(badgesStore.updateUserBadgeDisplay).toHaveBeenCalledTimes(2)
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'error' })
      )
    })

    it('should block concurrent toggles', async () => {
      badgesStore.isTogglingDisplay = 99

      const { toggleDisplay } = useBadgeActions()
      const result = await toggleDisplay(1)

      expect(result).toBe(false)
      expect(mockApi.api).not.toHaveBeenCalled()
    })

    it('should return false for non-existent badge', async () => {
      const { toggleDisplay } = useBadgeActions()
      const result = await toggleDisplay(999)

      expect(result).toBe(false)
      expect(mockApi.api).not.toHaveBeenCalled()
    })

    it('should clear toggling state after completion', async () => {
      mockApi.api.mockResolvedValueOnce({ success: true, data: {} })

      const { toggleDisplay } = useBadgeActions()
      await toggleDisplay(1)

      expect(badgesStore.setIsTogglingDisplay).toHaveBeenLastCalledWith(null)
    })
  })

  // ========================================
  // onBadgeEarned
  // ========================================

  describe('onBadgeEarned', () => {
    it('should add badge to store and increment stats', () => {
      const newBadge = { id: 3, badge_id: 30, is_displayed: false, badge: { id: 30, name: 'New Badge' } }

      const { onBadgeEarned } = useBadgeActions()
      onBadgeEarned(newBadge as import('~/types/progression/badge').UserBadge)

      expect(badgesStore.addUserBadge).toHaveBeenCalledWith(newBadge)
      expect(badgesStore.incrementStatsTotal).toHaveBeenCalled()
    })

    it('should show success toast with badge name', () => {
      const newBadge = { id: 3, badge_id: 30, is_displayed: false, badge: { id: 30, name: 'Gold Star' } }

      const { onBadgeEarned } = useBadgeActions()
      onBadgeEarned(newBadge as import('~/types/progression/badge').UserBadge)

      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Badge Earned!',
          description: 'Gold Star',
          color: 'success',
        })
      )
    })
  })
})
