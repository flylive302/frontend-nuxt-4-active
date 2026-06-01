import { createLogger } from '~/utils/logger'

const log = createLogger('[PushSubscription]')

/**
 * Registers or refreshes the browser's Web Push subscription with the backend.
 * Call once after the user authenticates. Safe to call multiple times.
 */
export function usePushSubscription() {
  const { api } = useApi()
  const config = useRuntimeConfig()

  async function register(): Promise<void> {
    if (!import.meta.client) return
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

  async function unregister(): Promise<void> {
    if (!import.meta.client) return
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

  return { register, unregister }
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
