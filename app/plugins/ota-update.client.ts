import { Capacitor } from '@capacitor/core'

/**
 * OTA live-update bootstrap (Capacitor only) — capacitor-07 / ADR 0010. INTENT.
 *
 * Thin trigger: the pipeline lives in `useOtaUpdate()`. Two jobs, in order:
 *
 *  1. `notifyReady()` FIRST and awaited — confirms JS boot so Capgo cancels its
 *     auto-rollback timer (10s). Must precede any network work; a hung manifest
 *     fetch that pushed this past the timeout would silently roll every user back
 *     to the previous bundle and make OTA look broken with no error.
 *  2. `runOtaCheck()` fire-and-forget — checking/downloading a bundle must never
 *     block or delay app boot.
 *
 * No-ops on the web build.
 */
export default defineNuxtPlugin({
  name: 'ota-update',
  // `pre` so rollback-protection (`notifyAppReady`) fires before slower plugins
  // (bootstrap/echo/native-*) can `await` network work and eat Capgo's 10s
  // auto-rollback budget on a slow connection. The native bridge is up before any
  // Nuxt plugin, and this is a fast flag-set — it won't delay boot.
  enforce: 'pre',
  async setup() {
    if (!Capacitor.isNativePlatform()) return

    const log = createLogger('[OTA]')
    const ota = useOtaUpdate()

    // 1. Rollback protection — first, awaited, before anything else.
    await ota.notifyReady()

    // 2. Check for a newer compatible bundle — never block boot on it.
    ota.runOtaCheck().catch((error) => log.error('OTA check failed', error))
  },
})
