// ========================================
// ImageKit URL helpers (pure)
// ========================================

const IK_HOST = 'ik.imagekit.io'

export interface ImageKitTransformOpts {
  /** Max width in px (ImageKit `w-` transform) */
  w?: number
  /**
   * Max height in px (ImageKit `h-` transform).
   *
   * Use this — not `w` — for surfaces whose CSS constrains HEIGHT (Tailwind `h-5`, `h-7`, …)
   * when the source aspect ratio varies between images. Level badges are the motivating case:
   * `badges/wealth/1.webp` is 512x158 (aspect 3.24) while `badges/charm/1.webp` is 374x136
   * (aspect 2.75), so a single `w-` value under-serves one and over-serves the other. An `h-5`
   * badge paints ~65 CSS px wide at aspect 3.24 — requesting `w-48` there would UPSCALE and
   * look blurry.
   */
  h?: number
  /** JPEG/WebP quality 1–100 */
  q?: number
}

/**
 * Append ImageKit `tr` when the URL is on ik.imagekit.io and has no existing `tr`.
 * Full URLs from the API bypass @nuxt/image's provider resize; this keeps bytes aligned to `sizes`.
 *
 * Pass `w`, `h`, or both. Passing neither is a no-op (the URL is returned untouched) rather than
 * emitting a dimensionless `tr`.
 *
 * ⚠️ Param ORDER below is deliberate and load-bearing: `w-…,q-…,c-maintain_ratio,f-auto` is the
 * exact string already baked into `~/constants/assets` and already cached at the CDN edge for
 * millions of requests. Reordering would fork every cache entry. Append new params, never reorder.
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
  if (opts.w === undefined && opts.h === undefined) return url

  const q = opts.q ?? 75
  const parts: string[] = []
  if (opts.w !== undefined) parts.push(`w-${opts.w}`)
  if (opts.h !== undefined) parts.push(`h-${opts.h}`)
  parts.push(`q-${q}`, 'c-maintain_ratio', 'f-auto')

  parsed.searchParams.set('tr', parts.join(','))
  return parsed.toString()
}

/**
 * DPR factor applied to every CSS-pixel size this module converts into a CDN request.
 *
 * 2.5 targets the mid/budget Android hardware this app is mobile-first for (DPR 2.0-2.75).
 * Shipped at 2.0 first and reviewed as too soft; 3.0 was rejected because these badges are
 * 20-frame animated WebP whose bytes climb steeply with resolution, and they render once per
 * chat message — the highest-volume image loop in the product.
 */
const DPR_FACTOR = 2.5

/**
 * Level-badge variant (wealth / charm / VIP emblem), served from the API as `badge.image_url`.
 *
 * Height-constrained on purpose — see `ImageKitTransformOpts.h`. Callers pass the rendered CSS
 * height (the Tailwind `h-*` value in px) and the DPR factor is applied once, here, so every
 * badge surface derives its variant the same way.
 *
 * ⚠️ Only for badges laid out by height. A badge rendered at a WIDTH (e.g. the profile page's
 * `w-7/12`) must not use this — size that with `withImageKitTransform({ w })` against the real
 * painted width, or it ships blurry.
 */
export function levelBadgeSrc(url: string | null | undefined, cssHeightPx: number): string {
  return withImageKitTransform(url, { h: Math.ceil(cssHeightPx * DPR_FACTOR), q: 75 })
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

/** Default avatar variant width — see `avatarImageSrc` for the sizing rationale. */
const AVATAR_DEFAULT_WIDTH = 256

/**
 * Profile-header avatar variant — the one surface rendered far above the
 * common cluster (`pages/profile/index.vue`, ~250–320px CSS → ~2x DPR).
 */
export const PROFILE_HEADER_AVATAR_WIDTH = 768
/** Default avatar variant quality. */
const AVATAR_DEFAULT_QUALITY = 75

/**
 * Avatar URL — the single shared variant for nearly every avatar surface
 * (room seats × up to 15, chat message history, member/participant lists,
 * inbox thread rows, ranking podiums). One variant per user avatar means one
 * cached copy serves virtually all of these, mirroring `giftThumbnailSrc`'s
 * design.
 *
 * Sized at 256px (~2x DPR) against the largest COMMON rendered CSS size
 * across call sites, roughly 96–128px (e.g. `room/seat-drawer.vue`
 * `size-32`, `room/participant-profile-modal.vue` `size-24`) — the far more
 * numerous small surfaces (seats, chat, member lists: 40–64px) simply
 * downscale from the same cached copy instead of each fetching their own.
 *
 * A few surfaces render dramatically larger than that cluster — notably the
 * profile-header avatar (`pages/profile/index.vue`, `w-9/12` of viewport,
 * ~250–320px CSS). Pass `opts.w` (and optionally `opts.q`) to request a
 * bigger variant for just that context instead of inflating the shared
 * default for every other surface.
 */
export function avatarImageSrc(url: string | null | undefined, opts?: Partial<ImageKitTransformOpts>): string {
  return withImageKitTransform(url, {
    w: opts?.w ?? AVATAR_DEFAULT_WIDTH,
    q: opts?.q ?? AVATAR_DEFAULT_QUALITY,
  })
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
