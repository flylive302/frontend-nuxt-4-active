/**
 * Custom Service Worker Asset Handler (LT-1)
 *
 * Listens for asset download commands from the main thread and performs
 * fetch + cache operations in the SW scope. Benefits:
 * - Downloads survive tab switches and background/foreground transitions
 * - No main thread blocking — network I/O runs in the SW isolate
 * - Uses the same Cache API as Workbox (cache name: 'fly-assets-v1')
 *
 * Protocol:
 *   Main → SW: { type: 'ASSET_DOWNLOAD', url, cacheName }
 *   SW → Main: { type: 'ASSET_DOWNLOAD_RESULT', url, success, sizeBytes?, error? }
 */

const CACHE_NAME = 'fly-assets-v1'

self.addEventListener('message', (event) => {
  if (event.data?.type === 'ASSET_DOWNLOAD') {
    const { url } = event.data
    handleAssetDownload(url, event.source)
  }
})

/**
 * Download and cache an asset, then report result back to the client.
 */
async function handleAssetDownload(url, client) {
  try {
    // Check if already cached
    const cache = await caches.open(CACHE_NAME)
    const existing = await cache.match(url)
    if (existing) {
      const blob = await existing.blob()
      client?.postMessage({
        type: 'ASSET_DOWNLOAD_RESULT',
        url,
        success: true,
        sizeBytes: blob.size,
        cached: true,
      })
      return
    }

    // Fetch the asset
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    // Clone response for cache (response body can only be consumed once)
    const responseClone = response.clone()
    const blob = await response.blob()

    // Validate size
    const contentLength = responseClone.headers.get('Content-Length')
    if (contentLength && blob.size !== parseInt(contentLength, 10)) {
      throw new Error('Size mismatch - download may be corrupted')
    }

    // Store in cache with metadata headers
    const cacheResponse = new Response(blob, {
      headers: {
        'Content-Type': blob.type,
        'Content-Length': blob.size.toString(),
        'X-Cached-At': Date.now().toString(),
      },
    })
    await cache.put(url, cacheResponse)

    // Report success
    client?.postMessage({
      type: 'ASSET_DOWNLOAD_RESULT',
      url,
      success: true,
      sizeBytes: blob.size,
      cached: false,
    })
  } catch (error) {
    // Report failure
    client?.postMessage({
      type: 'ASSET_DOWNLOAD_RESULT',
      url,
      success: false,
      error: error.message || 'Unknown error',
    })
  }
}
