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
  createMockMallStore,
} from '../helpers/nuxtMocks'
import { useBootstrapInit } from '~/composables/shared/useBootstrapInit'
import { scheduleAfterFirstPaint } from '~/utils/schedule-after-first-paint'

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

/** Bootstrap store that reaches the COLD path (no usable cache). */
function gatePassingBootstrapStore(overrides = {}) {
  return createMockBootstrapStore({
    isReady: false,
    hasUsableCache: false,
    phase: 'idle',
    setPhase: vi.fn(),
    setError: vi.fn(),
    setConfig: vi.fn(),
    setGifts: vi.fn(),
    setEtag: vi.fn(),
    invalidateConfig: vi.fn(),
    ...overrides,
  })
}

/** Bootstrap store that reaches the WARM path (usable persisted cache). */
function warmBootstrapStore(overrides = {}) {
  return createMockBootstrapStore({
    isReady: false,
    hasUsableCache: true,
    phase: 'idle',
    etag: null,
    setPhase: vi.fn(),
    setError: vi.fn(),
    setConfig: vi.fn(),
    setGifts: vi.fn(),
    setEtag: vi.fn(),
    invalidateConfig: vi.fn(),
    markReadyFromCache: vi.fn(),
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

/** Auth store with no token — keeps sync/reconcile scheduling out of the picture. */
function tokenlessAuthStore(overrides = {}) {
  return createMockAuthStore({
    token: null,
    user: null,
    ...overrides,
  })
}

/** api() mock that fires onResponse with a given status/etag, then resolves/rejects like ofetch. */
function apiWithResponse(status: number, etagHeader: string | null, body: unknown) {
  return vi.fn(async (
    _url: string,
    options?: { onResponse?: (ctx: { response: { status: number; headers: Headers } }) => void },
  ) => {
    options?.onResponse?.({
      response: { status, headers: new Headers(etagHeader ? { etag: etagHeader } : {}) },
    })
    if (status === 304) return undefined
    return { data: body }
  })
}

/** Grabs the Nth callback scheduled via scheduleAfterFirstPaint (0-indexed). */
function scheduledCallback(index: number): () => void {
  const mock = vi.mocked(scheduleAfterFirstPaint)
  const call = mock.mock.calls[index]
  if (!call) throw new Error(`scheduleAfterFirstPaint was not called a ${index + 1}th time`)
  return call[0] as () => void
}

/**
 * The scheduled revalidate callback is fire-and-forget (`() => void revalidate()`)
 * — it returns `undefined`, not the inner promise. Run it, then flush the
 * macrotask queue so its internal `await`s (api call, onResponse, apply) settle.
 */
async function runAndFlush(cb: () => void): Promise<void> {
  cb()
  await new Promise(resolve => setTimeout(resolve, 0))
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

  describe('GATE: warm cache short-circuit', () => {
    it('should return null without API when the persisted cache is usable', async () => {
      _mocks = setupNuxtMocks({
        authStore: tokenlessAuthStore(),
        bootstrapStore: warmBootstrapStore(),
        api: createMockApi(),
        cookieValue: null,
      })

      const { init } = useBootstrapInit()
      const result = await init()
      expect(result).toBeNull()
      expect(_mocks.api.api).not.toHaveBeenCalled()
    })

    it('should use token from auth store and fetch on the cold path', async () => {
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
    it('should skip fetch when the persisted cache is usable', async () => {
      const api = createMockApi()
      _mocks = setupNuxtMocks({
        authStore: createMockAuthStore({ token: 'token', user: { id: 1 } }),
        bootstrapStore: warmBootstrapStore(),
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

    it('should NOT call invalidateConfig or api when a fetch is already in progress', async () => {
      const api = createMockApi()
      const bootstrapStore = gatePassingBootstrapStore({ phase: 'loading' })
      _mocks = setupNuxtMocks({ bootstrapStore, api })

      const { init } = useBootstrapInit()
      await init()
      expect(bootstrapStore.invalidateConfig).not.toHaveBeenCalled()
      expect(api.api).not.toHaveBeenCalled()
    })
  })

  // ========================================
  // EXECUTE Tests (cold path)
  // ========================================

  describe('EXECUTE: Critical data fetch (cold path)', () => {
    it('should call API with no If-None-Match header', async () => {
      const api = createMockApi()
      api.api.mockResolvedValue({ data: { user: { id: 1 }, config: {} } })
      _mocks = setupNuxtMocks({
        api,
        authStore: gatePassingAuthStore(),
        bootstrapStore: gatePassingBootstrapStore(),
      })

      const { init } = useBootstrapInit()
      await init()
      expect(api.api).toHaveBeenCalledWith('/bootstrap', expect.objectContaining({ headers: undefined }))
    })

    it('should call invalidateConfig("all") before the API request', async () => {
      const api = createMockApi()
      api.api.mockResolvedValue({ data: {} })
      const bootstrapStore = gatePassingBootstrapStore()
      _mocks = setupNuxtMocks({
        api,
        authStore: gatePassingAuthStore(),
        bootstrapStore,
      })

      const { init } = useBootstrapInit()
      await init()
      expect(bootstrapStore.invalidateConfig).toHaveBeenCalledWith('all')
      const invalidateOrder = bootstrapStore.invalidateConfig.mock.invocationCallOrder[0]!
      const apiOrder = api.api.mock.invocationCallOrder[0]!
      expect(invalidateOrder).toBeLessThan(apiOrder)
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

    it('should stamp the etag from a 200 response, going loading → complete', async () => {
      const bootstrapStore = gatePassingBootstrapStore()
      const api = createMockApi()
      api.api = apiWithResponse(200, 'W/"cold-tag"', { user: {}, config: {} })
      _mocks = setupNuxtMocks({
        bootstrapStore,
        authStore: gatePassingAuthStore(),
        api,
      })

      const { init } = useBootstrapInit()
      await init()
      expect(bootstrapStore.setEtag).toHaveBeenCalledWith('W/"cold-tag"')
      expect(bootstrapStore.setPhase).toHaveBeenNthCalledWith(1, 'loading')
      expect(bootstrapStore.setPhase).toHaveBeenNthCalledWith(2, 'complete')
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

  describe('EXECUTE: Error handling (cold path)', () => {
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
  // Warm-open + background revalidate
  // ========================================

  describe('Warm open', () => {
    it('calls markReadyFromCache and does not call the API before the scheduled callback runs', async () => {
      const bootstrapStore = warmBootstrapStore()
      const api = createMockApi()
      _mocks = setupNuxtMocks({
        bootstrapStore,
        authStore: tokenlessAuthStore(),
        api,
      })

      const { init } = useBootstrapInit()
      const result = await init()

      expect(result).toBeNull()
      expect(bootstrapStore.markReadyFromCache).toHaveBeenCalled()
      expect(api.api).not.toHaveBeenCalled()
    })

    it('revalidate sends If-None-Match with the stored etag when propIndex is non-empty', async () => {
      const bootstrapStore = warmBootstrapStore({ etag: 'W/"abc"' })
      const api = createMockApi()
      api.api = apiWithResponse(304, null, null)
      const mallStore = createMockMallStore({ propIndex: { 1: { id: 1 } } })
      _mocks = setupNuxtMocks({
        bootstrapStore,
        authStore: tokenlessAuthStore(),
        api,
        mallStore,
      })

      const { init } = useBootstrapInit()
      await init()
      await runAndFlush(scheduledCallback(0))

      expect(api.api).toHaveBeenCalledWith('/bootstrap', expect.objectContaining({
        headers: { 'If-None-Match': 'W/"abc"' },
      }))
    })

    it('revalidate sends no If-None-Match when propIndex is empty', async () => {
      const bootstrapStore = warmBootstrapStore({ etag: 'W/"abc"' })
      const api = createMockApi()
      api.api = apiWithResponse(200, 'W/"new"', {})
      const mallStore = createMockMallStore({ propIndex: {} })
      _mocks = setupNuxtMocks({
        bootstrapStore,
        authStore: tokenlessAuthStore(),
        api,
        mallStore,
      })

      const { init } = useBootstrapInit()
      await init()
      await runAndFlush(scheduledCallback(0))

      expect(api.api).toHaveBeenCalledWith('/bootstrap', expect.objectContaining({ headers: undefined }))
    })

    it('revalidate sends no If-None-Match when etag is null', async () => {
      const bootstrapStore = warmBootstrapStore({ etag: null })
      const api = createMockApi()
      api.api = apiWithResponse(200, 'W/"new"', {})
      const mallStore = createMockMallStore({ propIndex: { 1: { id: 1 } } })
      _mocks = setupNuxtMocks({
        bootstrapStore,
        authStore: tokenlessAuthStore(),
        api,
        mallStore,
      })

      const { init } = useBootstrapInit()
      await init()
      await runAndFlush(scheduledCallback(0))

      expect(api.api).toHaveBeenCalledWith('/bootstrap', expect.objectContaining({ headers: undefined }))
    })

    it('304 touches nothing: no setConfig/seedPropIndex/setEtag/setPhase/setError', async () => {
      const bootstrapStore = warmBootstrapStore({ etag: 'W/"abc"' })
      const api = createMockApi()
      api.api = apiWithResponse(304, null, null)
      const mallStore = createMockMallStore({ propIndex: { 1: { id: 1 } } })
      _mocks = setupNuxtMocks({
        bootstrapStore,
        authStore: tokenlessAuthStore(),
        api,
        mallStore,
      })

      const { init } = useBootstrapInit()
      await init()
      await runAndFlush(scheduledCallback(0))

      expect(bootstrapStore.setConfig).not.toHaveBeenCalled()
      expect(mallStore.seedPropIndex).not.toHaveBeenCalled()
      expect(bootstrapStore.setEtag).not.toHaveBeenCalled()
      expect(bootstrapStore.setPhase).not.toHaveBeenCalled()
      expect(bootstrapStore.setError).not.toHaveBeenCalled()
    })

    it('200 swaps store + tag: setConfig, seedPropIndex, setEtag — setPhase not called', async () => {
      const bootstrapStore = warmBootstrapStore({ etag: 'W/"abc"' })
      const config = { api_version: 'v1', props: [{ id: 1, name: 'p' }] }
      const api = createMockApi()
      api.api = apiWithResponse(200, 'W/"new"', config)
      const mallStore = createMockMallStore({ propIndex: { 1: { id: 1 } } })
      _mocks = setupNuxtMocks({
        bootstrapStore,
        authStore: tokenlessAuthStore(),
        api,
        mallStore,
      })

      const { init } = useBootstrapInit()
      await init()
      await runAndFlush(scheduledCallback(0))

      expect(bootstrapStore.setConfig).toHaveBeenCalledWith(config)
      expect(mallStore.seedPropIndex).toHaveBeenCalledWith(config.props)
      expect(bootstrapStore.setEtag).toHaveBeenCalledWith('W/"new"')
      expect(bootstrapStore.setPhase).not.toHaveBeenCalled()
    })

    it('200 with no ETag header stores etag as null', async () => {
      const bootstrapStore = warmBootstrapStore({ etag: 'W/"abc"' })
      const api = createMockApi()
      api.api = apiWithResponse(200, null, {})
      const mallStore = createMockMallStore({ propIndex: { 1: { id: 1 } } })
      _mocks = setupNuxtMocks({
        bootstrapStore,
        authStore: tokenlessAuthStore(),
        api,
        mallStore,
      })

      const { init } = useBootstrapInit()
      await init()
      await runAndFlush(scheduledCallback(0))

      expect(bootstrapStore.setEtag).toHaveBeenCalledWith(null)
    })

    it('api rejection during revalidate is swallowed: setPhase/setError not called, nothing thrown', async () => {
      const bootstrapStore = warmBootstrapStore({ etag: 'W/"abc"' })
      const api = createMockApi()
      api.api = vi.fn().mockRejectedValue(new Error('network down'))
      const mallStore = createMockMallStore({ propIndex: { 1: { id: 1 } } })
      _mocks = setupNuxtMocks({
        bootstrapStore,
        authStore: tokenlessAuthStore(),
        api,
        mallStore,
      })

      const { init } = useBootstrapInit()
      await init()

      await expect(runAndFlush(scheduledCallback(0))).resolves.toBeUndefined()
      expect(bootstrapStore.setPhase).not.toHaveBeenCalled()
      expect(bootstrapStore.setError).not.toHaveBeenCalled()
    })

    it('two warm init() calls dedupe: running both revalidate callbacks calls the API once', async () => {
      const bootstrapStore = warmBootstrapStore({ etag: 'W/"abc"' })
      const api = createMockApi()
      api.api = apiWithResponse(304, null, null)
      const mallStore = createMockMallStore({ propIndex: { 1: { id: 1 } } })
      _mocks = setupNuxtMocks({
        bootstrapStore,
        authStore: tokenlessAuthStore(),
        api,
        mallStore,
      })

      const { init } = useBootstrapInit()
      await init()
      await init()

      const cb1 = scheduledCallback(0)
      const cb2 = scheduledCallback(1)
      // Fire both without awaiting in between — the second must see the
      // in-flight guard set by the first before its own `await` runs.
      cb1()
      cb2()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(api.api).toHaveBeenCalledTimes(1)
    })
  })

  describe('Cold open', () => {
    it('calls invalidateConfig("all") before the API call, with no If-None-Match', async () => {
      const bootstrapStore = gatePassingBootstrapStore()
      const api = createMockApi()
      api.api = apiWithResponse(200, 'W/"cold"', {})
      _mocks = setupNuxtMocks({
        bootstrapStore,
        authStore: tokenlessAuthStore(),
        api,
      })

      const { init } = useBootstrapInit()
      await init()

      expect(bootstrapStore.invalidateConfig).toHaveBeenCalledWith('all')
      const invalidateOrder = bootstrapStore.invalidateConfig.mock.invocationCallOrder[0]!
      const apiOrder = api.api.mock.invocationCallOrder[0]!
      expect(invalidateOrder).toBeLessThan(apiOrder)
      expect(api.api).toHaveBeenCalledWith('/bootstrap', expect.objectContaining({ headers: undefined }))
      expect(bootstrapStore.setEtag).toHaveBeenCalledWith('W/"cold"')
      expect(bootstrapStore.setPhase).toHaveBeenNthCalledWith(1, 'loading')
      expect(bootstrapStore.setPhase).toHaveBeenNthCalledWith(2, 'complete')
    })

    it('phase "loading" short-circuits: returns null, invalidateConfig and api NOT called', async () => {
      const bootstrapStore = gatePassingBootstrapStore({ phase: 'loading' })
      const api = createMockApi()
      _mocks = setupNuxtMocks({
        bootstrapStore,
        authStore: tokenlessAuthStore(),
        api,
      })

      const { init } = useBootstrapInit()
      const result = await init()

      expect(result).toBeNull()
      expect(bootstrapStore.invalidateConfig).not.toHaveBeenCalled()
      expect(api.api).not.toHaveBeenCalled()
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

    // A failed cold fetch leaves gifts/badges/VIP discarded; an asset pass would
    // run the catalog-diff eviction against that empty catalog and delete every
    // cached animation.
    it('should NOT start asset download when the cold fetch fails (fresh auth)', async () => {
      const bootstrapAssets = createMockBootstrapAssets()
      const api = createMockApi()
      api.api.mockRejectedValue(new Error('Network error'))
      _mocks = setupNuxtMocks({
        bootstrapAssets,
        api,
        authStore: gatePassingAuthStore(),
        bootstrapStore: gatePassingBootstrapStore(),
        route: { path: '/mall', meta: { middleware: [] } },
      })

      const { init } = useBootstrapInit()
      await init({ freshAuth: true })
      expect(bootstrapAssets.startAssetDownload).not.toHaveBeenCalled()
    })

    it('should NOT schedule asset download when the cold fetch fails (non-home route)', async () => {
      const bootstrapAssets = createMockBootstrapAssets()
      const api = createMockApi()
      api.api.mockRejectedValue(new Error('Network error'))
      _mocks = setupNuxtMocks({
        bootstrapAssets,
        api,
        authStore: gatePassingAuthStore(),
        bootstrapStore: gatePassingBootstrapStore(),
        route: { path: '/mall', meta: { middleware: [] } },
      })

      const { init } = useBootstrapInit()
      await init()
      expect(bootstrapAssets.startAssetDownload).not.toHaveBeenCalled()
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
