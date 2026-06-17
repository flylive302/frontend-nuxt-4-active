import { Capacitor } from '@capacitor/core'
import { Device } from '@capacitor/device'
import { App } from '@capacitor/app'
import { PushNotifications } from '@capacitor/push-notifications'
import { createLogger } from '~/utils/logger'
import { resolvePushTransport } from '~/utils/push-transport'

const log = createLogger('[PushSubscription]')

/**
 * Registers or refreshes this device's push registration with the backend.
 *
 * Single entry point regardless of platform (ADR 0013): the transport resolver
 * picks Web Push (browser) or FCM (Capacitor shell), and `register()` runs the
 * matching path. Call once after the user authenticates. Safe to call multiple
 * times. Permission denial / missing capability is a graceful no-op.
 */
export function usePushSubscription() {
  const { api } = useApi()
  const config = useRuntimeConfig()

  async function register(): Promise<void> {
    if (!import.meta.client) return

    if (resolvePushTransport(Capacitor.isNativePlatform() ? 'native' : 'web') === 'fcm') {
      await registerNativePush()
      return
    }

    await registerWebPush()
  }

  async function unregister(): Promise<void> {
    if (!import.meta.client) return

    if (Capacitor.isNativePlatform()) {
      await unregisterNativePush()
      return
    }

    await unregisterWebPush()
  }

  // EXECUTE — Web Push (browser): subscribe via PushManager, store endpoint + keys.
  async function registerWebPush(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return
    }

    const vapidKey = config.public.vapidPublicKey
    if (!vapidKey) {
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready

      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        })
      }

      const json = subscription.toJSON()

      await api('/push/subscriptions', {
        method: 'POST',
        body: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: json.keys?.p256dh ?? '',
            auth: json.keys?.auth ?? '',
          },
          encoding: 'aesgcm',
        },
      })
    }
    catch (err) {
      log.warn('Failed to register push subscription', err)
    }
  }

  // EXECUTE — Native (FCM): request permission, register, store the device token.
  async function registerNativePush(): Promise<void> {
    try {
      const permission = await PushNotifications.requestPermissions()
      if (permission.receive !== 'granted') {
        return
      }

      const token = await awaitRegistrationToken()
      const { identifier } = await Device.getId()
      const { version } = await App.getInfo()

      await api('/push/device-tokens', {
        method: 'POST',
        body: {
          token,
          platform: Capacitor.getPlatform(),
          device_id: identifier,
          app_version: version,
        },
      })
    }
    catch (err) {
      log.warn('Failed to register native push token', err)
    }
  }

  // EXECUTE — Web Push teardown.
  async function unregisterWebPush(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) return

      await api('/push/subscriptions', {
        method: 'DELETE',
        body: { endpoint: subscription.endpoint },
      })
      await subscription.unsubscribe()
    }
    catch (err) {
      log.warn('Failed to unregister push subscription', err)
    }
  }

  // EXECUTE — Native token teardown (logout). Drop the local token row so a
  // shared device never keeps pushing the previous user's notifications.
  async function unregisterNativePush(): Promise<void> {
    try {
      const token = await awaitRegistrationToken()
      await api('/push/device-tokens', {
        method: 'DELETE',
        body: { token },
      })
    }
    catch (err) {
      log.warn('Failed to unregister native push token', err)
    }
  }

  return { register, unregister }
}

/**
 * Trigger native registration and resolve with the FCM token from the
 * one-shot `registration` event. Listeners are removed once settled so repeat
 * calls never stack handlers.
 */
function awaitRegistrationToken(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false
    const handles: Array<{ remove: () => Promise<void> }> = []

    const cleanup = async () => {
      await Promise.all(handles.map(h => h.remove()))
    }

    PushNotifications.addListener('registration', async (token) => {
      if (settled) return
      settled = true
      await cleanup()
      resolve(token.value)
    }).then(h => handles.push(h))

    PushNotifications.addListener('registrationError', async (err) => {
      if (settled) return
      settled = true
      await cleanup()
      reject(err instanceof Error ? err : new Error(String(err?.error ?? 'registrationError')))
    }).then(h => handles.push(h))

    PushNotifications.register().catch(reject)
  })
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}
