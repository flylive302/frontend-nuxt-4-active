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

/** `/bootstrap` envelope. */
interface BootstrapResponse {
  status: string
  message: string
  data: BootstrapConfig
}

/** One `/bootstrap` round trip: status, payload (null on 304) and its validator. */
interface BootstrapResult {
  status: number
  data: BootstrapConfig | null
  etag: string | null
}

/**
 * Orchestrates app bootstrap: render the catalog, keep it current.
 *
 * Warm open (persisted catalog of the current shape): ready before any request,
 * then a background `If-None-Match` revalidate — 304 changes nothing, 200 swaps
 * store + tag (boot-and-asset-delivery 07).
 * Cold open (nothing persisted, or a shape mismatch): discard, fetch, seed.
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

  /** Dedupes the background revalidate (plugin start + the login watcher). */
  let revalidating = false

  // ========================================
  // Public API
  // ========================================

  /**
   * Full bootstrap init — called by plugin on app start.
   *
   * GATE: skip the OAuth callback, pick the warm or cold path
   * EXECUTE: warm → ready from cache + background revalidate; cold → fetch and seed
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

    // GATE — warm path: the persisted catalog renders this open, no request first
    if (bootstrapStore.hasUsableCache) {
      // Config came from localStorage; `phase` did not. Flip it so `isReady`
      // consumers (level badges, seat drawer, profile) render immediately.
      bootstrapStore.markReadyFromCache()
      // Off the first-paint path: the cached-catalog cold boot (gate 1) made
      // no /bootstrap call at all, and a 200 swap recomputes every level map.
      scheduleAfterFirstPaint(() => {
        void revalidate()
      })
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

    // GATE — nothing usable persisted (fresh install, or a catalog written by
    // another shape version): discard it so no consumer reads it while the
    // cold fetch runs or after it fails.
    bootstrapStore.invalidateConfig('all')

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

    // GATE — no catalog, no asset pass. The discard above emptied gifts, badges
    // and VIP levels; the downloader's catalog-diff eviction would read that as
    // "all removed" and delete every cached animation. The next open retries.
    if (!data) {
      return null
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
   * Cold path: fetch the catalog unconditionally (nothing persisted to keep on
   * a 304) and seed the stores. `loading` → `complete` | `error`.
   */
  async function fetchBootstrap(): Promise<BootstrapConfig | null> {

    bootstrapStore.setPhase('loading')
    bootstrapStore.setError(null)

    try {
      // EXECUTE
      const result = await requestBootstrap(null)
      applyBootstrap(result)

      // Mark bootstrap complete — UI can render
      bootstrapStore.setPhase('complete')

      return result.data

    } catch (e) {
      log.warn('Failed to fetch bootstrap data', e)
      const normalized = normalizeError(e)
      bootstrapStore.setError(normalized.message)
      bootstrapStore.setPhase('error')
      return null
    }
  }


  /**
   * Warm path: revalidate the persisted catalog in the background.
   * 304 → store, tag and phase untouched. 200 → store + tag swap.
   * Failure → logged only; `phase` never moves, the cached catalog keeps rendering.
   */
  async function revalidate(): Promise<void> {
    if (revalidating) return
    revalidating = true
    try {
      const result = await requestBootstrap(revalidationTag())
      if (result.status === 304) return
      applyBootstrap(result)
    } catch (e) {
      log.warn('Background bootstrap revalidate failed; keeping the cached catalog', e)
    } finally {
      revalidating = false
    }
  }

  /**
   * GATE — the validator to send, or null to force a 200. A 304 means "keep
   * what you have", so the tag goes out only while every store the payload
   * seeds is populated; an emptied mall `propIndex` (its `reset()`) would
   * otherwise stay empty for good.
   */
  function revalidationTag(): string | null {
    if (Object.keys(mallStore.propIndex).length === 0) return null
    return bootstrapStore.etag
  }

  /**
   * EXECUTE — GET /bootstrap, conditional when a tag is given. A 304 comes back
   * from ofetch as a resolved, bodyless response (only >= 400 throws).
   */
  async function requestBootstrap(ifNoneMatch: string | null): Promise<BootstrapResult> {
    const meta: { status: number; etag: string | null } = { status: 0, etag: null }
    const response = await api<BootstrapResponse | undefined>('/bootstrap', {
      headers: ifNoneMatch ? { 'If-None-Match': ifNoneMatch } : undefined,
      // Per-call hook: ofetch spreads call options over the client defaults,
      // which define no onResponse — the default onRequest (auth) still runs.
      // Needs `ETag` in the API's CORS exposed headers (06).
      onResponse({ response: res }) {
        meta.status = res.status
        meta.etag = res.headers.get('etag')
      },
    })
    return { status: meta.status, data: response?.data ?? null, etag: meta.etag }
  }

  /**
   * EXECUTE — seed every store the payload feeds, then its validator. Shared by
   * the cold fetch and the background swap so the two cannot drift.
   */
  function applyBootstrap(result: BootstrapResult): void {
    if (!result.data) {
      bootstrapStore.setEtag(null)
      return
    }
    bootstrapStore.setConfig(result.data)

    // Cross-store seed: bootstrap delivers props manifest → mallStore owns prop data
    if (result.data.props?.length) {
      mallStore.seedPropIndex(result.data.props)
    }

    // Exactly what this 200 carried, null included: keeping an older tag after
    // a tagless 200 would let a later 304 pin data older than what we just stored.
    bootstrapStore.setEtag(result.etag)
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
