import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { createLogger } from '~/utils/logger'
import { usePushSubscription } from '~/composables/notification/usePushSubscription'

/**
 * Native push tap handling (Capacitor only) — capacitor-06 / ADR 0013.
 *
 * The FCM analogue of the service worker's `notificationclick`: when the user
 * taps a system-tray notification, deep-link to the `url` the backend put in the
 * message `data` map (e.g. `/inbox/{thread}`).
 *
 * Foreground is intentionally silent for v1 — while the app is open the WebView
 * already reflects new state (inbox badge / bell), so we draw no tray UI and add
 * no `pushNotificationReceived` handler here.
 *
 * This plugin owns the persistent tap listener AND the boot-time token sync.
 * No-ops on the web build.
 */
export default defineNuxtPlugin(async (nuxtApp) => {
  if (!Capacitor.isNativePlatform()) return

  const log = createLogger('[NativePush]')

  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = action.notification.data?.url
    if (typeof url !== 'string' || url === '') return

    Promise.resolve(nuxtApp.runWithContext(() => navigateTo(url))).catch((err: unknown) => {
      log.warn('Failed to navigate from push tap', err)
    })
  })

  // Re-sync this device's FCM token on every cold start with a live session.
  //
  // Registration used to fire only on login / verifyEmail / OAuth callback, which
  // left two holes: sessions predating the push feature never registered at all,
  // and FCM *rotates* tokens (reinstall, device restore, its own refresh cycle)
  // with no event we can passively observe — the `registration` event fires in
  // response to `register()`, not spontaneously. Both holes are silent: the user
  // simply stops receiving pushes and nothing anywhere reports it.
  //
  // Re-registering each boot closes both without a re-login. The backend upserts
  // by token, so repeating it (and overlapping with the login-path call) is a
  // no-op rather than a duplicate row.
  //
  // Gated on a watch rather than a bare `if`: auth hydrates from persisted state
  // after plugins run, so reading `isAuthenticated` directly here would be false
  // on every boot and quietly skip registration forever.
  const authStore = useAuthStore()
  const { register } = usePushSubscription()

  watch(
    () => authStore.isAuthenticated,
    (isAuth, wasAuth) => {
      if (!isAuth || wasAuth) return

      register().catch((err: unknown) => {
        log.warn('Boot-time push registration failed', err)
      })
    },
    { immediate: true }
  )
})
