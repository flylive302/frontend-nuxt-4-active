// ========================================
// Bootstrap Assets Composable
// ========================================
// Role: Infrastructure composable — owns asset download orchestration.
// Pipeline: GATE → EXECUTE → REACT

import type { AssetManifestItem } from '~/constants/assetManifest'
import { MANUAL_ASSET_MANIFEST, PAGE_ASSET_MANIFESTS } from '~/constants/assetManifest'
import type { AssetScope, AssetPriority, EnqueueItem, EnqueueOptions, AssetInvalidatePayload } from '~/types/asset/asset'
import { ASSET_CONFIG } from '~/constants/asset'
import * as assetDownloader from '~/services/assetDownloader'
import * as cacheStorage from '~/services/cacheStorage'
import * as assetIndex from '~/services/assetIndex'
import { resolveVideoUrl } from '~/utils/platform'
import { createLogger } from '~/utils/logger'

const log = createLogger('[BootstrapAssets]')

const R2_ORIGIN = 'https://assets.flyliveapp.com'

const PROP_TYPE_PRIORITY: Partial<Record<string, AssetPriority>> = {
  frame: 'critical',
  entry_animation: 'critical',
  chat_bubble: 'high',
  mice_wave: 'high',
  data_card: 'normal',
  slides: 'normal',
}

function isR2Url(url: string): boolean {
  return url.startsWith(R2_ORIGIN)
}

function propAssetType(url: string): 'svga' | 'video' {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.svga') ? 'svga' : 'video'
  } catch {
    return url.toLowerCase().endsWith('.svga') ? 'svga' : 'video'
  }
}

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

