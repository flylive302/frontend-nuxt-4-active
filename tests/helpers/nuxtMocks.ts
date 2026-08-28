// ========================================
// Shared Nuxt Mocks for Composable Tests
// ========================================
// Provides mock factories for Pinia stores and Nuxt auto-imports
// used by composable tests. Each test file should call the relevant
// setup functions before testing.

import {vi} from 'vitest'
import {computed, reactive, ref, shallowRef} from 'vue'
import type {Gift} from '~/types/gift/gift'

// ========================================
// Bootstrap Store Mock
// ========================================

export function createMockBootstrapStore(overrides: Record<string, unknown> = {}) {
  const base = {
    config: {
      wealth_levels: [
        { level: 1, name: 'Bronze', required_xp: 0, image_url: 'https://example.com/bronze.webp' },
        { level: 2, name: 'Silver', required_xp: 100, image_url: 'https://example.com/silver.webp' },
        { level: 3, name: 'Gold', required_xp: 500, image_url: 'https://example.com/gold.webp' },
      ],
      charm_levels: [
        { level: 1, name: 'Star', required_xp: 0, image_url: 'https://example.com/star.webp' },
        { level: 2, name: 'Super Star', required_xp: 200, image_url: 'https://example.com/superstar.webp' },
        { level: 3, name: 'Legend', required_xp: 1000, image_url: 'https://example.com/legend.webp' },
      ],
    } as {
      wealth_levels: { level: number; name: string; required_xp: number; image_url: string | null }[]
      charm_levels: { level: number; name: string; required_xp: number; image_url: string | null }[]
    } | null,
    gifts: null as Gift[] | null,
    giftCatalog: [] as unknown[],
    isReady: true,
    needsRefresh: false,
    phase: 'idle' as string,
    sortedWealthLevels: [
      { level: 1, name: 'Bronze', required_xp: 0, image_url: 'https://example.com/bronze.webp' },
      { level: 2, name: 'Silver', required_xp: 100, image_url: 'https://example.com/silver.webp' },
      { level: 3, name: 'Gold', required_xp: 500, image_url: 'https://example.com/gold.webp' },
    ] as { level: number; name: string; required_xp: number; image_url: string | null }[],
    sortedCharmLevels: [
      { level: 1, name: 'Star', required_xp: 0, image_url: 'https://example.com/star.webp' },
      { level: 2, name: 'Super Star', required_xp: 200, image_url: 'https://example.com/superstar.webp' },
      { level: 3, name: 'Legend', required_xp: 1000, image_url: 'https://example.com/legend.webp' },
    ] as { level: number; name: string; required_xp: number; image_url: string | null }[],
    vipLevels: [] as { id: number; level: number; card_animated_url: string | null; emblem_animated_url: string | null }[],
    featuredRooms: [] as { id: number; background: string | null }[],
    badges: [] as { id: number; image_url: string }[],
    getBadgeById: vi.fn((id: number) => ({
      id,
      name: `Badge ${id}`,
      image_url: `https://example.com/badge_${id}.webp`,
    })),
    badgeMap: new Map(),
    invalidateConfig: vi.fn(),
    setConfig: vi.fn(),
    setPhase: vi.fn(),
    // Added to the real store in 3bcb1a51; the mock lagged behind and left
    // useBootstrapInit's cached-boot paths red.
    markReadyFromCache: vi.fn(),
    setError: vi.fn(),
    setGifts: vi.fn(),
  }
  // Spread overrides separately so TypeScript infers the return type from `base`
  // (spreading Record<string,unknown> inline widens all named property types to unknown)
  return { ...base, ...overrides } as typeof base
}

// ========================================
// Levels Store Mock
// ========================================

