// ========================================
// Bootstrap Assets Composable
// ========================================
// Role: Infrastructure composable — owns asset download orchestration.
// Pipeline: GATE → EXECUTE → REACT
//
// Scope (boot-and-asset-delivery 04): this file precaches ANIMATIONS ONLY into
// Cache Storage — SVGA / video / VAP, the formats the animation players
// read-through from the cache. Pictures (badge images, thumbnails, etc.) are
// never queued here: an `<img>` tag never reads Cache Storage, it uses the
// HTTP cache, so downloading a picture into Cache Storage is a wasted fetch.
// Route/timing policy (when to start, Wi-Fi vs mobile data) lives in a
// separate composable — this file is purely "build the queue + run it".

import type { AssetManifestItem } from '~/constants/assetManifest'
import { MANUAL_ASSET_MANIFEST, PAGE_ASSET_MANIFESTS } from '~/constants/assetManifest'
import type { AssetPriority, EnqueueItem, EnqueueOptions, AssetInvalidatePayload } from '~/types/asset/asset'
import { ASSET_CONFIG } from '~/constants/asset'
import * as assetDownloader from '~/services/assetDownloader'
import * as cacheStorage from '~/services/cacheStorage'
import * as assetIndex from '~/services/assetIndex'
import { resolveVideoUrl } from '~/utils/platform'
import { normalizeAssetUrl } from '~/utils/asset-url'
import { createLogger } from '~/utils/logger'

const log = createLogger('[BootstrapAssets]')

const R2_ORIGIN = 'https://assets.flyliveapp.com'

/** Asset types the animation players actually read back from Cache Storage. */
const ANIMATION_ASSET_TYPES = new Set(['svga', 'video', 'vap'])

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

const normalizeUrl = normalizeAssetUrl

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
 * Downloads gift, page, prop, and VIP animations into Cache Storage with
 * priority-based queuing and progress tracking. No route awareness — the
 * queue is the same regardless of the current page.
 */
