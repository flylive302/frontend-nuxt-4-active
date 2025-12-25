/**
 * Gift Asset Cache Composable
 *
 * Unified cache for gift animation assets (videos as Blob URLs, SVGA parsed data).
 * This ensures preloaded assets are available to players without re-fetching.
 */
import { createLogger } from '~/utils/logger';

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
   */
  async function preloadVideo(url: string): Promise<string> {
    // Already cached
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
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        videoCache.set(url, blobUrl);
        log.debug('✅ Video cached:', url);
        
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
        await $fetch(`/parsedAnimations/${name}.json`);
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
   * Get cached Blob URL for a video, or return original URL as fallback
   */
  function getCachedVideoUrl(url: string): string {
    if (videoCache.has(url)) {
      return videoCache.get(url)!;
    }
    // Return original URL as fallback
    return url;
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
    isVideoCached,
    isGiftPreloaded,
    getCacheStats,
  };
}
