// ========================================
// Asset URL Utilities
// ========================================
// Pure helpers shared by the asset pipeline (downloader, bootstrap queue,
// SVGA read-through cache). Cache Storage + assetIndex key entries by the
// normalized URL, so every reader/writer must normalize identically.

const R2_ORIGIN = 'https://assets.flyliveapp.com'

/**
 * Canonical cache key for an asset URL: absolute, no hash, sorted query params.
 */
export function normalizeAssetUrl(url: string): string {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    parsed.hash = ''
    parsed.searchParams.sort()
    return parsed.toString()
  } catch {
    return url.trim()
  }
}

/** In Vite dev, load R2 through same-origin `/__r2` proxy (see `nuxt.config` vite.server.proxy). */
export function rewriteR2UrlForDevFetch(url: string): string {
  if (!import.meta.dev || typeof window === 'undefined') return url
  if (!url.startsWith(R2_ORIGIN)) return url
  return `/__r2${url.slice(R2_ORIGIN.length)}`
}
