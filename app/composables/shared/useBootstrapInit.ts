// ========================================
// Bootstrap Init Composable
// ========================================
// Role: Action/Orchestrator — owns the bootstrap fetch pipeline.
// Pipeline: GATE → EXECUTE → REACT

import type { BootstrapConfig, BootstrapUser } from '~/types/user/bootstrap'
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
 * 3. REACT — fire-deferred data load, telemetry
 */
export function useBootstrapInit() {
  const { api, normalizeError } = useApi()
  const bootstrapStore = useBootstrapStore()
  const authStore = useAuthStore()
  const { trackBootstrapStarted, trackBootstrapCompleted, trackBootstrapFailed } = useTelemetry()
  const { startAssetDownload } = useBootstrapAssets()

  // ========================================
  // Public API
  // ========================================

  /**
   * Full bootstrap init — called by plugin on app start.
   *
   * GATE: skip guest routes, check freshness
   * EXECUTE: Fetch and seed stores
   * REACT: Start asset downloads (via caller)
   */
  async function init(): Promise<BootstrapConfig | null> {

    // GATE — skip on OAuth callback route (callback page handles its own auth flow)
    const route = useRoute()
    if (route.path === '/callback') {
      log.debug('On callback route, deferring to callback handler')
      return null
    }

    // Background user re-hydration — persisted user is good enough for initial render.
    // Pinia-persist restores user from localStorage; this API call patches stale data.
    // PERF: fire-and-forget — never blocks rendering.
    if (authStore.token) {
      refreshUser()
    }

    // GATE — check freshness
    if (!bootstrapStore.needsRefresh) {
      log.debug('Bootstrap data fresh, skipping fetch')
      // Still schedule asset downloads — may have new items since last boot
      scheduleAssetDownload()
      return null
    }

    // GATE
    if (isFetchInProgress()) {
      log.warn('Bootstrap already in progress')
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
    } else if (bootstrapStore.phase === 'error') {
      trackBootstrapFailed(bootstrapStore.error ?? 'Unknown error')
    }

    // REACT — defer asset downloads to idle time, never block rendering
    scheduleAssetDownload()

    return data
  }

  // ========================================
  // GATE Helpers
  // ========================================

  /**
   * Fetch bootstrap data from the API in two phases:
   * 1. Critical: user and config (fast, unblocks UI)
   * 2. Deferred: gifts + user_data (background, non-blocking)
   */
  async function fetchBootstrap(): Promise<BootstrapConfig | null> {

    bootstrapStore.setPhase('loading')
    bootstrapStore.setError(null)

    try {
      // EXECUTE — Phase 1: Critical path (user + config)
      const criticalResponse = await api<{ status: string; message: string; data: BootstrapConfig }>(
        '/bootstrap'
      )
      const criticalData = criticalResponse.data
      // Seed bootstrap store with config
      if (criticalData) {
        bootstrapStore.setConfig(criticalData)
      }

      // Mark bootstrap complete — UI can render
      bootstrapStore.setPhase('complete')

      return criticalData as BootstrapConfig

    } catch (e) {
      const normalized = normalizeError(e)
      bootstrapStore.setError(normalized.message)
      bootstrapStore.setPhase('error')
      log.error('Bootstrap failed:', normalized)
      return null
    }
  }


  /**
   * Re-fetch the authenticated user and seed authStore.
   * Runs on every boot so a force-kill + reopen never leaves user=null.
   */
  async function refreshUser(): Promise<void> {
    try {
      const response = await api<{ data: BootstrapUser }>('/auth/user')
      if (response?.data) {
        authStore.setUser(response.data)
      }
    } catch {
      log.warn('Failed to refresh user on boot — proceeding with persisted state')
    }
  }

  /**
   * Check if bootstrap fetch is already in progress.
   */
  function isFetchInProgress(): boolean {
    return bootstrapStore.phase === 'loading'
  }

  /**
   * Schedule asset download during idle time.
   * Uses requestIdleCallback where available, falls back to setTimeout.
   * PERF: never blocks the main thread during boot.
   * PERF: skipped for unauthenticated users — gifts/badges are irrelevant on guest routes.
   */
  function scheduleAssetDownload(): void {
    if (!authStore.token) return

    const schedule = typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 100)

    schedule(() => {
      startAssetDownload()
    })
  }

  return { init }
}
