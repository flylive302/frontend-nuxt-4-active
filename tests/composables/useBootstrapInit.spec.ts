// ========================================
// Bootstrap Init Composable Tests
// ========================================
// Tests for the most critical orchestrator in the app.
// Covers GATE → EXECUTE → REACT pipeline.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
  createMockBootstrapStore,
  createMockAuthStore,
  createMockApi,
  createMockTelemetry,
  createMockBootstrapAssets,
} from '../helpers/nuxtMocks'
import { useBootstrapInit } from '~/composables/shared/useBootstrapInit'

// ========================================
// Mocks
// ========================================

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

// ========================================
// Helpers — store defaults that PASS the GATE
// ========================================

/** Bootstrap store that allows init() to reach EXECUTE */
function gatePassingBootstrapStore(overrides = {}) {
  return createMockBootstrapStore({
    isReady: false,
    needsRefresh: true,
    phase: 'idle',
    setPhase: vi.fn(),
    setError: vi.fn(),
    setConfig: vi.fn(),
    setGifts: vi.fn(),
    ...overrides,
  })
}

/** Auth store with a valid token so the GATE passes */
function gatePassingAuthStore(overrides = {}) {
  return createMockAuthStore({
    token: 'valid-token',
    user: null, // No user → needsFetch = true
    ...overrides,
  })
}

// ========================================
// Tests
// ========================================

