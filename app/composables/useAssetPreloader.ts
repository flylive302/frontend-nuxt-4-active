// ========================================
// Asset Preloader Composable
// ========================================

import { createLogger } from '~/utils/logger'

const log = createLogger('[AssetPreloader]')

/**
 * Composable for opportunistic asset preloading during idle time.
 * Uses requestIdleCallback to preload remaining gift assets
 * without impacting user interactions.
 */
export function useAssetPreloader() {
  const bootstrapStore = useBootstrapStore()
  const { preloadGift } = useGiftAssetCache()

  /**
   * Start preloading assets during browser idle time.
   * Uses requestIdleCallback for non-blocking behavior.
   */
  function startIdlePreload(): void {
    // SSR guard
    if (typeof window === 'undefined') return

    // Use requestIdleCallback if available, otherwise setTimeout
    const scheduleIdle = window.requestIdleCallback
      ? (cb: () => void) => window.requestIdleCallback(cb, { timeout: 5000 })
      : (cb: () => void) => setTimeout(cb, 100)

    // Get gifts that haven't been preloaded yet
    const giftsToPreload = bootstrapStore.giftCatalog.filter(
      (gift) => gift.animation_url && gift.asset_type !== 'image'
    )

    if (giftsToPreload.length === 0) {
      log.debug('No gifts to preload')
      return
    }

    log.debug('Starting idle preload for', giftsToPreload.length, 'gifts')

    let index = 0

    function preloadNext(): void {
      if (index >= giftsToPreload.length) {
        log.debug('Idle preload complete')
        return
      }

      const gift = giftsToPreload[index]
      if (!gift) {
        scheduleIdle(preloadNext)
        return
      }
      index++

      // Preload this gift
      preloadGift(gift).catch(() => {
        // Errors logged in preloadGift
      })

      // Schedule next
      scheduleIdle(preloadNext)
    }

    // Start the chain
    scheduleIdle(preloadNext)
  }

  return {
    startIdlePreload,
  }
}
