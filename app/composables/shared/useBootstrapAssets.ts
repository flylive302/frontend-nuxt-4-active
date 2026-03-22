// ========================================
// Bootstrap Assets Composable
// ========================================
// Role: Infrastructure composable — owns asset download orchestration.
// Pipeline: GATE → EXECUTE → REACT

import type { EnqueueItem, EnqueueOptions, AssetInvalidatePayload } from '~/types/asset/asset'
import { ASSET_CONFIG } from '~/constants/asset'
import * as assetDownloader from '~/services/assetDownloader'
import * as cacheStorage from '~/services/cacheStorage'
import * as assetIndex from '~/services/assetIndex'
import { resolveVideoUrl } from '~/utils/platform'
import { createLogger } from '~/utils/logger'

const log = createLogger('[BootstrapAssets]')

// ========================================
// Composable
// ========================================

/**
 * Orchestrates asset downloading after bootstrap.
 * Downloads gift animation assets (video/svga) into Cache Storage
 * with priority-based queuing and progress tracking.
 *
 * State lives in useAssetStore (ARCHITECTURE.md: "long-lived reactive
 * state belongs in stores, not composables").
 */
export function useBootstrapAssets() {
  const bootstrapStore = useBootstrapStore()
  const assetStore = useAssetStore()

  // ========================================
  // Actions
  // ========================================

  /**
   * Start downloading gift assets after bootstrap.
   *
   * GATE: Skip if already downloading or no gifts
   * EXECUTE: Init services, build queue, enqueue
   * REACT: Subscribe to progress, update store
   */
  async function startAssetDownload(): Promise<void> {
    // GATE — skip if already downloading
    if (assetStore.phase === 'downloading') {
      log.warn('Asset download already in progress')
      return
    }

    // GATE — skip if no gifts to download
    const gifts = bootstrapStore.giftCatalog
    if (gifts.length === 0) {
      assetStore.setPhase('complete')
      return
    }

    // EXECUTE — initialize services
    await cacheStorage.initCacheStorage()
    await assetIndex.initAssetIndex()

    // EXECUTE — build queue from gift catalog
    const items: EnqueueItem[] = gifts
      .filter((gift) => gift.animation_url && gift.asset_type !== 'image')
      .map((gift, index) => ({
        url: resolveVideoUrl(gift.animation_url!),
        assetType: gift.asset_type === 'svga' ? 'svga' : 'video',
        priority: index < ASSET_CONFIG.CRITICAL_COUNT ? 'critical' : 'normal',
        giftId: gift.id,
        sortOrder: gift.sort_order,
      }))

    if (items.length === 0) {
      assetStore.setPhase('complete')
      return
    }

    // REACT — subscribe to progress updates for UI state
    assetDownloader.onProgress((progress) => {
      assetStore.setProgress(progress)
    })

    assetDownloader.onComplete(() => {
      assetStore.setPhase('complete')
    })

    // EXECUTE — enqueue items and start download processing
    assetStore.setPhase('downloading')
    assetDownloader.enqueue(items)
    assetDownloader.start()
  }

  /**
   * Manually enqueue a single asset for download.
   */
  function enqueueAsset(url: string, options: EnqueueOptions): void {
    assetDownloader.enqueueManual(url, options)
  }

  /**
   * Invalidate a cached asset and optionally re-download.
   * Called from system.events.ts on 'asset:invalidate'.
   *
   * EXECUTE: Remove from cache + index
   * REACT: Re-enqueue if critical
   */
  async function invalidateAsset(payload: AssetInvalidatePayload): Promise<void> {
    log.debug('Invalidating asset:', payload.url)

    // EXECUTE — remove from cache storage and IndexedDB
    await cacheStorage.deleteAsset(payload.url)
    await assetIndex.remove(payload.url)

    // REACT — re-download if critical (fire-and-forget)
    if (payload.priority === 'critical') {
      assetDownloader.enqueueManual(payload.url, {
        priority: 'critical',
        assetType: 'video',
      })
    }

    log.debug('Asset invalidated:', payload.url)
  }

  /**
   * Pause download processing.
   */
  function pause(): void {
    assetDownloader.pause()
  }

  /**
   * Resume download processing.
   */
  function resume(): void {
    assetDownloader.resume()
  }

  return {
    // Actions
    startAssetDownload,
    enqueueAsset,
    invalidateAsset,
    pause,
    resume,
  }
}
