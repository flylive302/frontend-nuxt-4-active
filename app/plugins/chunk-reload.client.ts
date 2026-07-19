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
// A session-scoped timestamp guards against a reload loop if the network
// itself is broken (offline → every chunk fails, reload wouldn't help).
// ========================================

const RELOAD_GUARD_KEY = 'chunk-reload-at'
const RELOAD_GUARD_WINDOW_MS = 60_000

export default defineNuxtPlugin((nuxtApp) => {
  const log = createLogger('[ChunkReload]')

  function reloadOnce(reason: string): void {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0)
    if (Date.now() - last < RELOAD_GUARD_WINDOW_MS) {
      log.warn('Chunk load failed again within guard window — not reloading', reason)
      return
    }
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
    log.warn('Stale chunk detected — reloading against new deploy', reason)
    reloadNuxtApp({ persistState: true, force: true })
  }

  nuxtApp.hook('app:chunkError', ({ error }) => {
    reloadOnce(String(error))
  })

  window.addEventListener('vite:preloadError', (event) => {
    // Prevent Vite from rethrowing (which lands in Sentry as unhandled).
    event.preventDefault()
    reloadOnce(String((event as unknown as { payload?: unknown }).payload))
  })
})
