// ========================================
// Image file helpers (pure)
// ========================================
// Shared by FileUpload and ImagePreviewModal for validating picked image
// files and rebuilding a cropped Blob into a properly named File, and by
// the upload paths for the pre-upload canvas downscale (cdn-bandwidth/02).

export type ImageOutputFormat = 'image/jpeg' | 'image/png' | 'image/webp'

/** Source formats that can carry an alpha channel worth preserving. */
const ALPHA_CAPABLE_MIME_TYPES = new Set(['image/png', 'image/webp'])

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
  'image/tiff': '.tiff',
  'image/x-icon': '.ico',
}

/**
 * Validates a file's MIME type against an accept string.
 * Supports wildcards like 'image/*' and comma-separated values like 'image/png,image/jpeg'
 */
export function isValidMimeType(fileType: string, accept: string): boolean {
  const acceptedTypes = accept.split(',').map(t => t.trim())

  return acceptedTypes.some((acceptType) => {
    if (acceptType === '*/*') return true
    if (acceptType.endsWith('/*')) {
      // Wildcard match: 'image/*' should match 'image/png'
      const category = acceptType.replace('/*', '')
      return fileType.startsWith(`${category}/`)
    }
    // Exact match
    return fileType === acceptType
  })
}

/**
 * Maps a MIME type to its corresponding file extension
 */
export function getExtensionFromMimeType(mimeType: string): string | null {
  return MIME_TO_EXTENSION[mimeType.toLowerCase()] ?? null
}

/**
 * Sanitizes a filename by removing or replacing invalid characters
 */
export function sanitizeFilename(filename: string): string {
  // Remove invalid characters for filenames (Windows/Unix compatible)
  // eslint-disable-next-line no-control-regex
  return filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim()
}

/**
 * Updates a filename's extension based on the new MIME type
 */
export function updateFilenameExtension(originalName: string, newExtension: string): string {
  const lastDotIndex = originalName.lastIndexOf('.')
  const nameWithoutExt = lastDotIndex > 0
    ? originalName.substring(0, lastDotIndex)
    : originalName

  return sanitizeFilename(nameWithoutExt) + newExtension
}

/**
 * Wraps a cropped Blob into a File whose name/extension match the output format.
 */
export function buildCroppedFile(blob: Blob, originalName: string, outputFormat: ImageOutputFormat): File {
  const extension = getExtensionFromMimeType(outputFormat)
  const filename = extension
    ? updateFilenameExtension(originalName, extension)
    : originalName

  return new File([blob], filename, {
    type: outputFormat,
    lastModified: Date.now(),
  })
}

// ========================================
// Canvas downscale
// ========================================

export interface DownscaledImage {
  blob: Blob
  width: number
  height: number
}

export interface DownscaleOptions {
  /** Longest edge in pixels. Images already within it are not scaled up. */
  maxLongEdge: number
  /** Re-encode quality (0-1); ignored by lossless output formats. */
  quality: number
  /** Keep a transparent source as PNG rather than flattening it onto JPEG. */
  preserveAlpha?: boolean
}

/**
 * Picks the re-encode format. JPEG unless the source can carry alpha and the
 * caller asked to keep it — flattening a transparent logo onto JPEG paints
 * the transparent pixels black.
 */
export function resolveDownscaleFormat(sourceType: string, preserveAlpha = false): ImageOutputFormat {
  return preserveAlpha && ALPHA_CAPABLE_MIME_TYPES.has(sourceType.toLowerCase())
    ? 'image/png'
    : 'image/jpeg'
}

/** Scales dimensions down to fit `maxLongEdge`, preserving aspect ratio. Never scales up. */
export function fitToLongEdge(
  width: number,
  height: number,
  maxLongEdge: number,
): { width: number, height: number } {
  const longEdge = Math.max(width, height)
  if (longEdge <= maxLongEdge) return { width, height }

  const scale = maxLongEdge / longEdge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * Downscales an image to a long-edge cap via canvas, re-encoding to the
 * resolved output format. No-ops on dimensions (returns the source size) if
 * the image is already within the cap — the re-encode still happens, which is
 * what strips oversized camera EXIF/quality.
 *
 * Named `...ToBlob` rather than `downscaleImage` on purpose: `app/utils` is
 * auto-imported, and `~/services/attachmentUploader` exports a DM-specific
 * `downscaleImage` with a different signature. Two same-named symbols, one of
 * them ambient, is a silent wrong-function call waiting to happen.
 */
export async function downscaleImageToBlob(
  file: File,
  { maxLongEdge, quality, preserveAlpha }: DownscaleOptions,
): Promise<DownscaledImage> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitToLongEdge(bitmap.width, bitmap.height, maxLongEdge)

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const type = resolveDownscaleFormat(file.type, preserveAlpha)
  const blob = await canvas.convertToBlob({ type, quality })

  return { blob, width, height }
}

/**
 * Upload-facing wrapper: downscales and re-wraps the result as a correctly
 * named File, so the `fileName` sent to the CDN matches the bytes.
 *
 * Never throws and never grows the payload — an unavailable canvas API, an
 * undecodable file, or a re-encode that came out bigger than the original all
 * fall back to the original File. Shrinking an upload is an optimization; it
 * must not be able to break one.
 */
export async function downscaleImageForUpload(file: File, options: DownscaleOptions): Promise<File> {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
    return file
  }

  try {
    const { blob } = await downscaleImageToBlob(file, options)
    if (blob.size === 0 || blob.size >= file.size) return file

    // `convertToBlob` silently falls back to PNG when a codec is unsupported,
    // so trust the blob's own type over the one we asked for.
    const outputFormat = (blob.type || 'image/jpeg') as ImageOutputFormat
    return buildCroppedFile(blob, file.name, outputFormat)
  }
  catch {
    return file
  }
}
