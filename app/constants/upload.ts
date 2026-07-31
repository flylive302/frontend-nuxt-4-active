// ========================================
// Image Upload Caps (cdn-bandwidth/02)
// ========================================
// Per-asset-class ceilings applied client-side before an image is sent to
// ImageKit. Keyed by upload folder because that is the only discriminator
// `uploadImage()` receives — deriving the cap from it means every caller,
// including the ones going through `createUploadState()`, inherits the cap
// with no signature change.

import type { ImageUploadFolder } from '~/types/asset/upload'

export interface UploadImageCap {
  /** Longest edge in pixels; the image is scaled down to fit, never up. */
  maxLongEdge: number
  /** Re-encode quality (0-1) for lossy output formats. */
  quality: number
  /**
   * Keep a transparent source as PNG instead of flattening it onto JPEG.
   * Only safe on small caps — a 1600px PNG is larger than the original it
   * replaces, which defeats the point.
   */
  preserveAlpha: boolean
}

/**
 * National IDs carry the highest quality because they are a compliance
 * artifact that an admin has to read; everything else is display art.
 */
export const UPLOAD_IMAGE_CAPS: Record<ImageUploadFolder, UploadImageCap> = {
  // Avatars are shown FULLSCREEN by `image-preview-modal.vue`, so a small cap
  // here is visible blur on a modern phone — and it buys nothing, because the
  // median avatar is already 62 KB. Matching the crop ceiling means the crop
  // flow's own cap does the work in a single encode; the MB-scale tail is
  // already handled by CROP_RESULT_MAX_LONG_EDGE_PX, not by this entry.
  //
  // preserveAlpha is false because it could never fire: both avatar entry
  // points (`profile-wizard.vue`, `image-preview-modal.vue`) crop with
  // outputFormat 'image/jpeg', so alpha is gone before `uploadImage` sees it.
  'avatars': { maxLongEdge: 1600, quality: 0.85, preserveAlpha: false },
  // 1600, not 1200, to match CROP_RESULT_MAX_LONG_EDGE_PX. Covers arrive from
  // the crop flow already capped at 1600; a 1200 ceiling would re-decode and
  // re-encode that JPEG a second time, and two lossy generations on a wide
  // hero image is exactly where softness becomes visible.
  'covers': { maxLongEdge: 1600, quality: 0.85, preserveAlpha: false },
  'rooms': { maxLongEdge: 1600, quality: 0.85, preserveAlpha: false },
  'agencies/logos': { maxLongEdge: 512, quality: 0.85, preserveAlpha: true },
  'agencies/national-ids': { maxLongEdge: 1600, quality: 0.90, preserveAlpha: false },
  'coin-request-proofs': { maxLongEdge: 1600, quality: 0.85, preserveAlpha: false },
  'support-attachments': { maxLongEdge: 1600, quality: 0.85, preserveAlpha: false },
}

/**
 * Ceiling for the crop modal's result canvas. `vue-advanced-cropper` defaults
 * `canvas.maxWidth/maxHeight` to `Infinity`, so without this the cropper
 * re-encodes at full source resolution — a 4608px camera original becomes a
 * multi-MB JPEG before `uploadImage()` ever sees it.
 *
 * Deliberately looser than any entry in `UPLOAD_IMAGE_CAPS`: this only exists
 * to stop the wasteful full-resolution encode. The per-asset ceiling above
 * stays the single source of truth for what actually gets stored.
 */
export const CROP_RESULT_MAX_LONG_EDGE_PX = 1600
