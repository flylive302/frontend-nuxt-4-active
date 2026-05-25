// ========================================
// Bootstrap Assets Composable
// ========================================
// Role: Infrastructure composable — owns asset download orchestration.
// Pipeline: GATE → EXECUTE → REACT

import type { AssetManifestItem } from '~/constants/assetManifest'
import { MANUAL_ASSET_MANIFEST, PAGE_ASSET_MANIFESTS } from '~/constants/assetManifest'
import type { AssetScope, EnqueueItem, EnqueueOptions, AssetInvalidatePayload } from '~/types/asset/asset'
import * as assetDownloader from '~/services/assetDownloader'
import * as cacheStorage from '~/services/cacheStorage'
import * as assetIndex from '~/services/assetIndex'
import { resolveVideoUrl } from '~/utils/platform'
import { createLogger } from '~/utils/logger'

const log = createLogger('[BootstrapAssets]')

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    parsed.hash = ''
    parsed.searchParams.sort()
    return parsed.toString()
  } catch {
    return url.trim()
  }
}

function toEnqueueItem(item: AssetManifestItem): EnqueueItem {
  return {
    url: normalizeUrl(item.url),
    assetType: item.assetType,
    priority: item.priority,
    scope: item.scope,
    groupKey: item.groupKey,
    giftId: item.giftId,
    badgeId: item.badgeId,
    sortOrder: item.sortOrder,
  }
}

/**
 * Orchestrates asset downloading after bootstrap.
 * Downloads gift, badge, page, and manual assets into Cache Storage
 * with priority-based queuing and progress tracking.
 */
function isHomePath(path: string): boolean {
  return path === '/' || path === ''
}

export function useBootstrapAssets() {
  const bootstrapStore = useBootstrapStore()
  const assetStore = useAssetStore()
  const route = useRoute()

  function getRouteScope(): AssetScope | null {
    const path = route.path
    if (path.startsWith('/mall')) return 'mall'
    if (path.startsWith('/wallet')) return 'wallet'
    if (path.startsWith('/badges')) return 'badge'
    return null
  }

  function getPageAssets(): AssetManifestItem[] {
    const scope = getRouteScope()
    if (!scope) return []

    if (scope === 'mall') return PAGE_ASSET_MANIFESTS.mall ?? []
    if (scope === 'wallet') return PAGE_ASSET_MANIFESTS.wallet ?? []
    if (scope === 'badge') return PAGE_ASSET_MANIFESTS.badges ?? []
    return []
  }

  function getBootstrapAssets(filters?: { skipGiftVideos?: boolean; giftVideosOnly?: boolean }): AssetManifestItem[] {
    const items: AssetManifestItem[] = []

    const badges = bootstrapStore.badges ?? []
    if (!filters?.giftVideosOnly) {
      for (const badge of badges) {
        if (!badge.image_url) continue
        items.push({
          url: badge.image_url,
          assetType: 'image',
          scope: 'badge',
          priority: 'normal',
          badgeId: badge.id,
          groupKey: 'bootstrap-badges',
          sortOrder: 50,
        })
      }
    }

    const gifts = bootstrapStore.gifts ?? []
    for (const gift of gifts) {
      if (!gift.animation_url || gift.asset_type === 'image') continue
      const isVideo = gift.asset_type === 'video'
      if (filters?.giftVideosOnly && !isVideo) continue
      if (filters?.skipGiftVideos && isVideo) continue
      items.push({
        url: resolveVideoUrl(gift.animation_url),
        assetType: gift.asset_type === 'svga' ? 'svga' : 'video',
        scope: 'gift',
        priority: 'normal',
        giftId: gift.id,
        groupKey: 'bootstrap-gifts',
        sortOrder: gift.sort_order,
      })
    }

    return items
  }

  function buildAssetQueue(options?: { giftBootstrapVideosOnly?: boolean }): EnqueueItem[] {
    const giftVideosOnly = options?.giftBootstrapVideosOnly === true
    const skipGiftVideos = !giftVideosOnly && isHomePath(route.path)

    const allItems = giftVideosOnly
      ? getBootstrapAssets({ giftVideosOnly: true })
      : [
          ...MANUAL_ASSET_MANIFEST,
          ...getBootstrapAssets({ skipGiftVideos }),
          ...getPageAssets(),
        ]

    const seen = new Set<string>()
    const queue: EnqueueItem[] = []

    for (const item of allItems) {
      const url = normalizeUrl(item.url)
      if (seen.has(url)) continue
      seen.add(url)
      queue.push(toEnqueueItem({ ...item, url }))
    }

    queue.sort((a, b) => {
      const priorityWeight = { critical: 0, high: 1, normal: 2, low: 3 } as const
      const aPriority = priorityWeight[a.priority]
      const bPriority = priorityWeight[b.priority]

      if (aPriority !== bPriority) return aPriority - bPriority
      return (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity)
    })

    return queue
  }

  /**
   * Start downloading all relevant assets after bootstrap.
   * `giftBootstrapVideosOnly`: enqueue bootstrap gift `.webm` after `window` load so home LCP is not competing with ~MB videos.
   */
  async function startAssetDownload(options?: { giftBootstrapVideosOnly?: boolean }): Promise<void> {
    await cacheStorage.initCacheStorage()
    await assetIndex.initAssetIndex()

    const items = buildAssetQueue({ giftBootstrapVideosOnly: options?.giftBootstrapVideosOnly })
    if (items.length === 0) {
      if (!options?.giftBootstrapVideosOnly) {
        assetStore.setPhase('complete')
      }
      return
    }

    if (options?.giftBootstrapVideosOnly) {
      await assetDownloader.enqueue(items)
      assetDownloader.start()
      return
    }

    if (assetStore.phase === 'downloading') {
      return
    }

    assetDownloader.onProgress((progress) => {
      assetStore.setProgress(progress)
    })

    assetDownloader.onComplete(() => {
      assetStore.setPhase('complete')
    })

    assetStore.setPhase('downloading')

    await assetDownloader.enqueue(items)

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
   */
  async function invalidateAsset(payload: AssetInvalidatePayload): Promise<void> {

    await cacheStorage.deleteAsset(payload.url)
    await assetIndex.remove(payload.url)

    if (payload.priority === 'critical') {
      assetDownloader.enqueueManual(payload.url, {
        priority: 'critical',
        assetType: payload.badgeId ? 'image' : 'video',
        scope: payload.badgeId ? 'badge' : 'gift',
        giftId: payload.giftId,
        badgeId: payload.badgeId,
      })
    }

  }

  function pause(): void {
    assetDownloader.pause()
  }

  function resume(): void {
    assetDownloader.resume()
  }

  return {
    startAssetDownload,
    enqueueAsset,
    invalidateAsset,
    pause,
    resume,
  }
}