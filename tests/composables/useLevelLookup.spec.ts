// ========================================
// useLevelLookup Composable Tests
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
  createMockBootstrapStore,
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
let useLevelLookup: () => ReturnType<typeof import('~/composables/shared/useLevelLookup')['useLevelLookup']>

describe('useLevelLookup', () => {
  let bootstrapStore: ReturnType<typeof createMockBootstrapStore>

  beforeEach(async () => {
    bootstrapStore = createMockBootstrapStore({
      sortedWealthLevels: [
        { level: 1, name: 'Bronze', required_xp: 0, badge_id: 101 },
        { level: 2, name: 'Silver', required_xp: 100, badge_id: 102 },
        { level: 3, name: 'Gold', required_xp: 500, badge_id: 103 },
      ],
      sortedCharmLevels: [
        { level: 1, name: 'Star', required_xp: 0, badge_id: 201 },
        { level: 2, name: 'Super Star', required_xp: 200, badge_id: 202 },
        { level: 3, name: 'Legend', required_xp: 1000, badge_id: 203 },
      ],
      badgeMap: new Map([
        [101, { id: 101, name: 'Bronze Badge', image_url: 'https://example.com/bronze.webp' }],
        [102, { id: 102, name: 'Silver Badge', image_url: 'https://example.com/silver.webp' }],
        [103, { id: 103, name: 'Gold Badge', image_url: 'https://example.com/gold.webp' }],
        [201, { id: 201, name: 'Star Badge', image_url: 'https://example.com/star.webp' }],
        [202, { id: 202, name: 'Super Star Badge', image_url: 'https://example.com/superstar.webp' }],
        [203, { id: 203, name: 'Legend Badge', image_url: 'https://example.com/legend.webp' }],
      ]),
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

    it('should return level 0 when config is missing', () => {
      bootstrapStore.config = null
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

    it('should return badge info when level has a badge', () => {
      const { getLevelFromXp } = useLevelLookup()
      const result = getLevelFromXp(150, 'wealth')
      expect(result.badge).toEqual({
        id: 102,
        name: 'Silver Badge',
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
        { level: 1, name: 'Bronze', required_xp: 0, badge_id: null },
      ]
      bootstrapStore.badgeMap = new Map()
      const { getBadgeFromXp } = useLevelLookup()
      const result = getBadgeFromXp(0, 'wealth')
      expect(result).toBe('https://assets.flyliveapp.com/badges/wealth/level_0.webp')
    })

    it('should return default charm fallback when no badge found', () => {
      bootstrapStore.sortedCharmLevels = [
        { level: 1, name: 'Star', required_xp: 0, badge_id: null },
      ]
      bootstrapStore.badgeMap = new Map()
      const { getBadgeFromXp } = useLevelLookup()
      const result = getBadgeFromXp(0, 'charm')
      expect(result).toBe('https://assets.flyliveapp.com/badges/charm/level_0.webp')
    })

    it('should use custom fallback when provided', () => {
      bootstrapStore.sortedWealthLevels = [
        { level: 1, name: 'Bronze', required_xp: 0, badge_id: null },
      ]
      bootstrapStore.badgeMap = new Map()
      const { getBadgeFromXp } = useLevelLookup()
      const result = getBadgeFromXp(0, 'wealth', 'https://custom-fallback.webp')
      expect(result).toBe('https://custom-fallback.webp')
    })
  })
})
