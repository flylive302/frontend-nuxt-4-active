// ========================================
// Gift Asset Cache Service
// ========================================
// Services = Low-level infra (cache, asset downloading, network).
// No store imports, no UI concerns.
//
// Unified cache for gift animation assets (videos as Blob URLs, SVGA parsed data).
// Uses a 3-tier cache strategy:
// - L1: Memory (fastest, lost on reload)
// - L2: Cache Storage (persistent, survives reloads)
// - L3: Network (fallback, downloads fresh)

import * as cacheStorage from '~/services/cacheStorage'
import * as assetIndex from '~/services/assetIndex'
import { createLogger } from '~/utils/logger'
import { resolveVideoUrl } from '~/utils/platform'
import { VIDEO_CACHE_MAX_ENTRIES } from '~/constants/gift'

const log = createLogger('[GiftAssetCache]')

// ========================================
// Module-level Singleton Caches
// ========================================

/**
 * Video Blob URL cache: animation_url -> Blob URL.
 * LRU-bounded: Map insertion order is recency (touched on every hit);
 * the oldest entry is evicted and its blob URL revoked once the cap is hit.
 * The currently playing URL was just read, so it is never the eviction victim.
 */
const videoCache = new Map<string, string>()

/** Store a blob URL, evicting (and revoking) the least-recently-used beyond the cap. */
function videoCacheSet(url: string, blobUrl: string): void {
  videoCache.delete(url)
  videoCache.set(url, blobUrl)
  while (videoCache.size > VIDEO_CACHE_MAX_ENTRIES) {
    const [oldestUrl, oldestBlobUrl] = videoCache.entries().next().value!
    videoCache.delete(oldestUrl)
    URL.revokeObjectURL(oldestBlobUrl)
  }
}

/** Read a blob URL, refreshing its recency. */
function videoCacheGet(url: string): string | undefined {
  const blobUrl = videoCache.get(url)
  if (blobUrl !== undefined) {
    videoCache.delete(url)
    videoCache.set(url, blobUrl)
  }
  return blobUrl
}

/** Video loading promises to prevent duplicate fetches */
const videoPending = new Map<string, Promise<string>>()

/** Track preload status */
const preloadedGiftIds = new Set<number>()

// ========================================
// SVGA Plugin Interface
// ========================================

export interface SvgaPlugin {
  fetchAnimation?: (name: string) => Promise<unknown>
}

// ========================================
// Public API
// ========================================

/**
 * Preload a video asset and store as Blob URL.
 * Uses L1 memory -> L2 Cache Storage -> L3 Network strategy.
 */
export async function preloadVideo(rawUrl: string): Promise<string> {
  // Resolve platform-specific URL (e.g., .webm → .mov on iOS)
  const url = resolveVideoUrl(rawUrl)

  // L1: Memory cache (hot)
  const hot = videoCacheGet(url)
  if (hot !== undefined) {
    return hot
  }

  // Already loading
  if (videoPending.has(url)) {
    return videoPending.get(url)!
  }

  // Start loading
  const loadPromise = (async () => {
    try {
      // L2: Cache Storage (persistent)
      const cachedUrl = await cacheStorage.getAsset(url)
      if (cachedUrl) {
        videoCacheSet(url, cachedUrl)
        await assetIndex.updateLastAccessed(url)
        return cachedUrl
      }

      // L3: Network fallback
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const blob = await response.blob()

      // Store in L2 (Cache Storage) for persistence
      await cacheStorage.putAsset(url, blob)

      // Store in L1 (Memory) for speed
      const blobUrl = URL.createObjectURL(blob)
      videoCacheSet(url, blobUrl)

      return blobUrl
    } finally {
      videoPending.delete(url)
    }
  })()

  videoPending.set(url, loadPromise)
  return loadPromise
}

/**
 * Preload an SVGA asset using the SVGA plugin's cache.
 * The SVGA plugin reference must be passed in by the caller
 * (services must not import from Vue/Nuxt runtime).
 */
export async function preloadSvga(name: string, svgaPlugin?: SvgaPlugin): Promise<void> {
  if (svgaPlugin?.fetchAnimation) {
    try {
      await svgaPlugin.fetchAnimation(name)
    } catch (error) {
      log.warn('Failed to preload SVGA via plugin', error)
    }
  } else {
    // Fallback if plugin not available
    try {
      await fetch(name)
    } catch (error) {
      log.warn('Failed to preload SVGA via fetch', error)
    }
  }
}

