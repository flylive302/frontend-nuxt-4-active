// ========================================
// Warm-open regression test — "LV 1 everywhere" trap
// ========================================
// A warm start (persisted, usable catalog) must flip `phase` synchronously so
// every `isReady` consumer (level/badge lookups) renders real data on the
// very first paint — before any network request settles. If `phase` is never
// flipped, every level badge silently falls back to level 1 / "Unknown".
// See docs/reference/gotchas/frontend.md.
//
// Uses the REAL Pinia store + REAL useLevelLookup (not createMockBootstrapStore,
// whose default `isReady: true` would hide this bug entirely).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed, reactive, shallowRef } from 'vue'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
  createMockAuthStore,
  createMockApi,
  createMockMallStore,
} from '../helpers/nuxtMocks'
import { BOOTSTRAP_SHAPE_VERSION } from '~/constants/bootstrap'
import type { LevelConfig } from '~/types/user/bootstrap'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

vi.mock('~/utils/schedule-after-first-paint', () => ({
  scheduleAfterFirstPaint: vi.fn(),
}))

const wealthLevels: LevelConfig[] = [
  { level: 1, name: 'Bronze', required_xp: 0, image_url: null },
  { level: 2, name: 'Silver', required_xp: 100, image_url: null },
  { level: 3, name: 'Gold', required_xp: 500, image_url: null },
]

describe('warm open — real store + real level lookup', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('reactive', reactive)
    vi.stubGlobal('shallowRef', shallowRef)
  })

  afterEach(() => {
    cleanupNuxtMocks()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('flips isReady synchronously so level lookups return real levels, before any request settles', async () => {
    const { useBootstrapStore } = await import('~/stores/bootstrap')
    const realStore = useBootstrapStore()

    // Persisted-looking state: usable cache of the current shape.
    realStore.wealthLevels = wealthLevels
    realStore.charmLevels = []
    realStore.shapeVersion = BOOTSTRAP_SHAPE_VERSION
    realStore.setEtag('W/"cached"')
    expect(realStore.phase).toBe('idle')
    expect(realStore.hasUsableCache).toBe(true)

    // Never-resolving network — the warm path must not wait on it.
    const api = createMockApi()
    api.api.mockReturnValue(new Promise(() => {}))

    setupNuxtMocks({
      bootstrapStore: realStore as unknown as ReturnType<typeof import('../helpers/nuxtMocks').createMockBootstrapStore>,
      authStore: createMockAuthStore({ token: null }),
      api,
      mallStore: createMockMallStore(),
      route: { meta: { middleware: [] } },
    })

    const { useBootstrapInit } = await import('~/composables/shared/useBootstrapInit')
    const { init } = useBootstrapInit()

    // Do not await forever: the warm path returns without awaiting the network.
    const result = await init()
    expect(result).toBeNull()

    // The bug this guards: phase never flips, isReady stays false, every
    // level badge falls back to level 0 / "Unknown".
    expect(realStore.isReady).toBe(true)

    const { useLevelLookup } = await import('~/composables/shared/useLevelLookup')
    const { getLevelFromXp } = useLevelLookup()
    const result2 = getLevelFromXp(150, 'wealth') // above level 2's 100 xp threshold
    expect(result2.level).toBe(2)
    expect(result2.name).toBe('Silver')
  })

  it('negative: shapeVersion mismatch takes the cold path and discards the levels', async () => {
    const { useBootstrapStore } = await import('~/stores/bootstrap')
    const realStore = useBootstrapStore()

    // Same persisted levels, but written by an older client shape.
    realStore.wealthLevels = wealthLevels
    realStore.charmLevels = []
    realStore.shapeVersion = null
    expect(realStore.hasUsableCache).toBe(false)

    // Never-resolving network: assert the state right after the synchronous
    // discard, without waiting for (or needing) the fetch to complete.
    const api = createMockApi()
    api.api.mockReturnValue(new Promise(() => {}))

    setupNuxtMocks({
      bootstrapStore: realStore as unknown as ReturnType<typeof import('../helpers/nuxtMocks').createMockBootstrapStore>,
      authStore: createMockAuthStore({ token: null }),
      api,
      mallStore: createMockMallStore(),
      route: { meta: { middleware: [] } },
    })

    const { useBootstrapInit } = await import('~/composables/shared/useBootstrapInit')
    const { init } = useBootstrapInit()

    void init() // cold path awaits the fetch — do not await it here, it never resolves
    await Promise.resolve()
    await Promise.resolve()

    // Cold path: unconditional fetch, persisted levels discarded first.
    expect(api.api).toHaveBeenCalledWith('/bootstrap', expect.objectContaining({ headers: undefined }))
    expect(realStore.wealthLevels).toBeNull()
    expect(realStore.shapeVersion).toBeNull()
    expect(realStore.phase).toBe('loading')

    const { useLevelLookup } = await import('~/composables/shared/useLevelLookup')
    const { getLevelFromXp } = useLevelLookup()
    // isReady is false while the cold fetch is in flight — fallback applies.
    const result = getLevelFromXp(150, 'wealth')
    expect(result.level).toBe(0)
    expect(result.name).toBe('Unknown')
  })
})
