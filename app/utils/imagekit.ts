// ========================================
// ImageKit URL helpers (pure)
// ========================================

const IK_HOST = 'ik.imagekit.io'

export interface ImageKitTransformOpts {
  /** Max width in px (ImageKit `w-` transform) */
  w: number
  /** JPEG/WebP quality 1–100 */
  q?: number
}

/**
 * Append ImageKit `tr` when the URL is on ik.imagekit.io and has no existing `tr`.
 * Full URLs from the API bypass @nuxt/image's provider resize; this keeps bytes aligned to `sizes`.
 */
export function withImageKitTransform(url: string | null | undefined, opts: ImageKitTransformOpts): string {
  if (!url) return ''
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  if (!parsed.hostname.includes(IK_HOST)) return url
  if (parsed.searchParams.has('tr')) return url

  const q = opts.q ?? 75
  parsed.searchParams.set('tr', `w-${opts.w},q-${q},c-maintain_ratio,f-auto`)
  return parsed.toString()
}

/**
 * Gift thumbnail URL — the single shared variant for every gift-thumb surface
 * (drawer card, lucky fly, playback poster, profile history). One variant per
 * gift means one cached copy serves all surfaces. NuxtImg's width/format props
 * are no-ops for absolute CDN URLs (no `domains` config), so the `tr` param
 * here is what actually resizes.
 */
export function giftThumbnailSrc(url: string | null | undefined): string {
  return withImageKitTransform(url, { w: 256, q: 75 })
}

/**
 * Fullscreen static-gift display — larger variant, only fetched when an
 * image-type gift actually plays.
 */
export function giftStaticDisplaySrc(url: string | null | undefined): string {
  return withImageKitTransform(url, { w: 512, q: 80 })
}

export type RoomCardLayout = 'carousel' | 'grid'

/**
 * Room card background URL. Single source of truth: the rendered <img> and the
 * LCP <link rel=preload> must produce byte-identical URLs or the preload is discarded.
 * Carousel ~240px CSS width — w=360 (~1.5x) balances DPR vs Lighthouse oversize; grid ~160 — w=320.
 */
export function roomBackgroundImageSrc(
  background: string | null | undefined,
  layout: RoomCardLayout,
  highFetchPriority: boolean,
): string {
  const isCarousel = layout === 'carousel'
  return withImageKitTransform(background, {
    w: isCarousel ? 360 : 320,
    q: isCarousel && !highFetchPriority ? 80 : 85,
  })
}
