// ========================================
// useLevelActions Composable Tests
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
  createMockBootstrapStore,
  createMockLevelsStore,
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

// Must import AFTER mocks are set up
let useLevelActions: () => ReturnType<typeof import('~/composables/shared/useLevelActions')['useLevelActions']>

describe('useLevelActions', () => {
  let bootstrapStore: ReturnType<typeof createMockBootstrapStore>
  let levelsStore: ReturnType<typeof createMockLevelsStore>

  beforeEach(async () => {
    bootstrapStore = createMockBootstrapStore()
    levelsStore = createMockLevelsStore()
    setupNuxtMocks({ bootstrapStore, levelsStore })

    // Dynamic import to pick up global mocks
    const mod = await import('~/composables/shared/useLevelActions')
    useLevelActions = mod.useLevelActions
  })

  afterEach(() => {
    cleanupNuxtMocks()
    vi.restoreAllMocks()
  })

  describe('updateWealthXp', () => {
    it('should recalculate wealth level from XP and write to store', () => {
      const { updateWealthXp } = useLevelActions()

      // XP = 150 should be level 2 (Silver, required_xp: 100)
      updateWealthXp(150)

      expect(levelsStore.setWealthLevel).toHaveBeenCalledTimes(1)
      const calledWith = (levelsStore.setWealthLevel as ReturnType<typeof vi.fn>).mock.calls[0]![0]
      expect(calledWith.current_level).toBe(2)
      expect(calledWith.level_name).toBe('Silver')
      expect(calledWith.current_xp).toBe(150)
    })

    it('should compute correct progress percentage', () => {
      const { updateWealthXp } = useLevelActions()

      // Level 2: requires 100, Level 3: requires 500
      // XP = 300 → 200/400 = 50% progress
      updateWealthXp(300)

      const calledWith = (levelsStore.setWealthLevel as ReturnType<typeof vi.fn>).mock.calls[0]![0]
      expect(calledWith.progress_percentage).toBe(50)
      expect(calledWith.xp_remaining).toBe(200)
    })

    it('should return max level badge when XP exceeds all levels', () => {
      const { updateWealthXp } = useLevelActions()

      // XP = 9999 should be level 3 (Gold, required_xp: 500)
      updateWealthXp(9999)

      const calledWith = (levelsStore.setWealthLevel as ReturnType<typeof vi.fn>).mock.calls[0]![0]
      expect(calledWith.current_level).toBe(3)
      expect(calledWith.level_name).toBe('Gold')
      expect(calledWith.progress_percentage).toBe(100)
      expect(bootstrapStore.getBadgeById).toHaveBeenCalledWith(103)
    })

    it('should handle zero XP (level 1)', () => {
      const { updateWealthXp } = useLevelActions()

      updateWealthXp(0)

      const calledWith = (levelsStore.setWealthLevel as ReturnType<typeof vi.fn>).mock.calls[0]![0]
      expect(calledWith.current_level).toBe(1)
      expect(calledWith.level_name).toBe('Bronze')
    })

    it('should not call store when wealthLevel is null', () => {
      ;(levelsStore as Record<string, unknown>).wealthLevel = null
      const { updateWealthXp } = useLevelActions()

      updateWealthXp(100)

      expect(levelsStore.setWealthLevel).not.toHaveBeenCalled()
    })

    it('should not call store when config is empty', () => {
      bootstrapStore.config = { wealth_levels: [], charm_levels: [] }
      const { updateWealthXp } = useLevelActions()

      updateWealthXp(100)

      expect(levelsStore.setWealthLevel).not.toHaveBeenCalled()
    })

    it('should lookup badge via bootstrapStore.getBadgeById', () => {
      const { updateWealthXp } = useLevelActions()

      updateWealthXp(150) // Level 2, badge_id: 102

      expect(bootstrapStore.getBadgeById).toHaveBeenCalledWith(102)
      const calledWith = (levelsStore.setWealthLevel as ReturnType<typeof vi.fn>).mock.calls[0]![0]
      expect(calledWith.badge).toEqual({
        id: 102,
        name: 'Badge 102',
        image_url: 'https://example.com/badge_102.webp',
      })
    })
  })

  describe('updateCharmXp', () => {
    it('should recalculate charm level from XP', () => {
      const { updateCharmXp } = useLevelActions()

      // XP = 500 should be level 2 (Super Star, required_xp: 200)
      updateCharmXp(500)

      expect(levelsStore.setCharmLevel).toHaveBeenCalledTimes(1)
      const calledWith = (levelsStore.setCharmLevel as ReturnType<typeof vi.fn>).mock.calls[0]![0]
      expect(calledWith.current_level).toBe(2)
      expect(calledWith.level_name).toBe('Super Star')
      expect(calledWith.current_xp).toBe(500)
    })
  })

  describe('handleLevelUp', () => {
    it('should route wealth level.up payload and recalculate from XP', () => {
      const { handleLevelUp } = useLevelActions()

      handleLevelUp({ type: 'wealth', previous_level: 1, new_level: 2, current_xp: '600' })

      expect(levelsStore.setWealthLevel).toHaveBeenCalledTimes(1)
      const calledWith = (levelsStore.setWealthLevel as ReturnType<typeof vi.fn>).mock.calls[0]![0]
      expect(calledWith.current_xp).toBe(600)
      expect(calledWith.current_level).toBe(3) // level 3 starts at 500
    })

    it('should route charm level.up payload and recalculate from XP', () => {
      const { handleLevelUp } = useLevelActions()

      handleLevelUp({ type: 'charm', previous_level: 0, new_level: 1, current_xp: '300' })

      expect(levelsStore.setCharmLevel).toHaveBeenCalledTimes(1)
      const calledWith = (levelsStore.setCharmLevel as ReturnType<typeof vi.fn>).mock.calls[0]![0]
      expect(calledWith.current_xp).toBe(300)
    })

    it('should not update when store level is null', () => {
      ;(levelsStore as Record<string, unknown>).wealthLevel = null
      const { handleLevelUp } = useLevelActions()

      handleLevelUp({ type: 'wealth', previous_level: 0, new_level: 1, current_xp: '100' })

      expect(levelsStore.setWealthLevel).not.toHaveBeenCalled()
    })
  })
})
