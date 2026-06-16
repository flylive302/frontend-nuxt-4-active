import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

/**
 * Native status-bar styling (Capacitor only) — capacitor-05.
 *
 * Edge-to-edge itself is handled natively: `EdgeToEdge.enable()` in MainActivity
 * + the SafeArea plugin feed system-bar insets to CSS `env(safe-area-inset-*)`.
 * This plugin only sets the status-bar *icon* style for legibility.
 *
 * FlyLive ships a dark UI (`htmlAttrs.class: 'dark'`, black top content), so we
 * want light icons. Per Capacitor's enum, `Style.Dark` = "light text for dark
 * backgrounds" — counter-intuitive but correct.
 *
 * `setOverlaysWebView` is a best-effort no-op on the target build (Android 16 /
 * SDK 36 enforces edge-to-edge and ignores it); kept only so pre-Android-15
 * devices still draw behind a transparent bar. Each call is guarded so a missing
 * platform capability never blocks bootstrap.
 *
 * No-ops on the web build.
 */
export default defineNuxtPlugin(async () => {
  if (!Capacitor.isNativePlatform()) return

  const log = createLogger('[StatusBar]')

  try {
    await StatusBar.setStyle({ style: Style.Dark })
  } catch (error) {
    log.warn('setStyle failed', error)
  }

  try {
    await StatusBar.setOverlaysWebView({ overlay: true })
  } catch (error) {
    log.warn('setOverlaysWebView unavailable (expected on Android 15+)', error)
  }
})
