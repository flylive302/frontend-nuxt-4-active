// ========================================
// Stale-deploy chunk recovery
// ========================================
//
// Cloudflare Pages serves content-hashed chunks; a deploy invalidates the
// hashes an already-open tab knows about, so its next lazy import 404s
// ("Failed to fetch dynamically imported module"). The only real recovery
// is a full reload against the new manifest. Two signals cover both paths:
//  - `app:chunkError`   → route-level chunks (router navigation)
//  - `vite:preloadError`→ any other dynamic import (Lazy components, hls.js…)
//  - `router.onError`  → route component resolution (see below)
// A session-scoped timestamp guards against a reload loop if the network
// itself is broken (offline → every chunk fails, reload wouldn't help).
//
// The third signal is NOT redundant. Nuxt emits `app:chunkError` solely from the
// `vite:preloadError` window event (nuxt/dist/app/nuxt.js), so a lazy route
// component whose import resolves EMPTY never reaches either of the first two —
// vue-router rejects the navigation itself with `Couldn't resolve component
// "default" at "<path>"`, which only surfaces through `router.onError`. Without
// this the user sits on a dead route with no reload (Sentry: JAVASCRIPT-VUE-5Y).
// ========================================

// GATE lives in `~/utils/stale-bundle-error` so it can be unit-tested; the
// plugin itself is not testable in isolation.
import { isStaleBundleError } from '~/utils/stale-bundle-error'

import { markReloadIntent } from '~/utils/reload-intent'
import { markReloadCause, type RecordableReloadCause } from '~/utils/reload-telemetry'

const RELOAD_GUARD_KEY = 'chunk-reload-at'
const RELOAD_GUARD_WINDOW_MS = 60_000

export default defineNuxtPlugin((nuxtApp) => {
  const log = createLogger('[ChunkReload]')

  function reloadOnce(cause: RecordableReloadCause, detail: string): void {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0)
    if (Date.now() - last < RELOAD_GUARD_WINDOW_MS) {
      // Suppressed, so no reload happens and there is nothing to record.
      log.warn('Chunk load failed again within guard window — not reloading', detail)
      return
    }
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
    log.warn('Stale chunk detected — reloading against new deploy', detail)
    // Leave a queryable record of WHY this reload happened. The suppression
    // below is correct and stays, but it must not leave the reload invisible —
    // the next boot reads this marker and reports it (see
    // `plugins/reload-telemetry.client.ts`).
    markReloadCause(cause, detail, window.location.pathname)
    // Tell the room lifecycle this unload is a reload, not a close, so it skips
    // the `room:leave` emit and lets MSAB's disconnect grace hold the seat.
    markReloadIntent()
    reloadNuxtApp({ persistState: true, force: true })
  }

  nuxtApp.hook('app:chunkError', ({ error }) => {
    reloadOnce('chunk-preload', String(error))
  })

  window.addEventListener('vite:preloadError', (event) => {
    // Prevent Vite from rethrowing (which lands in Sentry as unhandled).
    event.preventDefault()
    reloadOnce('chunk-preload', String((event as unknown as { payload?: unknown }).payload))
  })

  // Route-component resolution failures never reach the two hooks above.
  // Filtered, so a genuine navigation error still propagates to the error page
  // instead of being masked by a reload loop.
  const router = useRouter()
  router.onError((error: unknown) => {
    if (!isStaleBundleError(error)) return
    reloadOnce('router-resolve', String(error))
  })
})
