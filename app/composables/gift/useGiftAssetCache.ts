/**
 * Gift Asset Cache Composable
 *
 * Unified cache for gift animation assets (videos as Blob URLs, SVGA parsed data).
 * Uses a 3-tier cache strategy:
 * - L1: Memory (fastest, lost on reload)
 * - L2: Cache Storage (persistent, survives reloads)
 * - L3: Network (fallback, downloads fresh)
 */
import * as cacheStorage from '~/services/cacheStorage'
import * as assetIndex from '~/services/assetIndex'
import { createLogger } from '~/utils/logger'
import { resolveAnimationUrl } from '~/utils/assetUrl'

// ========================================
// Module-level Singleton Caches
// ========================================

/** Video Blob URL cache: animation_url -> Blob URL */
const videoCache = new Map<string, string>();

/** Video loading promises to prevent duplicate fetches */
const videoPending = new Map<string, Promise<string>>();

/** Track preload status */
const preloadedGiftIds = new Set<number>();

// ========================================
// Composable
// ========================================

export function useGiftAssetCache() {
  const log = createLogger('[GiftAssetCache]');
  /**
   * Preload a video asset and store as Blob URL.
   * Uses L1 memory -> L2 Cache Storage -> L3 Network strategy.
   */
  async function preloadVideo(url: string): Promise<string> {
    // L1: Memory cache (hot)
    if (videoCache.has(url)) {
      return videoCache.get(url)!;
    }

    // Already loading
    if (videoPending.has(url)) {
      return videoPending.get(url)!;
    }

    // Start loading
    const loadPromise = (async () => {
      try {
        // L2: Cache Storage (persistent)
        const cachedUrl = await cacheStorage.getAsset(url)
        if (cachedUrl) {
          videoCache.set(url, cachedUrl)
          await assetIndex.updateLastAccessed(url)
          log.debug('✅ Video from cache storage:', url)
          return cachedUrl
        }

        // L3: Network fallback
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const blob = await response.blob();
        
        // Store in L2 (Cache Storage) for persistence
        await cacheStorage.putAsset(url, blob)
        
        // Store in L1 (Memory) for speed
        const blobUrl = URL.createObjectURL(blob);
        videoCache.set(url, blobUrl);
        log.debug('✅ Video cached (network):', url);
        
        return blobUrl;
      } catch (error) {
        log.warn('❌ Video failed:', url, error);
        throw error;
      } finally {
        videoPending.delete(url);
      }
    })();

    videoPending.set(url, loadPromise);
    return loadPromise;
  }

  /**
   * Preload an SVGA asset using the SVGA plugin's cache
   */
  async function preloadSvga(name: string): Promise<void> {
    // Use the SVGA plugin's fetchAnimation to warm its cache
    // This ensures the same cache is used when createSvgaPlayer is called
    const nuxtApp = useNuxtApp();
    const svgaPlugin = nuxtApp.$svga;
    
    if (svgaPlugin?.fetchAnimation) {
      try {
        await svgaPlugin.fetchAnimation(name);
        log.debug('✅ SVGA cached:', name);
      } catch (error) {
        log.warn('❌ SVGA failed:', name, error);
      }
    } else {
      // Fallback if plugin not available
      try {
        await $fetch(resolveAnimationUrl(name));
        log.debug('✅ SVGA cached (fallback):', name);
      } catch (error) {
        log.warn('❌ SVGA failed:', name, error);
      }
    }
  }

  /**
   * Preload a gift's animation asset
   */
  async function preloadGift(gift: { id: number; asset_type: string; animation_url: string | null }): Promise<void> {
    if (!gift.animation_url) return;
    if (preloadedGiftIds.has(gift.id)) return;

    try {
      if (gift.asset_type === 'video') {
        await preloadVideo(gift.animation_url);
      } else if (gift.asset_type === 'svga') {
        await preloadSvga(gift.animation_url);
      }
      preloadedGiftIds.add(gift.id);
    } catch {
      // Errors already logged in preload functions
    }
  }

  /**
   * Get cached Blob URL for a video.
   * Checks L1 memory first, then L2 Cache Storage, returns original URL as fallback.
   */
  async function getCachedVideoUrl(url: string): Promise<string> {
    // L1: Memory
    if (videoCache.has(url)) {
      return videoCache.get(url)!;
    }
    
    // L2: Cache Storage
    const cachedUrl = await cacheStorage.getAsset(url)
    if (cachedUrl) {
      videoCache.set(url, cachedUrl) // Promote to L1
      return cachedUrl
    }
    
    // Fallback: return original URL (will fetch from network)
    return url;
  }

  /**
   * Synchronous version - only checks L1 memory cache.
   */
  function getCachedVideoUrlSync(url: string): string {
    return videoCache.get(url) ?? url
  }

  /**
   * Check if a video is cached
   */
  function isVideoCached(url: string): boolean {
    return videoCache.has(url);
  }

  /**
   * Check if a gift has been preloaded
   */
  function isGiftPreloaded(giftId: number): boolean {
    return preloadedGiftIds.has(giftId);
  }

  /**
   * Get cache stats for debugging
   */
  function getCacheStats() {
    return {
      videoCount: videoCache.size,
      pendingCount: videoPending.size,
      preloadedGiftCount: preloadedGiftIds.size,
    };
  }

  return {
    preloadVideo,
    preloadSvga,
    preloadGift,
    getCachedVideoUrl,
    getCachedVideoUrlSync,
    isVideoCached,
    isGiftPreloaded,
    getCacheStats,
  };
}
