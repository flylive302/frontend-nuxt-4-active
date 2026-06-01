// ========================================
// Shared Nuxt Mocks for Composable Tests
// ========================================
// Provides mock factories for Pinia stores and Nuxt auto-imports
// used by composable tests. Each test file should call the relevant
// setup functions before testing.

import { vi } from 'vitest'
import { ref, computed, reactive, shallowRef } from 'vue'
import type { Gift } from '~/types/gift/gift'

// ========================================
// Mock Logger (shared across all tests)
// ========================================

export const mockLogger = {
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}

// ========================================
// Bootstrap Store Mock
// ========================================

export function createMockBootstrapStore(overrides: Record<string, unknown> = {}) {
  const defaults = {
    config: {
      wealth_levels: [
        { level: 1, name: 'Bronze', required_xp: 0, badge_id: 101 },
        { level: 2, name: 'Silver', required_xp: 100, badge_id: 102 },
        { level: 3, name: 'Gold', required_xp: 500, badge_id: 103 },
      ],
      charm_levels: [
        { level: 1, name: 'Star', required_xp: 0, badge_id: 201 },
        { level: 2, name: 'Super Star', required_xp: 200, badge_id: 202 },
        { level: 3, name: 'Legend', required_xp: 1000, badge_id: 203 },
      ],
    } as {
      wealth_levels: { level: number; name: string; required_xp: number; badge_id: number | null }[]
      charm_levels: { level: number; name: string; required_xp: number; badge_id: number | null }[]
    } | null,
    gifts: null as Gift[] | null,
    giftCatalog: [] as unknown[],
    isReady: true,
    needsRefresh: false,
    phase: 'idle' as string,
    sortedWealthLevels: [
      { level: 1, name: 'Bronze', required_xp: 0, badge_id: 101 },
      { level: 2, name: 'Silver', required_xp: 100, badge_id: 102 },
      { level: 3, name: 'Gold', required_xp: 500, badge_id: 103 },
    ] as { level: number; name: string; required_xp: number; badge_id: number | null }[],
    sortedCharmLevels: [
      { level: 1, name: 'Star', required_xp: 0, badge_id: 201 },
      { level: 2, name: 'Super Star', required_xp: 200, badge_id: 202 },
      { level: 3, name: 'Legend', required_xp: 1000, badge_id: 203 },
    ] as { level: number; name: string; required_xp: number; badge_id: number | null }[],
    getBadgeById: vi.fn((id: number) => ({
      id,
      name: `Badge ${id}`,
      image_url: `https://example.com/badge_${id}.webp`,
    })),
    badgeMap: new Map(),
    invalidateConfig: vi.fn(),
    setConfig: vi.fn(),
    setPhase: vi.fn(),
    setError: vi.fn(),
    setGifts: vi.fn(),
    ...overrides,
  }
  return defaults
}

// ========================================
// Levels Store Mock
// ========================================

export function createMockLevelsStore(overrides: Record<string, unknown> = {}) {
  const defaults = {
    wealthLevel: {
      current_level: 1,
      level_name: 'Bronze',
      current_xp: 50,
      progress_percentage: 50,
      xp_remaining: 50,
      xp_for_next_level: 100,
      badge: { id: 101, name: 'Badge 101', image_url: 'https://example.com/badge_101.webp' },
      next_level: { level: 2, name: 'Silver', required_xp: 100 },
    },
    charmLevel: {
      current_level: 1,
      level_name: 'Star',
      current_xp: 100,
      progress_percentage: 50,
      xp_remaining: 100,
      xp_for_next_level: 200,
      badge: { id: 201, name: 'Badge 201', image_url: 'https://example.com/badge_201.webp' },
      next_level: { level: 2, name: 'Super Star', required_xp: 200 },
    },
    loading: false,
    error: null,
    lastFetchedAt: Date.now(),
    setWealthLevel: vi.fn(),
    setCharmLevel: vi.fn(),
    setLevels: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  }
  return defaults
}

// ========================================
// Asset Store Mock
// ========================================

export function createMockAssetStore(overrides: Record<string, unknown> = {}) {
  const defaults = {
    phase: 'idle' as 'idle' | 'downloading' | 'complete' | 'error',
    progress: null,
    error: null,
    isDownloading: false,
    isComplete: false,
    completedCount: 0,
    totalCount: 0,
    downloadPercent: 0,
    setPhase: vi.fn(),
    setProgress: vi.fn(),
    setError: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  }
  return defaults
}

// ========================================
// Auth Store Mock
// ========================================

export function createMockAuthStore(overrides: Record<string, unknown> = {}) {
  const defaults = {
    token: 'mock-token',
    user: { id: 1, name: 'Test User', wealth_xp: '0', charm_xp: '0' },
    setToken: vi.fn(),
    setUser: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  }
  return defaults
}