describe('useBootstrapInit', () => {
  let _mocks: ReturnType<typeof setupNuxtMocks>

  beforeEach(() => {
    // Default: stores that PASS gating so EXECUTE tests can run
    _mocks = setupNuxtMocks({
      bootstrapStore: gatePassingBootstrapStore(),
      authStore: gatePassingAuthStore(),
    })
  })

  afterEach(() => {
    cleanupNuxtMocks()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  // ========================================
  // GATE Tests
  // ========================================

  describe('GATE: Route shortcuts', () => {
    it('should return null on OAuth callback route', async () => {
      _mocks = setupNuxtMocks({
        route: { path: '/callback', meta: { middleware: [] } },
      })

      const { init } = useBootstrapInit()
      expect(await init()).toBeNull()
    })
  })

  describe('GATE: Auth token resolution', () => {
    it('should return null without API when bootstrap is fresh', async () => {
      _mocks = setupNuxtMocks({
        authStore: createMockAuthStore({ token: null }),
        bootstrapStore: createMockBootstrapStore({ isReady: true, needsRefresh: false }),
        cookieValue: null,
      })

      const { init } = useBootstrapInit()
      const result = await init()
      expect(result).toBeNull()
    })

    it('should use token from auth store and fetch', async () => {
      const api = createMockApi()
      api.api.mockResolvedValue({ data: { user: { id: 1 }, config: {} } })
      _mocks = setupNuxtMocks({
        authStore: gatePassingAuthStore({ token: 'store-token' }),
        bootstrapStore: gatePassingBootstrapStore(),
        api,
      })

      const { init } = useBootstrapInit()
      await init()
      expect(api.api).toHaveBeenCalled()
    })

  })

  describe('GATE: Freshness check', () => {
    it('should skip fetch when data is fresh and user exists', async () => {
      const api = createMockApi()
      _mocks = setupNuxtMocks({
        authStore: createMockAuthStore({ token: 'token', user: { id: 1 } }),
        bootstrapStore: createMockBootstrapStore({ isReady: true, needsRefresh: false }),
        api,
      })

      const { init } = useBootstrapInit()
      const result = await init()

      expect(result).toBeNull()
      expect(api.api).not.toHaveBeenCalled()
    })
  })

  describe('GATE: Concurrent fetch guard', () => {
    it('should return null when fetch is already in progress', async () => {
      _mocks = setupNuxtMocks({
        bootstrapStore: gatePassingBootstrapStore({ phase: 'loading' }),
      })

      const { init } = useBootstrapInit()
      const result = await init()
      expect(result).toBeNull()
    })
  })

  // ========================================
  // EXECUTE Tests
  // ========================================

  describe('EXECUTE: Critical data fetch', () => {
    it('should call API with correct critical fields', async () => {
      const api = createMockApi()
      api.api.mockResolvedValue({ data: { user: { id: 1 }, config: {} } })
      _mocks = setupNuxtMocks({
        api,
        authStore: gatePassingAuthStore(),
        bootstrapStore: gatePassingBootstrapStore(),
      })

      const { init } = useBootstrapInit()
      await init()
      expect(api.api).toHaveBeenCalledWith('/bootstrap')
    })

    it('should seed bootstrap store with config on success', async () => {
      const bootstrapStore = gatePassingBootstrapStore()
      const api = createMockApi()
      api.api.mockResolvedValue({ data: { user: {}, config: { enableFeatureX: true } } })
      _mocks = setupNuxtMocks({
        bootstrapStore,
        authStore: gatePassingAuthStore(),
        api,
      })

      const { init } = useBootstrapInit()
      await init()
      expect(bootstrapStore.setConfig).toHaveBeenCalledWith({
        user: {},
        config: { enableFeatureX: true },
      })
    })

    it('should set phase to complete on success', async () => {
      const bootstrapStore = gatePassingBootstrapStore()
      const api = createMockApi()
      api.api.mockResolvedValue({ data: { user: {}, config: {} } })
      _mocks = setupNuxtMocks({
        bootstrapStore,
        authStore: gatePassingAuthStore(),
        api,
      })

      const { init } = useBootstrapInit()
      await init()
      expect(bootstrapStore.setPhase).toHaveBeenCalledWith('complete')
    })

    it('should return response data on success', async () => {
      const api = createMockApi()
      const responseData = { user: { id: 1 }, config: { x: 1 } }
      api.api.mockResolvedValue({ data: responseData })
      _mocks = setupNuxtMocks({
        api,
        authStore: gatePassingAuthStore(),
        bootstrapStore: gatePassingBootstrapStore(),
      })

      const { init } = useBootstrapInit()
      const result = await init()
      expect(result).toEqual(responseData)
    })
  })

  describe('EXECUTE: Error handling', () => {
    it('should set phase to error on API failure', async () => {
      const bootstrapStore = gatePassingBootstrapStore()
      const api = createMockApi()
      api.api.mockRejectedValue(new Error('Network error'))
      _mocks = setupNuxtMocks({
        bootstrapStore,
        authStore: gatePassingAuthStore(),
        api,
      })

      const { init } = useBootstrapInit()
      const result = await init()
      expect(result).toBeNull()
      expect(bootstrapStore.setPhase).toHaveBeenCalledWith('error')
    })

    it('should set error message on API failure', async () => {
      const bootstrapStore = gatePassingBootstrapStore()
      const api = createMockApi()
      api.api.mockRejectedValue(new Error('Network error'))
      api.normalizeError.mockReturnValue({ message: 'Network error' })
      _mocks = setupNuxtMocks({
        bootstrapStore,
        authStore: gatePassingAuthStore(),
        api,
      })

      const { init } = useBootstrapInit()
      await init()
      expect(bootstrapStore.setError).toHaveBeenCalledWith('Network error')
    })

  })

  // ========================================
  // REACT Tests
  // ========================================

  describe('REACT: Asset downloads', () => {
    beforeEach(() => {
      vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
        cb()
        return 0
      })
    })

    it('should trigger startAssetDownload when gifts present in response', async () => {
      const bootstrapAssets = createMockBootstrapAssets()
      const api = createMockApi()
      api.api.mockResolvedValue({
        data: { user: {}, config: {}, gifts: { catalog: [{ id: 1 }] } },
      })
      _mocks = setupNuxtMocks({
        bootstrapAssets,
        api,
        authStore: gatePassingAuthStore(),
        bootstrapStore: gatePassingBootstrapStore(),
        route: { path: '/mall', meta: { middleware: [] } },
      })

      const { init } = useBootstrapInit()
      await init()
      expect(bootstrapAssets.startAssetDownload).toHaveBeenCalled()
    })

    it('should trigger startAssetDownload when gifts already in store', async () => {
      const bootstrapAssets = createMockBootstrapAssets()
      const api = createMockApi()
      api.api.mockResolvedValue({ data: { user: {}, config: {} } })
      _mocks = setupNuxtMocks({
        bootstrapAssets,
        bootstrapStore: gatePassingBootstrapStore({
          giftCatalog: [{ id: 1, name: 'Gift 1' }],
        }),
        authStore: gatePassingAuthStore(),
        api,
        route: { path: '/mall', meta: { middleware: [] } },
      })

      const { init } = useBootstrapInit()
      await init()
      expect(bootstrapAssets.startAssetDownload).toHaveBeenCalled()
    })

    it('should NOT trigger startAssetDownload on home path (perf)', async () => {
      const bootstrapAssets = createMockBootstrapAssets()
      const api = createMockApi()
      api.api.mockResolvedValue({ data: { user: {}, config: {} } })
      _mocks = setupNuxtMocks({
        bootstrapAssets,
        bootstrapStore: gatePassingBootstrapStore({ giftCatalog: [{ id: 1 }] }),
        authStore: gatePassingAuthStore(),
        api,
        route: { path: '/', meta: { middleware: [] } },
      })

      const { init } = useBootstrapInit()
      await init()
      expect(bootstrapAssets.startAssetDownload).not.toHaveBeenCalled()
    })
  })

  // ========================================
  // Telemetry
  // ========================================

  describe('Telemetry', () => {
    it('should track bootstrap start and completion', async () => {
      const telemetry = createMockTelemetry()
      const api = createMockApi()
      api.api.mockResolvedValue({ data: { user: {}, config: {} } })
      _mocks = setupNuxtMocks({
        telemetry,
        api,
        authStore: gatePassingAuthStore(),
        bootstrapStore: gatePassingBootstrapStore(),
      })

      const { init } = useBootstrapInit()
      await init()
      expect(telemetry.trackBootstrapStarted).toHaveBeenCalled()
      expect(telemetry.trackBootstrapCompleted).toHaveBeenCalled()
    })
  })
})
