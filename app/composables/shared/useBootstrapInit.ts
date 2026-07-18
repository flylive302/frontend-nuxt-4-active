// ========================================
// Bootstrap Init Composable
// ========================================
// Role: Action/Orchestrator — owns the bootstrap fetch pipeline.
// Pipeline: GATE → EXECUTE → REACT

import type { BootstrapConfig } from '~/types/user/bootstrap'
import { createLogger } from '~/utils/logger'
import { scheduleAfterFirstPaint } from '~/utils/schedule-after-first-paint'

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
  const mallStore = useMallStore()
  const { trackBootstrapStarted, trackBootstrapCompleted, trackBootstrapFailed } = useTelemetry()
  const { startAssetDownload } = useBootstrapAssets()
  const { syncUser } = useUserSync()
  const { reconcileInbox } = useInboxReconcile()

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
  async function init(options?: { freshAuth?: boolean }): Promise<BootstrapConfig | null> {
    // Capture route synchronously before any await — calling useRoute() after an
    // await can land in a middleware execution context and trigger a Nuxt warning.
    const route = useRoute()

    // GATE — skip on OAuth callback route (callback page handles its own auth flow)
    if (route.path === '/callback') {
      return null
    }

    // Background user re-hydration — persisted user is good enough for initial render.
    // Pinia-persist restores token from a durable cookie and user from localStorage;
    // this API call patches stale data.
    // PERF: defer past first paint so /auth/user stays off the LCP-critical chain.
    if (authStore.token) {
      scheduleAfterFirstPaint(() => {
        void syncUser()
        // App foreground/bootstrap reconcile trigger (issue 03,
        // dm-realtime-platform) — closes the gap for any inbox realtime
        // hint missed while the app was closed/backgrounded.
        void reconcileInbox('bootstrap')
      })
    }

    // GATE — check freshness
    if (!bootstrapStore.needsRefresh) {
      // Still schedule asset downloads — may have new items since last boot
      if (options?.freshAuth) {
        startAssetDownload()
      } else {
        scheduleAssetDownload(route)
      }
      return null
    }

    // GATE
    if (isFetchInProgress()) {
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

    // REACT — fresh auth (registration/OAuth): start immediately so the profile wizard's
    // interaction time is used as free download time. Returning users stay idle-deferred.
    if (options?.freshAuth) {
      startAssetDownload()
    } else {
      scheduleAssetDownload(route)
    }

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

        // Cross-store seed: bootstrap delivers props manifest → mallStore owns prop data
        if (criticalData.props?.length) {
          mallStore.seedPropIndex(criticalData.props)
        }
      }

      // Mark bootstrap complete — UI can render
      bootstrapStore.setPhase('complete')

      return criticalData as BootstrapConfig

    } catch (e) {
      log.warn('Failed to fetch bootstrap data', e)
      const normalized = normalizeError(e)
      bootstrapStore.setError(normalized.message)
      bootstrapStore.setPhase('error')
      return null
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
  function scheduleAssetDownload(route: ReturnType<typeof useRoute>): void {
    if (!authStore.token) return
    // Home is on the critical perf path: avoid boot-time badge/image floods there.
    // Route-scoped assets still load when users navigate to their feature pages.
    if (route.path === '/' || route.path === '') return

    const schedule = typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 100)

    schedule(() => {
      startAssetDownload()
    })
  }

  return { init }
}
