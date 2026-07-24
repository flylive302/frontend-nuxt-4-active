// ========================================
// useLevelUpDrain Composable Tests
// ========================================
// level-up-celebrations epic, ticket 04: page-gated level-up celebration.
// Verifies the GATE (no-op below watermark) → EXECUTE (capped modal build)
// → REACT (watermark always advances fully) pipeline, and that a wealth
// drain never touches charm watermark state (own-track only).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
  createMockAuthStore,
  createMockBootstrapStore,
  createMockLevelUpWatermarkStore,
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
let useLevelUpDrain: () => ReturnType<typeof import('~/composables/progression/useLevelUpDrain')['useLevelUpDrain']>

/** Level configs where level L requires exactly (L - 1) * 100 XP. */
function buildLevels(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    level: i + 1,
    name: `Level ${i + 1}`,
    required_xp: i * 100,
    image_url: `https://example.com/level-${i + 1}.webp`,
  }))
}

const LEVELS = buildLevels(12)

/** XP that lands exactly on level L given the LEVELS ladder above. */
function xpForLevel(level: number): string {
  return String((level - 1) * 100)
}

describe('useLevelUpDrain', () => {
  let authStore: ReturnType<typeof createMockAuthStore>
  let bootstrapStore: ReturnType<typeof createMockBootstrapStore>
  let watermarkStore: ReturnType<typeof createMockLevelUpWatermarkStore>

  beforeEach(async () => {
    bootstrapStore = createMockBootstrapStore({
      sortedWealthLevels: LEVELS,
      sortedCharmLevels: LEVELS,
    })
    watermarkStore = createMockLevelUpWatermarkStore()
    authStore = createMockAuthStore({
      user: { id: 1, name: 'Test User', wealth_xp: xpForLevel(1), charm_xp: xpForLevel(1) },
    })
    setupNuxtMocks({ bootstrapStore, authStore, levelUpWatermarkStore: watermarkStore })

    const mod = await import('~/composables/progression/useLevelUpDrain')
    useLevelUpDrain = mod.useLevelUpDrain
  })

  afterEach(() => {
    cleanupNuxtMocks()
    vi.restoreAllMocks()
  })

  it('shows no modal when the derived current level is at or below the watermark', () => {
    watermarkStore.wealthLevelSeen = 3
    ;(authStore.user as { wealth_xp: string }).wealth_xp = xpForLevel(3)

    const { drain, currentModal } = useLevelUpDrain()
    drain('wealth')

    expect(currentModal.value).toBeNull()
    expect(watermarkStore.setWealthLevelSeen).not.toHaveBeenCalled()
  })

  it('shows one modal per crossed level when the count is within the cap', () => {
    watermarkStore.wealthLevelSeen = 0
    ;(authStore.user as { wealth_xp: string }).wealth_xp = xpForLevel(2)

    const { drain, currentModal, closeModal } = useLevelUpDrain()
    drain('wealth')

    expect(currentModal.value).toEqual(
      expect.objectContaining({ kind: 'single', level: 1, previousLevel: 0 }),
    )

    closeModal()
    expect(currentModal.value).toEqual(
      expect.objectContaining({ kind: 'single', level: 2, previousLevel: 1 }),
    )

    closeModal()
    expect(currentModal.value).toBeNull()
    expect(watermarkStore.setWealthLevelSeen).toHaveBeenCalledWith(2)
  })

  it('caps at 2 individual modals + 1 summary when more levels than the cap were crossed', () => {
    watermarkStore.wealthLevelSeen = 0
    ;(authStore.user as { wealth_xp: string }).wealth_xp = xpForLevel(12)

    const { drain, currentModal, closeModal } = useLevelUpDrain()
    drain('wealth')

    expect(currentModal.value).toEqual(
      expect.objectContaining({ kind: 'single', level: 1, previousLevel: 0 }),
    )

    closeModal()
    expect(currentModal.value).toEqual(
      expect.objectContaining({ kind: 'single', level: 2, previousLevel: 1 }),
    )

    closeModal()
    expect(currentModal.value).toEqual(
      expect.objectContaining({ kind: 'summary', level: 12, previousLevel: 2, crossedCount: 12 }),
    )

    closeModal()
    expect(currentModal.value).toBeNull()
    // Watermark advances fully to 12, not just to the last individually-shown level.
    expect(watermarkStore.setWealthLevelSeen).toHaveBeenCalledWith(12)
    expect(watermarkStore.setWealthLevelSeen).toHaveBeenCalledTimes(1)
  })

  it('boundary: shows exactly 3 individual modals with no summary when crossed count equals the cap', () => {
    watermarkStore.wealthLevelSeen = 0
    ;(authStore.user as { wealth_xp: string }).wealth_xp = xpForLevel(3)

    const { drain, currentModal, closeModal } = useLevelUpDrain()
    drain('wealth')

    expect(currentModal.value).toEqual(expect.objectContaining({ kind: 'single', level: 1 }))
    closeModal()
    expect(currentModal.value).toEqual(expect.objectContaining({ kind: 'single', level: 2 }))
    closeModal()
    expect(currentModal.value).toEqual(expect.objectContaining({ kind: 'single', level: 3 }))
    closeModal()
    expect(currentModal.value).toBeNull()
    expect(watermarkStore.setWealthLevelSeen).toHaveBeenCalledWith(3)
  })

  it('boundary: collapses to 2 individual + 1 summary as soon as crossed count exceeds the cap', () => {
    watermarkStore.wealthLevelSeen = 0
    ;(authStore.user as { wealth_xp: string }).wealth_xp = xpForLevel(4)

    const { drain, currentModal, closeModal } = useLevelUpDrain()
    drain('wealth')

    expect(currentModal.value).toEqual(expect.objectContaining({ kind: 'single', level: 1 }))
    closeModal()
    expect(currentModal.value).toEqual(expect.objectContaining({ kind: 'single', level: 2 }))
    closeModal()
    expect(currentModal.value).toEqual(
      expect.objectContaining({ kind: 'summary', level: 4, previousLevel: 2, crossedCount: 4 }),
    )
    closeModal()
    expect(currentModal.value).toBeNull()
    expect(watermarkStore.setWealthLevelSeen).toHaveBeenCalledWith(4)
  })

  it('advances the watermark to the fully-derived current level even when capped', () => {
    watermarkStore.wealthLevelSeen = 5
    ;(authStore.user as { wealth_xp: string }).wealth_xp = xpForLevel(10)

    const { drain } = useLevelUpDrain()
    drain('wealth')

    expect(watermarkStore.setWealthLevelSeen).toHaveBeenCalledWith(10)
  })

  it('first run: collapses an existing user\'s whole history into one summary modal', () => {
    watermarkStore.wealthLevelSeen = null
    ;(authStore.user as { wealth_xp: string }).wealth_xp = xpForLevel(12)

    const { drain, currentModal, closeModal } = useLevelUpDrain()
    drain('wealth')

    // Exactly one modal, naming where they already are — no bogus "Level 1!".
    expect(currentModal.value).toEqual(
      expect.objectContaining({ kind: 'summary', level: 12, crossedCount: 12 }),
    )

    closeModal()
    expect(currentModal.value).toBeNull()
    expect(watermarkStore.setWealthLevelSeen).toHaveBeenCalledWith(12)
    expect(watermarkStore.setWealthLevelSeen).toHaveBeenCalledTimes(1)
  })

  it('first run below the ladder floor: shows nothing but still initialises the watermark', () => {
    // A ladder whose first rung costs 100 XP, and a user with 0 XP — so the
    // derived level really is 0 and nothing has been crossed.
    bootstrapStore.sortedWealthLevels = buildLevels(12).map((l) => ({
      ...l,
      required_xp: l.level * 100,
    }))
    watermarkStore.wealthLevelSeen = null
    ;(authStore.user as { wealth_xp: string }).wealth_xp = '0'

    const { drain, currentModal } = useLevelUpDrain()
    drain('wealth')

    expect(currentModal.value).toBeNull()
    // Still initialised, so the next genuine level-up takes the normal path.
    expect(watermarkStore.setWealthLevelSeen).toHaveBeenCalledWith(0)
  })

  it('after a first run initialises the mark, later visits use the normal cap rule', () => {
    // Visit 1: fresh device, user already at level 5 -> one summary.
    watermarkStore.wealthLevelSeen = null
    ;(authStore.user as { wealth_xp: string }).wealth_xp = xpForLevel(5)

    const first = useLevelUpDrain()
    first.drain('wealth')
    expect(first.currentModal.value).toEqual(expect.objectContaining({ kind: 'summary', level: 5 }))
    expect(watermarkStore.setWealthLevelSeen).toHaveBeenCalledWith(5)

    // Visit 2: mark now persisted at 5, user climbs to 8 -> 3 individual modals.
    watermarkStore.wealthLevelSeen = 5
    ;(authStore.user as { wealth_xp: string }).wealth_xp = xpForLevel(8)

    const second = useLevelUpDrain()
    second.drain('wealth')

    expect(second.currentModal.value).toEqual(expect.objectContaining({ kind: 'single', level: 6 }))
    second.closeModal()
    expect(second.currentModal.value).toEqual(expect.objectContaining({ kind: 'single', level: 7 }))
    second.closeModal()
    expect(second.currentModal.value).toEqual(expect.objectContaining({ kind: 'single', level: 8 }))
    second.closeModal()
    expect(second.currentModal.value).toBeNull()
    expect(watermarkStore.setWealthLevelSeen).toHaveBeenLastCalledWith(8)
  })

  it('own-track only: a wealth drain never reads or advances charm watermark state', () => {
    watermarkStore.wealthLevelSeen = 0
    watermarkStore.charmLevelSeen = 0
    ;(authStore.user as { wealth_xp: string; charm_xp: string }).wealth_xp = xpForLevel(2)
    ;(authStore.user as { wealth_xp: string; charm_xp: string }).charm_xp = xpForLevel(8)

    const { drain } = useLevelUpDrain()
    drain('wealth')

    expect(watermarkStore.setWealthLevelSeen).toHaveBeenCalledWith(2)
    expect(watermarkStore.setCharmLevelSeen).not.toHaveBeenCalled()
  })
})
