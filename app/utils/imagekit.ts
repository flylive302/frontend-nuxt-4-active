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

/** Default avatar variant width — see `avatarImageSrc` for the sizing rationale. */
const AVATAR_DEFAULT_WIDTH = 256

/**
 * Profile-header avatar variant — the one surface rendered far above the
 * common cluster (`pages/profile/index.vue`, ~250–320px CSS → ~2x DPR).
 */
export const PROFILE_HEADER_AVATAR_WIDTH = 512
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
