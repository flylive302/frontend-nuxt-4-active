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