export function useBootstrapAssets() {
  const bootstrapStore = useBootstrapStore()
  const assetStore = useAssetStore()
  const mallStore = useMallStore()
  const authStore = useAuthStore()

  /**
   * Bootstrap-catalog animations only. Badges are pictures (`image_url`) and
   * are never queued here — they rely on the HTTP cache like any other `<img>`.
   */
  function getBootstrapAssets(): AssetManifestItem[] {
    const items: AssetManifestItem[] = []

    const gifts = bootstrapStore.gifts ?? []
    for (const gift of gifts) {
      if (!gift.animation_url || gift.asset_type === 'image') continue
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

  /**
   * Build the download queue.
   * `'gifts'` — bootstrap gift animations only (used for the room-entry fast path).
   * `'all'` — the full animation set: manual manifest + gifts + props + VIP + all page manifests.
   * Page manifests are no longer route-scoped — the full set is always included.
   */
  function buildAssetQueue(set: 'all' | 'gifts'): EnqueueItem[] {
    const allItems = set === 'gifts'
      ? getBootstrapAssets()
      : [
          ...MANUAL_ASSET_MANIFEST,
          ...getBootstrapAssets(),
          ...getBootstrapPropAssets(),
          ...getVipAnimatedAssets(),
          ...Object.values(PAGE_ASSET_MANIFESTS).flat(),
        ]

    const seen = new Set<string>()
    const queue: EnqueueItem[] = []

    for (const item of allItems) {
      // Defence in depth: the queue can never carry a picture, even if a
      // manifest entry is miscategorized upstream.
      if (!ANIMATION_ASSET_TYPES.has(item.assetType)) continue
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
   * Open the cache + index (deprecated buckets are dropped on open), then
   * schedule the two eviction passes (stale-by-age, catalog-diff) on
   * `requestIdleCallback` so they never compete with the download itself.
   * Local work only — the delivery policy runs it on every network.
   */
  async function evictAssets(): Promise<void> {
    await cacheStorage.initCacheStorage()
    await assetIndex.initAssetIndex()

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
    // GATE: an empty gift list or prop index means the catalog hasn't loaded
    // yet — diffing against it would look like every animation was removed
    // and delete the full ~233 MB cache. Skip the pass entirely in that case;
    // stale-by-age eviction still runs and is unaffected.
    const evictCatalogRemovals = async () => {
      const gifts = bootstrapStore.gifts ?? []
      const propCount = Object.keys(mallStore.propIndex).length
      if (gifts.length === 0 || propCount === 0) {
        log.warn('Catalog-diff eviction skipped: catalog not loaded (empty gifts or propIndex)')
        return
      }

      try {
        const catalogUrls = new Set([
          ...MANUAL_ASSET_MANIFEST,
          ...Object.values(PAGE_ASSET_MANIFESTS).flat(),
          ...getBootstrapAssets(),
          ...getBootstrapPropAssets(),
          ...getVipAnimatedAssets(),
        ].map((i) => normalizeUrl(i.url)))
        const indexed = await assetIndex.getAllByPriority()
        for (const entry of indexed) {
          // 'runtime' entries (ad-hoc SVGA read-through: other users' frames,
          // badges, entry slides) never appear in any manifest — staleness
          // eviction covers them instead.
          if (entry.scope === 'runtime') continue
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

  /**
   * Start downloading the full animation set after bootstrap.
   * `quiet: true` — automatic background pass: enqueue + start only, never
   * touches `assetStore` (no phase, no progress/complete/item-result
   * subscriptions). `quiet: false` (default) — the user's manual button in
   * the asset-manager modal: today's UI-visible behaviour.
   */
  async function startAssetDownload(options?: { quiet?: boolean }): Promise<void> {
    await evictAssets()

    const items = buildAssetQueue('all')

    if (options?.quiet) {
      if (items.length === 0) return
      await assetDownloader.enqueue(items)
      assetDownloader.start()
      return
    }

    if (items.length === 0) {
      assetStore.setPhase('complete')
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

    assetDownloader.onItemResult((url, _priority, succeeded) => {
      if (!succeeded) assetStore.markFailed(url)
    })

    assetStore.setPhase('downloading')

    await assetDownloader.enqueue(items)

    assetDownloader.start()
  }

  /**
   * Bootstrap gift animations only — the room-entry fast path. Always quiet
   * (no `assetStore` changes) and never runs eviction.
   */
  async function startRoomAssetDownload(): Promise<void> {
    await cacheStorage.initCacheStorage()
    await assetIndex.initAssetIndex()

    const items = buildAssetQueue('gifts')
    if (items.length === 0) return

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
   * Badges are pictures now, so a badge is never re-enqueued here.
   */
  async function invalidateAsset(payload: AssetInvalidatePayload): Promise<void> {

    await cacheStorage.deleteAsset(payload.url)
    await assetIndex.remove(payload.url)

    if (payload.priority === 'critical' && !payload.badgeId) {
      assetDownloader.enqueueManual(payload.url, {
        priority: 'critical',
        assetType: 'video',
        scope: 'gift',
        giftId: payload.giftId,
        badgeId: payload.badgeId,
      })
    }

  }

  /**
   * Re-enqueue the assets that exhausted retries, then reset the failure tracking.
   * Uses the full asset queue to recover original metadata (assetType, scope, priority).
   */
  async function retryFailedAssets(): Promise<void> {
    const failedSet = new Set(assetStore.failedUrls.map(normalizeUrl))
    if (failedSet.size === 0) return

    assetStore.resetFailures()
    assetStore.setPhase('downloading')

    const allItems = buildAssetQueue('all')
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
    startRoomAssetDownload,
    evictAssets,
    enqueueAsset,
    invalidateAsset,
    retryFailedAssets,
    pause,
    resume,
  }
}
