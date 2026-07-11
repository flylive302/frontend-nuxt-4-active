/**
 * Custom Service Worker Asset Handler (LT-1)
 *
 * Listens for asset download commands from the main thread and performs
 * fetch + cache operations in the SW scope. Benefits:
 * - Downloads survive tab switches and background/foreground transitions
 * - No main thread blocking — network I/O runs in the SW isolate
 * - Writes to the same Cache Storage bucket the app reads
 *   (ASSET_CONFIG.CACHE_NAME in app/constants/asset.ts: 'flylive-assets-v1')
 *
 * Protocol:
 *   Main → SW: { type: 'ASSET_DOWNLOAD', url, cacheName }
 *   SW → Main: { type: 'ASSET_DOWNLOAD_RESULT', url, success, sizeBytes?, error? }
 */

const DEFAULT_CACHE_NAME = 'flylive-assets-v1'

/** Buckets from older SW versions that nothing reads — deleted on activate. */
const ORPHAN_CACHE_NAMES = ['fly-assets-v1']

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all(ORPHAN_CACHE_NAMES.map((name) => caches.delete(name))),
  )
})

/**
 * In-flight downloads keyed by `cacheName|url`.
 * A client that timed out and retries the same URL attaches to the ongoing
 * fetch instead of restarting it from zero — critical for multi-MB assets on
 * slow links, where restarting on every 30s client retry meant the download
 * could never finish inside any single attempt window.
 */
const inflightDownloads = new Map()

self.addEventListener('message', (event) => {
  if (event.data?.type === 'ASSET_DOWNLOAD') {
    const { url, cacheName } = event.data
    handleAssetDownload(url, cacheName || DEFAULT_CACHE_NAME, event.source)
  }
})

/**
 * Download and cache an asset (deduped), then report result back to the client.
 */
async function handleAssetDownload(url, cacheName, client) {
  const key = `${cacheName}|${url}`
  let pending = inflightDownloads.get(key)
  if (!pending) {
    pending = downloadAndCache(url, cacheName).finally(() => {
      inflightDownloads.delete(key)
    })
    inflightDownloads.set(key, pending)
  }

  try {
    const sizeBytes = await pending
    client?.postMessage({
      type: 'ASSET_DOWNLOAD_RESULT',
      url,
      success: true,
      sizeBytes,
    })
  } catch (error) {
    client?.postMessage({
      type: 'ASSET_DOWNLOAD_RESULT',
      url,
      success: false,
      error: (error && error.message) || 'Unknown error',
    })
  }
}

/**
 * Fetch + cache one asset. Resolves with the byte size.
 */
async function downloadAndCache(url, cacheName) {
  // Check if already cached
  const cache = await caches.open(cacheName)
  const existing = await cache.match(url)
  if (existing) {
    const blob = await existing.blob()
    return blob.size
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

  return blob.size
}
