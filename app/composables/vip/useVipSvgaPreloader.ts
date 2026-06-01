/**
 * VIP SVGA Preloader Composable
 *
 * Progressively preloads all VIP-level SVGA assets (card + emblem)
 * into the shared svga-player plugin cache. Assets are fetched in
 * priority order: active level → adjacent levels → remaining.
 *
 * Because the plugin cache is shared, once preloaded here the
 * SvgaPlayer component's createSvgaPlayer call hits the cache
 * and renders instantly with zero network wait.
 */
import type { VipLevel } from '~/types/vip/vip-level'
import type { SvgaPlugin } from '~/types/asset/svga'
import type { Ref } from 'vue'
import { createLogger } from '~/utils/logger'

const log = createLogger('[VipSvgaPreloader]')

// ========================================
// Constants
// ========================================

/** SVGA asset filenames used on the VIP page per level */
const VIP_SVGA_ASSETS = ['card.svga', 'emblem.svga'] as const

// ========================================
// Types
// ========================================

interface UseVipSvgaPreloaderReturn {
  /** Whether preloading is still in progress */
  isPreloading: Readonly<Ref<boolean>>
  /** Number of assets preloaded so far */
  preloadedCount: Readonly<Ref<number>>
  /** Total number of assets to preload */
  totalCount: Readonly<Ref<number>>
}

// ========================================
// Composable
// ========================================

/**
 * Preload all VIP SVGA assets into the shared plugin cache.
 *
 * @param levels  - Reactive list of VIP levels (must be populated before preloading starts)
 * @param activeIndex - Index of the currently viewed level (used for priority ordering)
 */
export function useVipSvgaPreloader(
  levels: Ref<VipLevel[]>,
  activeIndex: Ref<number>,
): UseVipSvgaPreloaderReturn {
  // SSR guard
  if (!import.meta.client) {
    return {
      isPreloading: ref(false) as Readonly<Ref<boolean>>,
      preloadedCount: ref(0) as Readonly<Ref<number>>,
      totalCount: ref(0) as Readonly<Ref<number>>,
    }
  }

  const nuxtApp = useNuxtApp()
  const isPreloading = ref(false)
  const preloadedCount = ref(0)
  const totalCount = ref(0)

  // ========================================
  // Helpers
  // ========================================

  /**
   * Build a priority-ordered list of level indices:
   * active → next → previous → remaining (ascending).
   */
  function buildPriorityOrder(count: number, active: number): number[] {
    const seen = new Set<number>()
    const order: number[] = []

    const push = (i: number) => {
      if (i >= 0 && i < count && !seen.has(i)) {
        seen.add(i)
        order.push(i)
      }
    }

    push(active)
    push(active + 1)
    push(active - 1)

    for (let i = 0; i < count; i++) push(i)

    return order
  }

  /**
   * Sequentially preload all VIP SVGA assets in priority order.
   * Runs as fire-and-forget — errors are logged but never thrown.
   */
  async function preloadAll() {
    const svga = nuxtApp.$svga as SvgaPlugin | undefined
    if (!svga) {
      return
    }

    const levelList = levels.value
    if (levelList.length === 0) return

    const orderedIndices = buildPriorityOrder(levelList.length, activeIndex.value)
    const urls: string[] = []

    for (const idx of orderedIndices) {
      const level = levelList[idx]
      if (!level) continue

      for (const asset of VIP_SVGA_ASSETS) {
        const url = `/vip/${level.level}/${asset}`
        // Skip already-cached assets
        if (!svga.isCached(url)) {
          urls.push(url)
        }
      }
    }

    totalCount.value = urls.length
    preloadedCount.value = 0

    if (urls.length === 0) {
      return
    }

    isPreloading.value = true

    for (const url of urls) {
      try {
        await svga.fetchAnimation(url)
        preloadedCount.value++
      }
      catch (err) {
        log.warn('Failed to preload VIP SVGA asset', err)
      }
    }

    isPreloading.value = false
  }

  // ========================================
  // Lifecycle
  // ========================================

  /**
   * Watch for levels to become available, then trigger preload once.
   * Uses `{ once: true }` so the watcher auto-cleans after firing.
   */
  const stopWatch = watch(
    () => levels.value.length,
    (count) => {
      if (count > 0) {
        preloadAll()
        stopWatch()
      }
    },
    { immediate: true },
  )

  return {
    isPreloading: readonly(isPreloading),
    preloadedCount: readonly(preloadedCount),
    totalCount: readonly(totalCount),
  }
}
