// ========================================
// Image file helpers (pure)
// ========================================
// Shared by FileUpload and ImagePreviewModal for validating picked image
// files and rebuilding a cropped Blob into a properly named File.

export type ImageOutputFormat = 'image/jpeg' | 'image/png' | 'image/webp'

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
