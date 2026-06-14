// ========================================
// Native Social Auth Composable (Capacitor)
// ========================================
// Role: Action/Orchestrator — the APP SIDE of native social auth (ADR 0011).
//
// Transport only: how the provider URL opens (system browser / Chrome Custom
// Tabs) and how the single-use exchange code travels back (custom-scheme deep
// link). The credential side is reused verbatim via `handleExchangeCode`.
//
// State machine (module-level singletons so the launcher and the deep-link
// listener share one flow):
//
//   launch(provider) → open system browser, arm timeout
//        │
//        ├─ deep link `?code=…`  → exchange → store creds → navigate   (success)
//        ├─ deep link `?error=…` → one error toast, stay on login      (failure)
//        ├─ Custom Tab dismissed, no callback within grace window      (silent cancel)
//        └─ nothing within TIMEOUT                                     (timeout feedback)
//
// Every terminal path resets the in-flight flag so a second tap works.

import {
  NATIVE_SOCIAL_AUTH_CANCEL_GRACE_MS,
  NATIVE_SOCIAL_AUTH_TIMEOUT_MS,
} from '~/constants/auth'
import { parseSocialAuthDeepLink } from '~/utils/social-auth-deep-link'
import { createLogger } from '~/utils/logger'

const log = createLogger('[NativeSocialAuth]')

// ========================================
// Module-level state (shared across calls)
// ========================================

let _inFlight = false
let _listenersRegistered = false
let _graceTimer: ReturnType<typeof setTimeout> | null = null
let _timeoutTimer: ReturnType<typeof setTimeout> | null = null

/** Idempotency guard: a callback URL is exchanged at most once (cold-start
 *  `getLaunchUrl()` and `appUrlOpen` can both deliver the same URL; the backend
 *  code is single-use, so a second exchange would 400). */
const _handledUrls = new Set<string>()

export function useNativeSocialAuth() {
  // ========================================
  // Dependencies (captured in valid Nuxt context)
  // ========================================
  const { api } = useApi()
  const { handleExchangeCode } = useOAuthCallback()
  const nuxtApp = useNuxtApp()
  let toast: ReturnType<typeof useToast> | null = null
  try {
    toast = useToast()
  } catch {
    // useToast outside setup — tolerate (listeners may fire later)
  }

  // ========================================
  // Launcher
  // ========================================

  /**
   * Open the provider's consent page in the real system browser.
   *
   * GATE:    one flow at a time (ignore double-tap)
   * EXECUTE: fetch the native-flagged OAuth URL, open Chrome Custom Tabs
   * REACT:   arm the round-trip timeout
   *
   * The result arrives asynchronously via the deep-link listener, not here.
   */
  async function launch(provider: string): Promise<void> {
    // GATE
    if (_inFlight) return

    try {
      const { data } = await api<{ data: { redirect_url: string } }>(
        `/auth/social/${provider}/redirect`,
        { query: { platform: 'native' } },
      )

      _inFlight = true
      _handledUrls.clear()
      armTimeout(provider)

      // EXECUTE — Chrome Custom Tabs (system browser, real address bar)
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url: data.redirect_url })
    } catch {
      reset()
      toast?.add({ title: `Failed to connect with ${provider}`, color: 'error' })
    }
  }

  // ========================================
  // Deep-link listener (cold-start + warm)
  // ========================================

  /**
   * Register the `appUrlOpen` listener and drain any cold-start launch URL.
   *
   * Cold start: an aggressive-OEM device can kill the backgrounded app mid-flow;
   * the deep link then relaunches it cold and only `getLaunchUrl()` carries the
   * callback — `appUrlOpen` never fires. Both paths route through `handleUrl`
   * behind the idempotency guard.
   *
   * Idempotent: registers exactly once even if called from multiple plugins.
   */
  async function registerDeepLinkListener(): Promise<void> {
    if (_listenersRegistered) return
    _listenersRegistered = true

    const { App } = await import('@capacitor/app')
    const { Browser } = await import('@capacitor/browser')

    // Warm path: deep link delivered while the app is alive.
    App.addListener('appUrlOpen', (event) => {
      void handleUrl(event.url)
    })

    // App resumed to foreground. On Android a back-button dismissal of the
    // Custom Tab does not reliably emit `browserFinished`, so resume is the
    // second cancel signal — both route through the same grace window, so a
    // genuine success (resume + appUrlOpen fire together) still wins the race.
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) onBrowserDismissed()
    })

    // Cold-start path: app was killed; the launch URL carries the callback.
    try {
      const launch = await App.getLaunchUrl()
      if (launch?.url) void handleUrl(launch.url)
    } catch (err) {
      log.warn('getLaunchUrl failed', err)
    }

    // Custom Tab dismissed by the user → maybe a silent cancel (see grace).
    Browser.addListener('browserFinished', () => {
      onBrowserDismissed()
    })
  }

  // ========================================
  // Helpers
  // ========================================

  /**
   * Handle a single deep-link URL: parse → exchange → navigate.
   * The deep-link callback is the single source of truth for success/failure.
   */
  async function handleUrl(url: string): Promise<void> {
    // GATE — idempotency: never exchange the same URL twice
    if (_handledUrls.has(url)) return

    const { code, error } = parseSocialAuthDeepLink(url)

    // Not our callback (some other deep link) — leave the flow untouched.
    if (!code && !error) return

    _handledUrls.add(url)
    clearTimers()
    _inFlight = false

    // iOS keeps the SFSafariViewController open; close it. No-op on Android,
    // where the deep link already foregrounded the app.
    void closeBrowser()

    // Provider-side failure → one clear error, stay on login.
    if (error) {
      toast?.add({ title: 'Sign-in failed. Please try again.', color: 'error' })
      return
    }

    // Success → swap the single-use code for credentials, then route.
    const result = await handleExchangeCode(code!)

    if (!result.success) {
      toast?.add({ title: result.error ?? 'Sign-in failed. Please try again.', color: 'error' })
      return
    }

    // Listener fires outside Nuxt's setup context — restore it for navigation.
    await nuxtApp.runWithContext(() => navigateTo(result.redirectTo, { replace: true }))
  }

  /**
   * The Custom Tab was dismissed. If no deep-link callback lands within the
   * grace window, treat it as an intentional user cancel — silently, no toast.
   */
  function onBrowserDismissed(): void {
    if (!_inFlight || _graceTimer) return

    _graceTimer = setTimeout(() => {
      _graceTimer = null
      if (_inFlight) reset() // silent cancel — user dismissed the tab
    }, NATIVE_SOCIAL_AUTH_CANCEL_GRACE_MS)
  }

  function armTimeout(provider: string): void {
    _timeoutTimer = setTimeout(() => {
      _timeoutTimer = null
      if (!_inFlight) return
      reset()
      toast?.add({ title: `${provider} sign-in timed out. Please try again.`, color: 'error' })
    }, NATIVE_SOCIAL_AUTH_TIMEOUT_MS)
  }

  function clearTimers(): void {
    if (_graceTimer) {
      clearTimeout(_graceTimer)
      _graceTimer = null
    }
    if (_timeoutTimer) {
      clearTimeout(_timeoutTimer)
      _timeoutTimer = null
    }
  }

  function reset(): void {
    _inFlight = false
    clearTimers()
  }

  async function closeBrowser(): Promise<void> {
    try {
      const { Browser } = await import('@capacitor/browser')
      await Browser.close()
    } catch {
      // Already closed / unsupported — ignore.
    }
  }

  // ========================================
  // Return
  // ========================================

  return { launch, registerDeepLinkListener }
}
