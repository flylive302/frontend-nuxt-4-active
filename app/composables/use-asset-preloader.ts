/**
 * Asset Preloader Composable
 *
 * Generic asset preloader that loads assets during browser idle time.
 * Supports multiple asset types: video, SVGA, image, audio, JSON.
 * Can be configured via preload-assets.ts or programmatically.
 */
import { useIdle } from '@vueuse/core';
import type { PreloadAsset, PreloadAssetType } from '~/config/preload-assets';
import { ROOM_PRELOAD_ASSETS } from '~/config/preload-assets';
import { useGiftAssetCache } from './useGiftAssetCache';

// ========================================
// Module-level State (Singleton)
// ========================================

/** Track preloaded assets to avoid duplicate work */
const preloadedAssets = new Set<string>();

/** Whether preloading has started this session */
const hasStartedPreload = ref(false);

/** Assets currently being preloaded */
const pendingAssets = ref<string[]>([]);

/** Idle time before starting preload (ms) */
const IDLE_THRESHOLD_MS = 5000;

/** Delay between asset preloads to avoid bandwidth contention (ms) */
const PRELOAD_DELAY_MS = 50;

// ========================================
// Preload Functions by Type
// ========================================

/**
 * Preload a video asset using unified cache (stores Blob URL)
 */
async function preloadVideo(url: string): Promise<void> {
  const { preloadVideo: cacheVideo } = useGiftAssetCache();
  try {
    await cacheVideo(url);
  } catch {
    // Errors already logged in cache
  }
}

/**
 * Preload an SVGA animation using unified cache
 */
async function preloadSvga(name: string): Promise<void> {
  const { preloadSvga: cacheSvga } = useGiftAssetCache();
  await cacheSvga(name);
}

/**
 * Preload an image
 */
function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = url;

    img.onload = () => {
      console.log('[AssetPreloader] ✅ Image:', url);
      resolve();
    };

    img.onerror = () => {
      console.warn('[AssetPreloader] ❌ Image failed:', url);
      resolve();
    };
  });
}

/**
 * Preload an audio file
 */
function preloadAudio(url: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;

    audio.onloadeddata = () => {
      console.log('[AssetPreloader] ✅ Audio:', url);
      resolve();
    };

    audio.onerror = () => {
      console.warn('[AssetPreloader] ❌ Audio failed:', url);
      resolve();
    };
  });
}

/**
 * Preload a JSON file
 */
async function preloadJson(url: string): Promise<void> {
  try {
    await $fetch(url);
    console.log('[AssetPreloader] ✅ JSON:', url);
  } catch {
    console.warn('[AssetPreloader] ❌ JSON failed:', url);
  }
}

/**
 * Preload a single asset based on type
 */
async function preloadAsset(asset: PreloadAsset): Promise<void> {
  if (preloadedAssets.has(asset.id)) return;

  pendingAssets.value.push(asset.id);

  try {
    switch (asset.type) {
      case 'video':
        await preloadVideo(asset.url);
        break;
      case 'svga':
        await preloadSvga(asset.url);
        break;
      case 'image':
        await preloadImage(asset.url);
        break;
      case 'audio':
        await preloadAudio(asset.url);
        break;
      case 'json':
        await preloadJson(asset.url);
        break;
    }
    preloadedAssets.add(asset.id);
  } finally {
    pendingAssets.value = pendingAssets.value.filter((id) => id !== asset.id);
  }
}

// ========================================
// Composable
// ========================================

export function useAssetPreloader() {
  const { idle } = useIdle(IDLE_THRESHOLD_MS);

  /**
   * Preload a list of assets in priority order
   */
  async function preloadAssets(assets: PreloadAsset[]): Promise<void> {
    // Sort by priority (lower = higher priority)
    const sorted = [...assets].sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10));

    console.log(`[AssetPreloader] 🚀 Starting preload of ${sorted.length} assets`);

    for (const asset of sorted) {
      // Skip already loaded
      if (preloadedAssets.has(asset.id)) continue;

      // Yield to main thread
      await new Promise((r) => setTimeout(r, PRELOAD_DELAY_MS));

      await preloadAsset(asset);
    }

    console.log('[AssetPreloader] ✅ Preloading complete');
  }

  /**
   * Preload room assets from configuration
   */
  async function preloadRoomAssets(): Promise<void> {
    if (hasStartedPreload.value) return;
    hasStartedPreload.value = true;

    await preloadAssets(ROOM_PRELOAD_ASSETS);
  }

  /**
   * Start watching for idle and trigger preload
   */
  function startIdlePreload(): void {
    watch(
      idle,
      (isIdle) => {
        if (isIdle && !hasStartedPreload.value) {
          preloadRoomAssets();
        }
      },
      { immediate: true }
    );
  }

  /**
   * Manually preload specific assets (for dynamic use)
   */
  async function preload(
    assets: Array<{ id: string; type: PreloadAssetType; url: string; priority?: number }>
  ): Promise<void> {
    await preloadAssets(assets);
  }

  /**
   * Check if an asset has been preloaded
   */
  function isPreloaded(id: string): boolean {
    return preloadedAssets.has(id);
  }

  /**
   * Reset preload state (useful for testing)
   */
  function reset(): void {
    hasStartedPreload.value = false;
    preloadedAssets.clear();
    pendingAssets.value = [];
  }

  return {
    // Methods
    preloadAssets,
    preloadRoomAssets,
    startIdlePreload,
    preload,
    isPreloaded,
    reset,

    // State (readonly)
    hasStartedPreload: readonly(hasStartedPreload),
    pendingAssets: readonly(pendingAssets),
    preloadedCount: computed(() => preloadedAssets.size),
  };
}