// ========================================
// API Mock
// ========================================

export function createMockApi(overrides: Record<string, unknown> = {}) {
  return {
    api: vi.fn().mockResolvedValue({ data: {} }),
    normalizeError: vi.fn((e: { message?: string }) => ({
      message: e?.message ?? 'Unknown error',
    })),
    ...overrides,
  }
}

// ========================================
// Telemetry Mock
// ========================================

export function createMockTelemetry() {
  return {
    trackBootstrapStarted: vi.fn(),
    trackBootstrapCompleted: vi.fn(),
    trackBootstrapFailed: vi.fn(),
  }
}

// ========================================
// Bootstrap Assets Mock
// ========================================

export function createMockBootstrapAssets() {
  return {
    startAssetDownload: vi.fn(),
    enqueueAsset: vi.fn(),
    invalidateAsset: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  }
}

// ========================================
// Mall Store Mock
// ========================================

export function createMockMallStore(overrides: Record<string, unknown> = {}) {
  return {
    seedPropIndex: vi.fn(),
    propIndex: {},
    ...overrides,
  }
}

// ========================================
// Export helper to set up global auto-import mocks
// ========================================

/**
 * Set up global mocks for Nuxt auto-imports.
 * Call this in beforeEach() or at the top of your test file.
 */
export function setupNuxtMocks(mocks: {
  bootstrapStore?: ReturnType<typeof createMockBootstrapStore>
  levelsStore?: ReturnType<typeof createMockLevelsStore>
  assetStore?: ReturnType<typeof createMockAssetStore>
  authStore?: ReturnType<typeof createMockAuthStore>
  api?: ReturnType<typeof createMockApi>
  telemetry?: ReturnType<typeof createMockTelemetry>
  bootstrapAssets?: ReturnType<typeof createMockBootstrapAssets>
  mallStore?: ReturnType<typeof createMockMallStore>
  route?: Record<string, unknown>
  cookieValue?: string | null
} = {}) {
  const bootstrapStore = mocks.bootstrapStore ?? createMockBootstrapStore()
  const levelsStore = mocks.levelsStore ?? createMockLevelsStore()
  const assetStore = mocks.assetStore ?? createMockAssetStore()
  const authStore = mocks.authStore ?? createMockAuthStore()
  const api = mocks.api ?? createMockApi()
  const telemetry = mocks.telemetry ?? createMockTelemetry()
  const bootstrapAssets = mocks.bootstrapAssets ?? createMockBootstrapAssets()
  const mallStore = mocks.mallStore ?? createMockMallStore()
  const route = mocks.route ?? { meta: { middleware: [] } }
  const cookieValue = mocks.cookieValue ?? null

  // Mock auto-imported composables globally
  ;(globalThis as Record<string, unknown>).useBootstrapStore = () => bootstrapStore
  ;(globalThis as Record<string, unknown>).useLevelsStore = () => levelsStore
  ;(globalThis as Record<string, unknown>).useAssetStore = () => assetStore
  ;(globalThis as Record<string, unknown>).useAuthStore = () => authStore
  ;(globalThis as Record<string, unknown>).useApi = () => api
  ;(globalThis as Record<string, unknown>).useTelemetry = () => telemetry
  ;(globalThis as Record<string, unknown>).useBootstrapAssets = () => bootstrapAssets
  ;(globalThis as Record<string, unknown>).useMallStore = () => mallStore
  ;(globalThis as Record<string, unknown>).useRoute = () => route
  ;(globalThis as Record<string, unknown>).useCookie = () => ref(cookieValue)
  ;(globalThis as Record<string, unknown>).useRoomParticipantsStore = () => ({ updateParticipantProfile: vi.fn() })
  ;(globalThis as Record<string, unknown>).ref = ref
  ;(globalThis as Record<string, unknown>).shallowRef = shallowRef
  ;(globalThis as Record<string, unknown>).computed = computed
  ;(globalThis as Record<string, unknown>).reactive = reactive
  ;(globalThis as Record<string, unknown>).readonly = <T>(value: T) => value

  return { bootstrapStore, levelsStore, assetStore, authStore, api, telemetry, bootstrapAssets, mallStore }
}

/**
 * Clean up global mocks.
 * Call this in afterEach().
 */
export function cleanupNuxtMocks(): void {
  const keys = [
    'useBootstrapStore', 'useLevelsStore', 'useAssetStore', 'useAuthStore',
    'useApi', 'useTelemetry', 'useBootstrapAssets', 'useMallStore', 'useRoute', 'useCookie',
    'ref', 'shallowRef', 'computed', 'reactive', 'readonly', 'useRoomParticipantsStore',
  ] as const
  for (const key of keys) {
    Reflect.deleteProperty(globalThis, key)
  }
}
