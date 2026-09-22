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
  createMockBalanceStore,
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
  let balanceStore: ReturnType<typeof createMockBalanceStore>

  beforeEach(async () => {
    authStore = createMockAuthStore({ user: { id: 1, name: 'Test User', wealth_xp: '0', charm_xp: '0' } })
    balanceStore = createMockBalanceStore()
    setupNuxtMocks({ authStore, balanceStore })

    const mod = await import('~/composables/shared/useLevelActions')
    useLevelActions = mod.useLevelActions
  })

  afterEach(() => {
    cleanupNuxtMocks()
    vi.restoreAllMocks()
  })

  describe('updateWealthXp', () => {
    it('patches the balance store with the stringified wealth XP', () => {
      const { updateWealthXp } = useLevelActions()

      updateWealthXp(150)

      expect(balanceStore.patch).toHaveBeenCalledWith({ wealth_xp: '150' })
    })

    it('no-ops when there is no authenticated user', () => {
      ;(authStore as Record<string, unknown>).user = null
      const { updateWealthXp } = useLevelActions()

      expect(() => updateWealthXp(150)).not.toThrow()
      expect(balanceStore.patch).not.toHaveBeenCalled()
    })
  })

  describe('updateCharmXp', () => {
    it('patches the balance store with the stringified charm XP', () => {
      const { updateCharmXp } = useLevelActions()

      updateCharmXp(500)

      expect(balanceStore.patch).toHaveBeenCalledWith({ charm_xp: '500' })
    })
  })

  describe('handleLevelUp', () => {
    it('routes a wealth level.up payload to wealth_xp', () => {
      const { handleLevelUp } = useLevelActions()

      handleLevelUp({ type: 'wealth', previous_level: 1, new_level: 2, current_xp: '600' })

      expect(balanceStore.patch).toHaveBeenCalledWith({ wealth_xp: '600' })
    })

    it('routes a charm level.up payload to charm_xp', () => {
      const { handleLevelUp } = useLevelActions()

      handleLevelUp({ type: 'charm', previous_level: 0, new_level: 1, current_xp: '300' })

      expect(balanceStore.patch).toHaveBeenCalledWith({ charm_xp: '300' })
    })
  })
})
