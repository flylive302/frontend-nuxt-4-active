// ========================================
// Cache Storage Service
// ========================================

import { ASSET_CONFIG, DEPRECATED_CACHE_NAMES } from '~/constants/asset'
import { createLogger } from '~/utils/logger'

const log = createLogger('[CacheStorage]')

// ========================================
// Initialization
// ========================================

let cachePromise: Promise<Cache> | null = null

/**
 * Get or open the asset cache.
 * Lazy initialization to avoid SSR issues.
 */
async function getCache(): Promise<Cache | null> {
  // SSR guard
  if (typeof caches === 'undefined') {
    return null
  }

  if (!cachePromise) {
    cachePromise = caches.open(ASSET_CONFIG.CACHE_NAME)

  }

  return cachePromise
}

/**
 * Initialize cache and clean up old versions.
 * Should be called once on app start.
 */
export async function initCacheStorage(): Promise<void> {
  // SSR guard
  if (typeof caches === 'undefined') return

  // Clean up deprecated caches
  for (const name of DEPRECATED_CACHE_NAMES) {
    try {
      await caches.delete(name)
    } catch (e) {
      log.warn('Failed to delete deprecated cache', name, e)
    }
  }

  // Pre-open the cache
  await getCache()

}

// ========================================
// Public API
// ========================================

/**
 * Store an asset in cache.
 * @param url - Asset URL (used as cache key)
 * @param blob - Asset data as Blob
 */
export async function putAsset(url: string, blob: Blob): Promise<void> {
  const cache = await getCache()
  if (!cache) return

  const makeResponse = () =>
    new Response(blob, {
      headers: {
        'Content-Type': blob.type,
        'Content-Length': blob.size.toString(),
        'X-Cached-At': Date.now().toString(),
      },
    })

  try {
    await cache.put(url, makeResponse())
  } catch (e) {
    // Browser evicted the cache between open and put (mobile storage pressure).
    // Reset the stale handle and retry once with a freshly opened cache.
    if (e instanceof DOMException && e.name === 'NotFoundError') {
      cachePromise = null
      const fresh = await getCache()
      if (fresh) await fresh.put(url, makeResponse())
    } else {
      throw e
    }
  }
}

/**
 * Get an asset from cache as a Blob URL.
 * Returns null if not cached.
 * @param url - Asset URL to retrieve
 */
export async function getAsset(url: string): Promise<string | null> {
  const cache = await getCache()
  if (!cache) return null

  try {
    const response = await cache.match(url)
    if (!response) return null

    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)

    return blobUrl
  } catch (e) {
    log.warn('Failed to get asset from cache', e)
    return null
  }
}

/**
 * Check if an asset exists in cache.
 * @param url - Asset URL to check
 */
export async function hasAsset(url: string): Promise<boolean> {
  const cache = await getCache()
  if (!cache) return false

  try {
    const response = await cache.match(url)
    return response !== undefined
  } catch (e) {
    log.warn('Failed to check asset in cache', e)
    return false
  }
}

/**
 * Delete an asset from cache.
 * @param url - Asset URL to delete
 */
export async function deleteAsset(url: string): Promise<boolean> {
  const cache = await getCache()
  if (!cache) return false

  try {
    const deleted = await cache.delete(url)
    return deleted
  } catch (e) {
    log.warn('Failed to delete asset from cache', e)
    return false
  }
}

/**
 * Clear all assets from cache.
 */
export async function clearAll(): Promise<void> {
  // SSR guard
  if (typeof caches === 'undefined') return

  try {
    await caches.delete(ASSET_CONFIG.CACHE_NAME)
    cachePromise = null
  } catch (e) {
    log.warn('Failed to clear all cached assets', e)
  }
}

/**
 * Get total size of cached assets.
 * Note: This is an estimate as we can only read Content-Length headers.
 */
export async function getTotalSize(): Promise<number> {
  const cache = await getCache()
  if (!cache) return 0

  try {
    const keys = await cache.keys()
    let totalSize = 0

    for (const request of keys) {
      const response = await cache.match(request)
      if (response) {
        const contentLength = response.headers.get('Content-Length')
        if (contentLength) {
          totalSize += parseInt(contentLength, 10)
        }
      }
    }


    return totalSize
  } catch (e) {
    log.warn('Failed to get total cache size', e)
    return 0
  }
}

/**
 * Get all cached URLs.
 */
export async function getCachedUrls(): Promise<string[]> {
  const cache = await getCache()
  if (!cache) return []

  try {
    const keys = await cache.keys()
    return keys.map((req) => req.url)
  } catch (e) {
    log.warn('Failed to get cached URLs', e)
    return []
  }
}
