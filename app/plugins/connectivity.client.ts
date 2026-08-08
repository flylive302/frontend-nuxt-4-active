// ========================================
// Connectivity Plugin (frontend-offline-resilience/01 — ADR 0026)
// ========================================
//
// Thin INTENT trigger. All pipeline logic lives in `useConnectivityMonitor`.
//
// Also owns the ONE case where the full-screen `/offline` page is correct: a
// NATIVE cold boot with no network. Everywhere else a drop shows the
// non-blocking banner instead, because a takeover would eject a user from a
// live audio room on a transient blip (ADR 0026).
//
// ⚠️ Web is deliberately excluded from the cold-boot redirect, and it is not an
// oversight. ADR 0020 removed the service worker on every platform, so a web
// cold boot with no network never runs this code at all — the browser shows its
// own error page. Only the Capacitor build, whose bundle is local, can boot
// offline. A web-side redirect here would be unreachable code.

import { Capacitor } from '@capacitor/core'
import { createLogger } from '~/utils/logger'

const log = createLogger('[ConnectivityPlugin]')

/** Routes that must never be replaced by the offline screen. */
const COLD_BOOT_REDIRECT_EXEMPT = ['/offline']

export default defineNuxtPlugin((nuxtApp) => {
  const { start } = useConnectivityMonitor()

  // Never torn down on purpose: connectivity is app-scoped, and Nuxt exposes no
  // runtime "app unmounted" hook to hang cleanup on. `start()` still RETURNS a
  // teardown because the unit tests drive it directly.
  start()

  // GATE — native only; web cannot reach this state (see the header note).
  if (!Capacitor.isNativePlatform()) return

  // GATE — `navigator.onLine` is a LINK check: sync, free, and adds nothing to
  // boot latency. It misses a captive portal at boot, which is accepted: the
  // banner path catches that a moment later on the first failed API call. A
  // `probeHealth()` here would instead put a round trip in front of every cold
  // boot, including the ~99% that are online.
  // ⚠️ `=== false`, not truthiness — some environments define `navigator`
  // without `onLine`, where a truthiness check reads as "offline".
  if (typeof navigator === 'undefined' || navigator.onLine !== false) return

  nuxtApp.hook('app:mounted', () => {
    const route = useRoute()
    if (COLD_BOOT_REDIRECT_EXEMPT.includes(route.path)) return

    log.warn('Cold boot with no network — showing the offline screen')
    void navigateTo('/offline', { replace: true })
  })
})
