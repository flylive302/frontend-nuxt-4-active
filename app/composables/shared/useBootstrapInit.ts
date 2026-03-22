// ========================================
// Bootstrap Init Composable
// ========================================
// Role: Action/Orchestrator — owns the bootstrap fetch pipeline.
// Pipeline: GATE → EXECUTE → REACT

import type { BootstrapResponse } from '~/types/user/bootstrap'
import { createLogger } from '~/utils/logger'

const log = createLogger('[BootstrapInit]')

// ========================================
// Composable
// ========================================

/**
 * Orchestrates app bootstrap: fetch data, seed stores.
 *
 * On app start (if authenticated):
 * 1. GATE — resolve auth token, skip guest routes
 * 2. EXECUTE — fetch bootstrap API, seed stores
 * 3. REACT — fire deferred data load, telemetry
 */
export function useBootstrapInit() {
  const { api, normalizeError } = useApi()
  const authStore = useAuthStore()
  const bootstrapStore = useBootstrapStore()
  const levelsStore = useLevelsStore()
  const { trackBootstrapStarted, trackBootstrapCompleted, trackBootstrapFailed } = useTelemetry()
  const { startAssetDownload } = useBootstrapAssets()

  // ========================================
  // GATE Helpers
  // ========================================

  /**
   * Resolve auth token from Pinia persisted state or cookie.
   * Returns null if no token (unauthenticated).
   */
  function resolveToken(): string | null {
    const storedToken = authStore.token
    const cookieToken = useCookie('sanctum_token')
    const token = storedToken || cookieToken.value

    if (!token) {
      log.debug('No auth token found, skipping bootstrap')
      return null
    }

    // Migrate cookie token to Pinia store (backwards compatibility)
    if (!storedToken && cookieToken.value) {
      log.debug('Migrating token from cookie to store')
      authStore.setToken(cookieToken.value)
    }

    return token
  }

  /**
   * Check if current route is a guest-only route (login, register, etc.)
   * that should skip bootstrap entirely.
   */
  function isGuestRoute(): boolean {
    const route = useRoute()
    const middleware = route.meta.middleware
    return Array.isArray(middleware)
      ? middleware.includes('guest')
      : middleware === 'guest'
  }

  // ========================================
  // Public API
  // ========================================

  /**
   * Full bootstrap init — called by plugin on app start.
   *
   * GATE: Check auth, skip guest routes, check freshness
   * EXECUTE: Fetch + seed stores
   * REACT: Start asset downloads (via caller)
   */
  async function init(): Promise<BootstrapResponse | null> {
    // GATE — skip guest routes
    if (isGuestRoute()) {
      if (authStore.token) {
        log.debug('Guest route with stale token, clearing')
        authStore.logout()
      }
      return null
    }

    // GATE — check auth token
    const token = resolveToken()
    if (!token) return null

    // GATE — check freshness
    const needsFetch = !authStore.user || bootstrapStore.needsRefresh
    if (!needsFetch && bootstrapStore.isReady) {
      log.debug('Bootstrap data fresh, skipping fetch')
      return null
    }

    // REACT — telemetry start (fire-and-forget)
    trackBootstrapStarted()
    const startTime = Date.now()

    // EXECUTE
    const data = await fetchBootstrap()

    // REACT — telemetry completion
    if (data) {
      trackBootstrapCompleted(Date.now() - startTime)
    } else if (bootstrapStore.hasError) {
      trackBootstrapFailed(bootstrapStore.error ?? 'Unknown error')
    }

    // REACT — start asset downloads in background if gifts are available
    if (data?.gifts?.catalog?.length || bootstrapStore.giftCatalog.length > 0) {
      startAssetDownload()
    }

    return data
  }

  // ========================================
  // GATE Helpers (continued)
  // ========================================

  /**
   * Check if bootstrap fetch is already in progress.
   */
  function isFetchInProgress(): boolean {
    return bootstrapStore.phase === 'loading'
  }

  // ========================================
  // EXECUTE Helpers
  // ========================================

  /**
   * Fetch bootstrap data from API in two phases:
   * 1. Critical: user + config (fast, unblocks UI)
   * 2. Deferred: gifts + user_data (background, non-blocking)
   */
  async function fetchBootstrap(): Promise<BootstrapResponse | null> {
    // GATE
    if (isFetchInProgress()) {
      log.warn('Bootstrap already in progress')
      return null
    }

    bootstrapStore.setPhase('loading')
    bootstrapStore.setError(null)

    try {
      // EXECUTE — Phase 1: Critical path (user + config)
      const criticalResponse = await api<{ status: string; message: string; data: Partial<BootstrapResponse> }>(
        '/bootstrap?fields=user,config'
      )
      const criticalData = criticalResponse.data

      // Seed bootstrap store with config
      if (criticalData.config) {
        bootstrapStore.setConfig(criticalData.config)
      }

      // Seed auth store with user
      if (criticalData.user) {
        authStore.setUser(criticalData.user)
      }

      // Mark bootstrap complete — UI can render
      bootstrapStore.setPhase('complete')

      // EXECUTE (deferred) — seed stores with non-critical data
      fetchDeferredData().catch((e) => {
        log.warn('Deferred data fetch failed (non-blocking):', e)
      })

      return criticalData as BootstrapResponse
    } catch (e) {
      log.error('Bootstrap raw error:', e)
      const normalized = normalizeError(e)
      bootstrapStore.setError(normalized.message)
      bootstrapStore.setPhase('error')
      log.error('Bootstrap failed:', normalized.message, normalized)
      return null
    }
  }

  /**
   * EXECUTE (deferred) — fetch non-critical bootstrap sections.
   * Seeds gift catalog and level data into stores.
   * Non-blocking: failures are logged, app remains usable.
   */
  async function fetchDeferredData(): Promise<void> {
    try {
      const deferredResponse = await api<{ status: string; message: string; data: Partial<BootstrapResponse> }>(
        '/bootstrap?fields=gifts,user_data'
      )
      const data = deferredResponse.data

      if (data.gifts) {
        bootstrapStore.setGifts(data.gifts.catalog, data.gifts.total)
      }

      // Seed levels store from deferred user_data
      if (data.user_data?.levels) {
        levelsStore.setLevels(data.user_data.levels.wealth, data.user_data.levels.charm)
      }

      log.info('Deferred bootstrap data loaded')
    } catch (e) {
      log.warn('Failed to load deferred bootstrap data:', e)
    }
  }

  return {
    init,
    fetchBootstrap,
  }
}