/**
 * Preload a VAP asset: the MP4 (persisted via preloadVideo's L1/L2 cache)
 * plus a fire-and-forget warm of the tiny sidecar JSON config.
 */
export async function preloadVap(rawMp4Url: string): Promise<void> {
  const base = rawMp4Url.endsWith('.mp4') ? rawMp4Url.slice(0, -4) : rawMp4Url
  try {
    await preloadVideo(`${base}.mp4`)
  } catch (error) {
    log.warn('Failed to preload VAP video', error)
  }
  // Config is <1% of the cost — just warm the browser HTTP cache, don't block.
  fetch(`${base}.json`).catch(() => {})
}

/**
 * Preload a gift's animation asset.
 */
export async function preloadGift(
  gift: { id: number; asset_type: string; animation_url: string | null },
  svgaPlugin?: SvgaPlugin,
): Promise<void> {
  if (!gift.animation_url) return
  if (preloadedGiftIds.has(gift.id)) return

  try {
    if (gift.asset_type === 'video') {
      await preloadVideo(gift.animation_url)
    } else if (gift.asset_type === 'svga') {
      await preloadSvga(gift.animation_url, svgaPlugin)
    } else if (gift.asset_type === 'vap') {
      await preloadVap(gift.animation_url)
    }
    preloadedGiftIds.add(gift.id)
  } catch (error) {
    log.warn('Failed to preload gift asset', error)
  }
}

/**
 * Get cached Blob URL for a video.
 * Checks L1 memory first, then L2 Cache Storage, returns original URL as fallback.
 */
export async function getCachedVideoUrl(url: string): Promise<string> {
  // L1: Memory
  const hot = videoCacheGet(url)
  if (hot !== undefined) {
    return hot
  }

  // L2: Cache Storage
  const cachedUrl = await cacheStorage.getAsset(url)
  if (cachedUrl) {
    videoCacheSet(url, cachedUrl) // Promote to L1
    return cachedUrl
  }

  // Fallback: return original URL (will fetch from network)
  return url
}

/**
 * Synchronous version - only checks L1 memory cache.
 */
export function getCachedVideoUrlSync(url: string): string {
  return videoCacheGet(url) ?? url
}

/**
 * Revoke every cached blob URL and empty the L1 cache (e.g. on room leave).
 * L2 Cache Storage persists, so subsequent plays re-mint cheaply from disk.
 */
export function clearVideoCache(): void {
  for (const blobUrl of videoCache.values()) {
    URL.revokeObjectURL(blobUrl)
  }
  videoCache.clear()
}

/**
 * Check if a video is cached in L1.
 */
export function isVideoCached(url: string): boolean {
  return videoCache.has(url)
}

/**
 * Check if a gift has been preloaded.
 */
export function isGiftPreloaded(giftId: number): boolean {
  return preloadedGiftIds.has(giftId)
}

/**
 * Get cache stats for debugging.
 */
export function getCacheStats(): { videoCount: number; pendingCount: number; preloadedGiftCount: number } {
  return {
    videoCount: videoCache.size,
    pendingCount: videoPending.size,
    preloadedGiftCount: preloadedGiftIds.size,
  }
}

/**
 * Check whether a gift's playable asset is confirmed in cache.
 *
 * - Fast path: preloadedGiftIds (current session, covers all animation types including svga)
 * - image: always ready — <img> loads natively, no preloading required
 * - svga: L1 preloadedGiftIds is the only readiness signal — no persistent cache
 * - video/vap: checks L1 memory cache then cacheStorage (flylive-assets-v1)
 */
export async function isGiftAssetCached(
  gift: { id?: number; asset_type: string; animation_url: string | null; thumbnail_url: string },
): Promise<boolean> {
  // L1 fast path: preloaded in this session (synchronous, all animation types)
  if (gift.id !== undefined && preloadedGiftIds.has(gift.id)) return true

  if (gift.asset_type === 'image') {
    // Images load natively via <img> — no preloading required.
    // NuxtImg transforms the URL (adds tr= params), so caches.match(thumbnail_url)
    // never hits the service worker's cdn-images cache and always returns false.
    return true
  }

  if (!gift.animation_url) return false

  if (gift.asset_type === 'svga') return false

  const url = resolveVideoUrl(gift.animation_url)

  // L1: memory cache (synchronous — avoids async Cache Storage round-trip)
  if (videoCache.has(url)) return true

  // L2: persistent Cache Storage
  return cacheStorage.hasAsset(url)
}
