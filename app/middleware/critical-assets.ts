// ========================================
// Critical Assets Route Guard
// ========================================
// GATE — confirms critical assets are cached before home renders.
// ssr: false means this always runs on the client; the server guard is defensive only.
//
// Evaluated in order:
// 1. hasDegradedAssets → bypass (user accepted degraded experience this session)
// 2. isCriticalGateOpen → bypass (in-memory fast path, no Cache API calls)
// 3. Cache sweep: hasAsset() for each critical URL
//    All present → setCacheSweptAndConfirmed(true), proceed
//    Any missing  → setShowDownloadGate(true), start download (fire-and-forget)

import { MANUAL_ASSET_MANIFEST } from '~/constants/assetManifest'
import * as cacheStorage from '~/services/cacheStorage'

function normalizeCacheKey(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    parsed.searchParams.sort()
    return parsed.toString()
  } catch {
    return url.trim()
  }
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const assetStore = useAssetStore()
  const { startAssetDownload } = useBootstrapAssets(to.path)

  // Fast path 1: user accepted degraded experience this session
  if (assetStore.hasDegradedAssets) return

  // Fast path 2: gate already open (completed download or previous sweep this session)
  if (assetStore.isCriticalGateOpen) return

  // Cache sweep: check all critical manifest URLs in parallel
  const criticalUrls = MANUAL_ASSET_MANIFEST
    .filter((item) => item.priority === 'critical')
    .map((item) => normalizeCacheKey(item.url))

  const results = await Promise.all(criticalUrls.map((url) => cacheStorage.hasAsset(url)))

  if (results.every(Boolean)) {
    // All present — confirm for subsequent navigations this session (no sweep needed again)
    assetStore.setCacheSweptAndConfirmed(true)
    return
  }

  // Some critical assets missing — show gate and start download (fire-and-forget)
  assetStore.setShowDownloadGate(true)
  void startAssetDownload()
})
