// ========================================
// useLevelLookup Composable Tests
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
  createMockBootstrapStore,
} from '../helpers/nuxtMocks'
import { DEFAULT_WEALTH_BADGE, DEFAULT_CHARM_BADGE } from '~/composables/shared/useLevelLookup'

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
let useLevelLookup: () => ReturnType<typeof import('~/composables/shared/useLevelLookup')['useLevelLookup']>

describe('useLevelLookup', () => {
  let bootstrapStore: ReturnType<typeof createMockBootstrapStore>

  beforeEach(async () => {
    bootstrapStore = createMockBootstrapStore({
      sortedWealthLevels: [
        { level: 1, name: 'Bronze', required_xp: 0, image_url: 'https://example.com/bronze.webp' },
        { level: 2, name: 'Silver', required_xp: 100, image_url: 'https://example.com/silver.webp' },
        { level: 3, name: 'Gold', required_xp: 500, image_url: 'https://example.com/gold.webp' },
      ],
      sortedCharmLevels: [
        { level: 1, name: 'Star', required_xp: 0, image_url: 'https://example.com/star.webp' },
        { level: 2, name: 'Super Star', required_xp: 200, image_url: 'https://example.com/superstar.webp' },
        { level: 3, name: 'Legend', required_xp: 1000, image_url: 'https://example.com/legend.webp' },
      ],
    })
    setupNuxtMocks({ bootstrapStore })

    const mod = await import('~/composables/shared/useLevelLookup')
    useLevelLookup = mod.useLevelLookup
  })

  afterEach(() => {
    cleanupNuxtMocks()
    vi.restoreAllMocks()
  })

  // ========================================
  // getLevelFromXp
  // ========================================

  describe('getLevelFromXp', () => {
    it('should return level 1 for 0 XP', () => {
      const { getLevelFromXp } = useLevelLookup()
      const result = getLevelFromXp(0, 'wealth')
      expect(result.level).toBe(1)
      expect(result.name).toBe('Bronze')
    })

    it('should return correct level for mid-range XP', () => {
      const { getLevelFromXp } = useLevelLookup()
      const result = getLevelFromXp(250, 'wealth')
      expect(result.level).toBe(2)
      expect(result.name).toBe('Silver')
    })

    it('should return highest level when XP exceeds all thresholds', () => {
      const { getLevelFromXp } = useLevelLookup()
      const result = getLevelFromXp(9999, 'wealth')
      expect(result.level).toBe(3)
      expect(result.name).toBe('Gold')
    })

    it('should handle string XP values', () => {
      const { getLevelFromXp } = useLevelLookup()
      const result = getLevelFromXp('300', 'charm')
      expect(result.level).toBe(2)
      expect(result.name).toBe('Super Star')
    })

    it('should return level 0 when bootstrap is not ready', () => {
      // Source guards on bootstrapStore.isReady (config absent ⇒ not ready)
      bootstrapStore.config = null
      bootstrapStore.isReady = false
      const { getLevelFromXp } = useLevelLookup()
      const result = getLevelFromXp(100, 'wealth')
      expect(result.level).toBe(0)
      expect(result.name).toBe('Unknown')
      expect(result.badge).toBeNull()
    })

    it('should return beginner for null XP', () => {
      const { getLevelFromXp } = useLevelLookup()
      const result = getLevelFromXp(null, 'wealth')
      expect(result.level).toBe(1)
      expect(result.name).toBe('Bronze')
    })

    it('should return badge info when level has an image', () => {
      const { getLevelFromXp } = useLevelLookup()
      const result = getLevelFromXp(150, 'wealth')
      expect(result.badge).toEqual({
        image_url: 'https://example.com/silver.webp',
      })
    })

    it('should work for charm category', () => {
      const { getLevelFromXp } = useLevelLookup()
      const result = getLevelFromXp(500, 'charm')
      expect(result.level).toBe(2)
      expect(result.name).toBe('Super Star')
    })
  })

  // ========================================
  // getBadgeFromXp
  // ========================================

  describe('getBadgeFromXp', () => {
    it('should return badge image URL for valid XP', () => {
      const { getBadgeFromXp } = useLevelLookup()
      const result = getBadgeFromXp(150, 'wealth')
      expect(result).toBe('https://example.com/silver.webp')
    })

    it('should return default wealth fallback when no badge found', () => {
      bootstrapStore.sortedWealthLevels = [
        { level: 1, name: 'Bronze', required_xp: 0, image_url: null },
      ]
      const { getBadgeFromXp } = useLevelLookup()
      const result = getBadgeFromXp(0, 'wealth')
      expect(result).toBe(DEFAULT_WEALTH_BADGE)
    })

    it('should return default charm fallback when no badge found', () => {
      bootstrapStore.sortedCharmLevels = [
        { level: 1, name: 'Star', required_xp: 0, image_url: null },
      ]
      const { getBadgeFromXp } = useLevelLookup()
      const result = getBadgeFromXp(0, 'charm')
      expect(result).toBe(DEFAULT_CHARM_BADGE)
    })

    it('should use custom fallback when provided', () => {
      bootstrapStore.sortedWealthLevels = [
        { level: 1, name: 'Bronze', required_xp: 0, image_url: null },
      ]
      const { getBadgeFromXp } = useLevelLookup()
      const result = getBadgeFromXp(0, 'wealth', 'https://custom-fallback.webp')
      expect(result).toBe('https://custom-fallback.webp')
    })
  })
})
