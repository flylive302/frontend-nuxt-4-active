// ========================================
// useLevelActions Composable Tests
// ========================================
// useLevelActions was simplified to only write XP onto the auth user;
// reactive consumers (computeLevelStatus / useLevelLookup) recompute level,
// badge and progress from that XP. The level-math coverage lives in
// useLevelLookup.spec.ts — these tests assert the reduced write contract.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
  createMockAuthStore,
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
  let authStore: ReturnType<typeof createMockAuthStore>

  beforeEach(async () => {
    authStore = createMockAuthStore({ user: { id: 1, name: 'Test User', wealth_xp: '0', charm_xp: '0' } })
    setupNuxtMocks({ authStore })

    const mod = await import('~/composables/shared/useLevelActions')
    useLevelActions = mod.useLevelActions
  })

  afterEach(() => {
    cleanupNuxtMocks()
    vi.restoreAllMocks()
  })

  const user = () => authStore.user as { wealth_xp: string; charm_xp: string }

  describe('updateWealthXp', () => {
    it('writes the wealth XP (stringified) onto the auth user', () => {
      const { updateWealthXp } = useLevelActions()

      updateWealthXp(150)

      expect(user().wealth_xp).toBe('150')
    })

    it('no-ops when there is no authenticated user', () => {
      ;(authStore as Record<string, unknown>).user = null
      const { updateWealthXp } = useLevelActions()

      expect(() => updateWealthXp(150)).not.toThrow()
    })
  })

  describe('updateCharmXp', () => {
    it('writes the charm XP (stringified) onto the auth user', () => {
      const { updateCharmXp } = useLevelActions()

      updateCharmXp(500)

      expect(user().charm_xp).toBe('500')
    })
  })

  describe('handleLevelUp', () => {
    it('routes a wealth level.up payload to wealth_xp', () => {
      const { handleLevelUp } = useLevelActions()

      handleLevelUp({ type: 'wealth', previous_level: 1, new_level: 2, current_xp: '600' })

      expect(user().wealth_xp).toBe('600')
    })

    it('routes a charm level.up payload to charm_xp', () => {
      const { handleLevelUp } = useLevelActions()

      handleLevelUp({ type: 'charm', previous_level: 0, new_level: 1, current_xp: '300' })

      expect(user().charm_xp).toBe('300')
    })
  })
})
