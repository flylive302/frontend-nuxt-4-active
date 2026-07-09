import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { createLogger } from '~/utils/logger'

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
 * Token registration lives in `usePushSubscription` (auth-triggered); this
 * plugin only owns the persistent tap listener. No-ops on the web build.
 */
export default defineNuxtPlugin(async (nuxtApp) => {
  if (!Capacitor.isNativePlatform()) return

  const log = createLogger('[NativePush]')

  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = action.notification.data?.url
    if (typeof url !== 'string' || url === '') return

    nuxtApp.runWithContext(() => navigateTo(url)).catch((err: unknown) => {
      log.warn('Failed to navigate from push tap', err)
    })
  })
})
