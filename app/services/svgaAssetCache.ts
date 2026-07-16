// ========================================
// SVGA Asset Cache Service
// ========================================
// Services = Low-level infra (cache, asset downloading, network).
// No store imports, no UI concerns.
//
// Read-through persistence for SVGA binaries (avatar frames, VIP effects,
// entry slides, badges). Replaces the retired workbox `svga-cache` bucket
// (ADR 0020): SVGA loads resolve through the app-owned 'flylive-assets-v1'
// Cache Storage bucket on both web and native, indexed in assetIndex so the
// existing staleness eviction applies. Entries fetched here that aren't part
// of a bootstrap manifest carry scope 'runtime', which the catalog-diff
// eviction skips.

import * as cacheStorage from '~/services/cacheStorage'
import * as assetIndex from '~/services/assetIndex'
import { normalizeAssetUrl, rewriteR2UrlForDevFetch } from '~/utils/asset-url'
import { createLogger } from '~/utils/logger'

const log = createLogger('[SvgaAssetCache]')

export interface SvgaSource {
  /** URL to hand the SVGA parser: a blob URL when cached, the original URL otherwise. */
  src: string
  /** Release the blob URL once the parser has consumed it. No-op for passthrough. */
  revoke: () => void
}

const NOOP = (): void => {}

/**
 * Resolve an SVGA URL through the persistent asset cache.
 *
 * Cache Storage hit → blob URL (offline-capable, no network).
 * Miss → fetch, persist to Cache Storage + assetIndex, return blob URL.
 * Any failure → passthrough to the original URL so the parser's own
 * network fetch remains the last resort.
 */
export async function resolveSvgaSource(rawUrl: string): Promise<SvgaSource> {
  if (!/^https?:\/\//i.test(rawUrl)) {
    return { src: rawUrl, revoke: NOOP }
  }

  const url = normalizeAssetUrl(rawUrl)

  try {
    const cachedBlobUrl = await cacheStorage.getAsset(url)
    if (cachedBlobUrl) {
      void assetIndex.updateLastAccessed(url)
      return { src: cachedBlobUrl, revoke: () => URL.revokeObjectURL(cachedBlobUrl) }
    }

    const response = await fetch(rewriteR2UrlForDevFetch(url))
    if (!response.ok) {
      return { src: rawUrl, revoke: NOOP }
    }
    const blob = await response.blob()

    await persist(url, blob)

    const blobUrl = URL.createObjectURL(blob)
    return { src: blobUrl, revoke: () => URL.revokeObjectURL(blobUrl) }
  } catch (e) {
    log.warn('SVGA cache resolve failed, falling back to network URL', url, e)
    return { src: rawUrl, revoke: NOOP }
  }
}

/**
 * Drop a cached SVGA entry (e.g. when the cached bytes fail to parse).
 */
export async function evictSvga(rawUrl: string): Promise<void> {
  const url = normalizeAssetUrl(rawUrl)
  try {
    await cacheStorage.deleteAsset(url)
    await assetIndex.remove(url)
  } catch (e) {
    log.warn('Failed to evict SVGA cache entry', url, e)
  }
}

/**
 * Persist blob + metadata. An entry already indexed by the bootstrap pipeline
 * keeps its scope/priority; ad-hoc loads are indexed as 'runtime'.
 */
async function persist(url: string, blob: Blob): Promise<void> {
  try {
    await cacheStorage.putAsset(url, blob)
    const existing = await assetIndex.get(url)
    await assetIndex.upsert({
      url,
      assetType: 'svga',
      priority: existing?.priority ?? 'normal',
      scope: existing?.scope ?? 'runtime',
      groupKey: existing?.groupKey,
      sizeBytes: blob.size,
      giftId: existing?.giftId,
      badgeId: existing?.badgeId,
      downloadedAt: Date.now(),
      lastAccessedAt: Date.now(),
      retryCount: 0,
    })
  } catch (e) {
    // Persistence is best-effort (quota, private mode) — playback proceeds.
    log.warn('Failed to persist SVGA asset', url, e)
  }
}