export function createMockLevelsStore(overrides: Record<string, unknown> = {}) {
  return {
    wealthLevel: {
      current_level: 1,
      level_name: 'Bronze',
      current_xp: 50,
      progress_percentage: 50,
      xp_remaining: 50,
      xp_for_next_level: 100,
      badge: {id: 101, name: 'Badge 101', image_url: 'https://example.com/badge_101.webp'},
      next_level: {level: 2, name: 'Silver', required_xp: 100},
    },
    charmLevel: {
      current_level: 1,
      level_name: 'Star',
      current_xp: 100,
      progress_percentage: 50,
      xp_remaining: 100,
      xp_for_next_level: 200,
      badge: {id: 201, name: 'Badge 201', image_url: 'https://example.com/badge_201.webp'},
      next_level: {level: 2, name: 'Super Star', required_xp: 200},
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
}

// ========================================
// Level-Up Watermark Store Mock
// ========================================

export function createMockLevelUpWatermarkStore(overrides: Record<string, unknown> = {}) {
  return {
    wealthLevelSeen: null as number | null,
    charmLevelSeen: null as number | null,
    milestoneSeen: {} as Record<string, number>,
    setWealthLevelSeen: vi.fn(),
    setCharmLevelSeen: vi.fn(),
    setMilestoneSeen: vi.fn(),
    setMilestoneSeenExclusive: vi.fn(),
    $reset: vi.fn(),
    ...overrides,
  }
}

// ========================================
// Income Store Mock
// ========================================

export function createMockIncomeStore(overrides: Record<string, unknown> = {}) {
  return {
    activeRun: null as unknown,
    ...overrides,
  }
}

// ========================================
// Asset Store Mock
// ========================================

export function createMockAssetStore(overrides: Record<string, unknown> = {}) {
  return {
    phase: 'idle' as 'idle' | 'downloading' | 'complete' | 'error',
    progress: null,
    error: null,
    isDownloading: false,
    isComplete: false,
    completedCount: 0,
    totalCount: 0,
    downloadPercent: 0,
    criticalTotal: 0,
    criticalSucceeded: 0,
    criticalFailed: 0,
    criticalFailedUrls: [] as string[],
    failedTotal: 0,
    failedUrls: [] as string[],
    cacheSweptAndConfirmed: false,
    hasDegradedAssets: false,
    isCriticalGateOpen: false,
    hasCriticalFailures: false,
    setPhase: vi.fn(),
    setProgress: vi.fn(),
    setError: vi.fn(),
    setCriticalTotal: vi.fn(),
    markCriticalSucceeded: vi.fn(),
    markCriticalFailed: vi.fn(),
    markFailed: vi.fn(),
    setCacheSweptAndConfirmed: vi.fn(),
    setHasDegradedAssets: vi.fn(),
    resetFailedUrls: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  }
}

// ========================================
// Auth Store Mock
// ========================================

export function createMockAuthStore(overrides: Record<string, unknown> = {}) {
  return {
    token: 'mock-token',
    user: {id: 1, name: 'Test User', wealth_xp: '0', charm_xp: '0'},
    setToken: vi.fn(),
    setUser: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  }
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
// User Sync Mock
// ========================================

export function createMockUserSync() {
  return {
    syncUser: vi.fn().mockResolvedValue(undefined),
  }
}

// ========================================
// Inbox Reconcile Mock
// ========================================

export function createMockInboxReconcile() {
  return {
    reconcileInbox: vi.fn().mockResolvedValue(undefined),
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
  levelUpWatermarkStore?: ReturnType<typeof createMockLevelUpWatermarkStore>
  incomeStore?: ReturnType<typeof createMockIncomeStore>
  api?: ReturnType<typeof createMockApi>
  telemetry?: ReturnType<typeof createMockTelemetry>
  bootstrapAssets?: ReturnType<typeof createMockBootstrapAssets>
  userSync?: ReturnType<typeof createMockUserSync>
  inboxReconcile?: ReturnType<typeof createMockInboxReconcile>
  mallStore?: ReturnType<typeof createMockMallStore>
  route?: Record<string, unknown>
  cookieValue?: string | null
} = {}) {
  const bootstrapStore = mocks.bootstrapStore ?? createMockBootstrapStore()
  const levelsStore = mocks.levelsStore ?? createMockLevelsStore()
  const assetStore = mocks.assetStore ?? createMockAssetStore()
  const authStore = mocks.authStore ?? createMockAuthStore()
  const levelUpWatermarkStore = mocks.levelUpWatermarkStore ?? createMockLevelUpWatermarkStore()
  const incomeStore = mocks.incomeStore ?? createMockIncomeStore()
  const api = mocks.api ?? createMockApi()
  const telemetry = mocks.telemetry ?? createMockTelemetry()
  const bootstrapAssets = mocks.bootstrapAssets ?? createMockBootstrapAssets()
  const userSync = mocks.userSync ?? createMockUserSync()
  const inboxReconcile = mocks.inboxReconcile ?? createMockInboxReconcile()
  const mallStore = mocks.mallStore ?? createMockMallStore()
  const route = mocks.route ?? { meta: { middleware: [] } }
  const cookieValue = mocks.cookieValue ?? null

  // Mock auto-imported composables globally
  ;(globalThis as Record<string, unknown>).useBootstrapStore = () => bootstrapStore
  ;(globalThis as Record<string, unknown>).useLevelsStore = () => levelsStore
  ;(globalThis as Record<string, unknown>).useAssetStore = () => assetStore
  ;(globalThis as Record<string, unknown>).useAuthStore = () => authStore
  ;(globalThis as Record<string, unknown>).useLevelUpWatermarkStore = () => levelUpWatermarkStore
  ;(globalThis as Record<string, unknown>).useIncomeStore = () => incomeStore
  ;(globalThis as Record<string, unknown>).useApi = () => api
  ;(globalThis as Record<string, unknown>).useTelemetry = () => telemetry
  ;(globalThis as Record<string, unknown>).useBootstrapAssets = () => bootstrapAssets
  ;(globalThis as Record<string, unknown>).useUserSync = () => userSync
  ;(globalThis as Record<string, unknown>).useInboxReconcile = () => inboxReconcile
  ;(globalThis as Record<string, unknown>).useMallStore = () => mallStore
  ;(globalThis as Record<string, unknown>).useRoute = () => route
  ;(globalThis as Record<string, unknown>).useCookie = () => ref(cookieValue)
  ;(globalThis as Record<string, unknown>).useRoomParticipantsStore = () => ({ updateParticipantProfile: vi.fn() })
  ;(globalThis as Record<string, unknown>).ref = ref
  ;(globalThis as Record<string, unknown>).shallowRef = shallowRef
  ;(globalThis as Record<string, unknown>).computed = computed
  ;(globalThis as Record<string, unknown>).reactive = reactive
  ;(globalThis as Record<string, unknown>).readonly = <T>(value: T) => value

  return { bootstrapStore, levelsStore, assetStore, authStore, levelUpWatermarkStore, incomeStore, api, telemetry, bootstrapAssets, userSync, inboxReconcile, mallStore }
}

/**
 * Clean up global mocks.
 * Call this in afterEach().
 */
export function cleanupNuxtMocks(): void {
  const keys = [
    'useBootstrapStore', 'useLevelsStore', 'useAssetStore', 'useAuthStore', 'useLevelUpWatermarkStore', 'useIncomeStore',
    'useApi', 'useTelemetry', 'useBootstrapAssets', 'useUserSync', 'useInboxReconcile', 'useMallStore', 'useRoute', 'useCookie',
    'ref', 'shallowRef', 'computed', 'reactive', 'readonly', 'useRoomParticipantsStore',
  ] as const
  for (const key of keys) {
    Reflect.deleteProperty(globalThis, key)
  }
}
