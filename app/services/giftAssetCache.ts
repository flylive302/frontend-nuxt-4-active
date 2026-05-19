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

const log = createLogger('[GiftAssetCache]')

// ========================================
// Module-level Singleton Caches
// ========================================

/** Video Blob URL cache: animation_url -> Blob URL */
const videoCache = new Map<string, string>()

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
  if (videoCache.has(url)) {
    return videoCache.get(url)!
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
        videoCache.set(url, cachedUrl)
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
      videoCache.set(url, blobUrl)

      return blobUrl
    } catch (error) {
      log.warn('❌ Video failed:', url, error)
      throw error
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
      log.warn('❌ SVGA failed:', name, error)
    }
  } else {
    // Fallback if plugin not available
    try {
      await fetch(name)
    } catch (error) {
      log.warn('❌ SVGA failed:', name, error)
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
    log.warn('❌ VAP video failed:', rawMp4Url, error)
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
    log.debug('Gift preload skipped:', gift.id, error)
  }
}

/**
 * Get cached Blob URL for a video.
 * Checks L1 memory first, then L2 Cache Storage, returns original URL as fallback.
 */
export async function getCachedVideoUrl(url: string): Promise<string> {
  // L1: Memory
  if (videoCache.has(url)) {
    return videoCache.get(url)!
  }

  // L2: Cache Storage
  const cachedUrl = await cacheStorage.getAsset(url)
  if (cachedUrl) {
    videoCache.set(url, cachedUrl) // Promote to L1
    return cachedUrl
  }

  // Fallback: return original URL (will fetch from network)
  return url
}

/**
 * Synchronous version - only checks L1 memory cache.
 */
export function getCachedVideoUrlSync(url: string): string {
  return videoCache.get(url) ?? url
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
