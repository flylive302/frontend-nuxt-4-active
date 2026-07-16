/**
 * Self-destructing service worker (ADR 0020 — PWA layer removed).
 *
 * Deployed at the retired workbox SW's URL so already-installed clients update
 * into it on their next visit: it deletes every workbox-owned cache bucket
 * (precache, svga-cache, cdn-images, api-cache) and unregisters itself.
 *
 * MUST NOT have a fetch handler, and deliberately no clients.claim(): open
 * pages stay with the old worker until their next navigation (its cache-first
 * routes fall through to network once the buckets are deleted), so live
 * audio-room sessions are never interrupted by an abrupt takeover.
 *
 * 'flylive-assets-v1' is the app-owned asset bucket (constants/asset.ts) read
 * directly by the app — it must survive.
 */

const APP_OWNED_CACHES = ['flylive-assets-v1']

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((name) => !APP_OWNED_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      )
      await self.registration.unregister()
    })(),
  )
})