export function useBootstrapAssets(routePath?: string) {
  const bootstrapStore = useBootstrapStore()
  const assetStore = useAssetStore()
  const mallStore = useMallStore()
  const authStore = useAuthStore()
  const route = routePath === undefined ? useRoute() : null

  function resolvedPath(): string {
    return routePath ?? route!.path
  }

  function getRouteScope(): AssetScope | null {
    const path = resolvedPath()
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

  function getVipAnimatedAssets(): AssetManifestItem[] {
    const items: AssetManifestItem[] = []
    const levels = bootstrapStore.vipLevels ?? []
    const ownLevel = authStore.user?.vip_level ?? 0

    for (const level of levels) {
      const priority = level.level === ownLevel ? 'critical' : 'high'

      if (level.card_animated_url) {
        items.push({
          url: level.card_animated_url,
          assetType: propAssetType(level.card_animated_url),
          scope: 'vip',
          priority,
          groupKey: 'bootstrap-vip',
        })
      }

      if (level.emblem_animated_url) {
        items.push({
          url: level.emblem_animated_url,
          assetType: propAssetType(level.emblem_animated_url),
          scope: 'vip',
          priority,
          groupKey: 'bootstrap-vip',
        })
      }
    }

    return items
  }

  function getFeaturedRoomAssets(): AssetManifestItem[] {
    const rooms = bootstrapStore.featuredRooms ?? []
    const items: AssetManifestItem[] = []
    for (const room of rooms) {
      if (!room.background) continue
      items.push({
        url: room.background,
        assetType: 'image',
        scope: 'global',
        priority: 'low',
        groupKey: 'featured-rooms',
      })
    }
    return items
  }

  function getBootstrapPropAssets(): AssetManifestItem[] {
    const items: AssetManifestItem[] = []
    for (const prop of Object.values(mallStore.propIndex)) {
      if (!prop.asset_url) continue
      if (!isR2Url(prop.asset_url)) continue
      items.push({
        url: prop.asset_url,
        assetType: propAssetType(prop.asset_url),
        scope: 'mall',
        priority: PROP_TYPE_PRIORITY[prop.type] ?? 'normal',
        groupKey: 'bootstrap-props',
      })
    }
    return items
  }

  function buildAssetQueue(options?: { giftBootstrapVideosOnly?: boolean }): EnqueueItem[] {
    const giftVideosOnly = options?.giftBootstrapVideosOnly === true
    const skipGiftVideos = !giftVideosOnly && isHomePath(resolvedPath())

    const allItems = giftVideosOnly
      ? getBootstrapAssets({ giftVideosOnly: true })
      : [
          ...MANUAL_ASSET_MANIFEST,
          ...getBootstrapAssets({ skipGiftVideos }),
          ...getBootstrapPropAssets(),
          ...getVipAnimatedAssets(),
          ...getPageAssets(),
          ...getFeaturedRoomAssets(),
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

    if (!options?.giftBootstrapVideosOnly) {
      const evictStaleAssets = async () => {
        try {
          const stale = await assetIndex.getStale(ASSET_CONFIG.STALE_DAYS)
          for (const entry of stale) {
            await cacheStorage.deleteAsset(entry.url)
            await assetIndex.remove(entry.url)
          }
        } catch (e) {
          log.warn('Stale asset eviction failed', e)
        }
      }

      // Evict indexed entries whose URLs no longer appear in the current catalog.
      // Runs after initAssetIndex() but does not block buildAssetQueue() or download start.
      // Includes all page manifests (not just current route) to avoid churn on navigation.
      const evictCatalogRemovals = async () => {
        try {
          const catalogUrls = new Set([
            ...MANUAL_ASSET_MANIFEST,
            ...Object.values(PAGE_ASSET_MANIFESTS).flat(),
            ...getBootstrapAssets(),
            ...getBootstrapPropAssets(),
            ...getVipAnimatedAssets(),
            ...getFeaturedRoomAssets(),
          ].map((i) => normalizeUrl(i.url)))
          const indexed = await assetIndex.getAllByPriority()
          for (const entry of indexed) {
            if (!catalogUrls.has(entry.url)) {
              await cacheStorage.deleteAsset(entry.url)
              await assetIndex.remove(entry.url)
            }
          }
        } catch (e) {
          log.warn('Catalog-diff eviction failed', e)
        }
      }

      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => { evictStaleAssets() })
        requestIdleCallback(() => { evictCatalogRemovals() })
      } else if (typeof window !== 'undefined') {
        setTimeout(() => { evictStaleAssets() }, 0)
        setTimeout(() => { evictCatalogRemovals() }, 0)
      }
    }

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
      if (assetStore.failedTotal === 0) {
        assetStore.setPhase('complete')
      } else if (assetStore.completedCount === 0) {
        assetStore.setPhase('error')
      } else {
        assetStore.setPhase('partial')
      }
    })

    assetDownloader.onItemResult((url, priority, succeeded) => {
      if (succeeded) {
        if (priority === 'critical') assetStore.markCriticalSucceeded()
      } else {
        assetStore.markFailed(url)
        if (priority === 'critical') assetStore.markCriticalFailed(url)
      }
    })

    assetStore.setPhase('downloading')

    await assetDownloader.enqueue(items)
    assetStore.setCriticalTotal(assetDownloader.getCriticalQueuedCount())

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

  /**
   * Re-enqueue only the critical assets that exhausted retries.
   * Rebuilds their metadata from the current bootstrap data to get the correct
   * assetType/scope without guessing from the URL. Does NOT touch criticalTotal
   * (the gate's denominator stays fixed). Resets only the critical failure tracking.
   */
  async function retryFailedCriticals(): Promise<void> {
    const failedSet = new Set(assetStore.criticalFailedUrls.map(normalizeUrl))
    if (failedSet.size === 0) return

    assetStore.resetCriticalFailures()

    const allItems = buildAssetQueue()
    const retryItems = allItems.filter((item) => failedSet.has(normalizeUrl(item.url)))
    if (retryItems.length === 0) return

    await assetDownloader.enqueue(retryItems)
    assetDownloader.start()
  }

  /**
   * Re-enqueue only the non-critical assets that exhausted retries, then reset the failure tracking.
   * Uses the full asset queue to recover original metadata (assetType, scope, priority).
   */
  async function retryFailedAssets(): Promise<void> {
    const failedSet = new Set(assetStore.failedUrls.map(normalizeUrl))
    if (failedSet.size === 0) return

    assetStore.resetNonCriticalFailures()
    assetStore.setPhase('downloading')

    const allItems = buildAssetQueue()
    const retryItems = allItems.filter((item) => failedSet.has(normalizeUrl(item.url)))
    if (retryItems.length === 0) return

    await assetDownloader.enqueue(retryItems)
    assetDownloader.start()
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
    retryFailedCriticals,
    retryFailedAssets,
    pause,
    resume,
  }
}