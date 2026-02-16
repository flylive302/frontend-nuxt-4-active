/**
 * Asset URL Resolution Utility
 *
 * Centralized CDN URL resolver for R2-hosted assets (SVGA JSONs, gift videos, VIP images).
 * In production, resolves to `https://assets.flyliveapp.com/<path>`.
 * In development, falls back to local `public/` paths via `/<path>`.
 */

// ========================================
// Constants
// ========================================

/** Paths served from R2 that should be resolved through the CDN */
const CDN_PREFIXES = [
  '/parsedAnimations/',
  '/room/',
] as const

// ========================================
// Helpers
// ========================================

/**
 * Get the CDN base URL from runtime config.
 * Returns empty string in dev (falls back to local public/).
 */
function getCdnBase(): string {
  try {
    const config = useRuntimeConfig()
    return (config.public.assetCdnUrl as string) ?? ''
  } catch {
    // Outside Nuxt context (SSR bootstrap, tests) — fall back to local
    return ''
  }
}

// ========================================
// Public API
// ========================================

/**
 * Resolve a local asset path to its CDN URL.
 *
 * @param path - Relative path starting with `/` (e.g. `/parsedAnimations/vip/1/card.json`)
 * @returns Full CDN URL in production, unchanged path in development
 *
 * @example
 * resolveAssetUrl('/parsedAnimations/vip/1/card.json')
 * // prod → 'https://assets.flyliveapp.com/parsedAnimations/vip/1/card.json'
 * // dev  → '/parsedAnimations/vip/1/card.json'
 */
export function resolveAssetUrl(path: string): string {
  const cdnBase = getCdnBase()
  if (!cdnBase) return path

  // Only prefix paths that live on R2
  const isCdnAsset = CDN_PREFIXES.some(prefix => path.startsWith(prefix))
  if (!isCdnAsset) return path

  return `${cdnBase}${path}`
}

/**
 * Resolve an SVGA animation name to the full JSON URL.
 *
 * @param name - Animation name (e.g. `vip/1/card`, `frames/18`)
 * @returns Full URL to the parsed animation JSON
 *
 * @example
 * resolveAnimationUrl('vip/1/card')
 * // prod → 'https://assets.flyliveapp.com/parsedAnimations/vip/1/card.json'
 * // dev  → '/parsedAnimations/vip/1/card.json'
 */
export function resolveAnimationUrl(name: string): string {
  return resolveAssetUrl(`/parsedAnimations/${name}.json`)
}

/**
 * Resolve a VIP asset path to the full URL.
 *
 * @param level - VIP level number
 * @param filename - Asset filename (e.g. `badge.png`, `border.png`)
 * @returns Full URL to the VIP asset
 */
export function resolveVipAssetUrl(level: number, filename: string): string {
  return resolveAssetUrl(`/parsedAnimations/vip/${level}/${filename}`)
}
