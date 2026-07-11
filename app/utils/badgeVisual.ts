/**
 * Badge Visual Resolution
 *
 * Pure decision: does a badge render as an animated asset or a static image?
 * Animated iff `assetUrl` is a non-empty string. No Vue imports — unit-testable in isolation.
 */

export interface ResolvedBadgeAsset {
  /** True when an animated asset should be rendered on top of the static image. */
  animated: boolean
  /** The static image src (always present, used as base layer + thumbnail). */
  src: string
}

export function resolveBadgeAsset(
  imageUrl: string,
  assetUrl?: string | null
): ResolvedBadgeAsset {
  return {
    animated: typeof assetUrl === 'string' && assetUrl.length > 0,
    src: imageUrl,
  }
}
