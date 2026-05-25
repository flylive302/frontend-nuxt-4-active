/**
 * VIP Asset Preloader Composable
 *
 * Progressively preloads all VIP-level animation assets into their
 * respective plugin caches (SVGA plugin for .svga, VAP plugin for .mp4).
 *
 * Reads asset URLs from the centralized ASSETS.VIP constant so
 * each level gets the correct file type — .svga for VIP 1-2,
 * .mp4 for VIP 3-15.
 *
 * Priority order: active level → adjacent levels → remaining.
 */
import type { VipLevel } from '~/types/vip/vip-level'
import type { SvgaPlugin } from '~/types/asset/svga'
import type { VapPlugin } from '~/types/asset/vap'
import type { Ref } from 'vue'
import { ASSETS } from '~/constants/assets'
import { createLogger } from '~/utils/logger'

const log = createLogger('[VipAssetPreloader]')

// ========================================
// Types
// ========================================

interface UseVipAssetPreloaderReturn {
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
 * Preload all VIP animation assets into their respective plugin caches.
 *
 * For each VIP level, preloads:
 * - cardAnimated: .svga → SVGA plugin cache, .mp4 → VAP JSON config cache
 * - emblemAnimated: always .svga → SVGA plugin cache
 *
 * @param levels      - Reactive list of VIP levels
 * @param activeIndex - Index of the currently viewed level (priority ordering)
 */
export function useVipAssetPreloader(
  levels: Ref<VipLevel[]>,
  activeIndex: Ref<number>,
): UseVipAssetPreloaderReturn {
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
   * Get the asset URLs to preload for a given VIP level number.
   * Reads from ASSETS.VIP to get the correct file type per level.
   */
  function getAssetsForLevel(levelNum: number): { url: string, type: 'svga' | 'vap' }[] {
    const levelAssets = ASSETS.VIP[levelNum as keyof typeof ASSETS.VIP]
    if (!levelAssets) return []

    const assets: { url: string, type: 'svga' | 'vap' }[] = []

    // Card animation — can be .svga or .mp4
    if (levelAssets.cardAnimated) {
      if (levelAssets.cardAnimated.endsWith('.svga')) {
        assets.push({ url: levelAssets.cardAnimated, type: 'svga' })
      } else if (levelAssets.cardAnimated.endsWith('.mp4')) {
        assets.push({ url: levelAssets.cardAnimated, type: 'vap' })
      }
    }

    // Emblem animation — always .svga
    if (levelAssets.emblemAnimated) {
      assets.push({ url: levelAssets.emblemAnimated, type: 'svga' })
    }

    return assets
  }

  /**
   * Sequentially preload all VIP assets in priority order.
   * Runs as fire-and-forget — errors are logged but never thrown.
   */
  async function preloadAll() {
    const svga = nuxtApp.$svga as SvgaPlugin | undefined
    const vap = nuxtApp.$vap as VapPlugin | undefined

    if (!svga && !vap) {
      return
    }

    const levelList = levels.value
    if (levelList.length === 0) return

    const orderedIndices = buildPriorityOrder(levelList.length, activeIndex.value)

    // Build asset list in priority order, skipping already-cached items
    const toPreload: { url: string, type: 'svga' | 'vap' }[] = []

    for (const idx of orderedIndices) {
      const level = levelList[idx]
      if (!level) continue

      const assets = getAssetsForLevel(level.level)
      for (const asset of assets) {
        if (asset.type === 'svga' && svga?.isCached(asset.url)) continue
        if (asset.type === 'vap' && vap?.isCached(asset.url.replace(/\.mp4$/, '.json'))) continue
        toPreload.push(asset)
      }
    }

    totalCount.value = toPreload.length
    preloadedCount.value = 0

    if (toPreload.length === 0) {
      return
    }

    isPreloading.value = true

    for (const asset of toPreload) {
      try {
        if (asset.type === 'svga' && svga) {
          await svga.fetchAnimation(asset.url)
        } else if (asset.type === 'vap' && vap) {
          // Preload the JSON config only — video is lazy-loaded by the player
          const jsonUrl = asset.url.replace(/\.mp4$/, '.json')
          await vap.preloadConfig(jsonUrl)
        }
        preloadedCount.value++
      } catch (err) {
      }
    }

    isPreloading.value = false
  }

  // ========================================
  // Lifecycle
  // ========================================

  /**
   * Watch for levels to become available, then trigger preload once.
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
