// ========================================
// Platform Detection Utilities
// ========================================

/**
 * Cached iOS detection result.
 * Evaluated once on first call, memoized thereafter.
 */
let _isIOS: boolean | null = null

/**
 * Detect if the current device is running iOS (iPhone, iPad, iPod).
 * Handles iPad desktop mode (reports as Mac with touch support).
 * SSR-safe — returns false on server.
 */
export function isIOSDevice(): boolean {
  if (_isIOS !== null) return _isIOS

  if (typeof navigator === 'undefined') {
    _isIOS = false
    return false
  }

  const ua = navigator.userAgent
  const isClassicIOS = /iPhone|iPad|iPod/.test(ua)
  const isIPadDesktop = ua.includes('Macintosh') && 'ontouchend' in document

  _isIOS = isClassicIOS || isIPadDesktop
  return _isIOS
}

/**
 * Resolve a video asset URL for the current platform.
 * On iOS, swaps `.webm` extension to `.mov` (HEVC).
 * On all other platforms, returns the URL unchanged.
 *
 * @param url - Original video URL (e.g. `https://cdn.example.com/gift.webm`)
 * @returns Platform-appropriate URL
 */
export function resolveVideoUrl(url: string): string {
  if (!url || !isIOSDevice()) return url
  if (url.endsWith('.webm')) return `${url.slice(0, -5)}.mov`
  return url
}
