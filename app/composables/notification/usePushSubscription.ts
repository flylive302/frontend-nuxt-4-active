import { createLogger } from '~/utils/logger'

const log = createLogger('[usePushSubscription]')

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

      const existing = await registration.pushManager.getSubscription()
      let subscription = existing

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
      // Non-fatal — user may have denied permission
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
    }
  }

  return { register, unregister }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}
