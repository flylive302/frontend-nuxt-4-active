// ========================================
// Asset Configuration Constants
// ========================================

/**
 * Configuration for asset caching and downloads.
 */
export const ASSET_CONFIG = {
  /** Cache Storage name for assets */
  CACHE_NAME: 'flylive-assets-v1',

  /** IndexedDB database name */
  IDB_NAME: 'flylive-assets',

  /** IndexedDB version */
  IDB_VERSION: 1,

  /** IndexedDB object store name */
  IDB_STORE: 'metadata',

  /** Maximum concurrent downloads */
  MAX_CONCURRENT: 3,

  /** Maximum retry attempts per download */
  MAX_RETRIES: 2,

  /** Delay between retries (ms) */
  RETRY_DELAY_MS: 1000,

  /** Cellular threshold for consent modal (5MB) */
  CELLULAR_THRESHOLD_BYTES: 5 * 1024 * 1024,

  /** Number of top gifts considered critical */
  CRITICAL_COUNT: 30,

  /** Days before asset considered stale */
  STALE_DAYS: 30,
} as const

/**
 * Cache names used by Workbox (match nuxt.config.ts).
 */
export const WORKBOX_CACHES = {
  GIFT_VIDEOS: 'gift-videos',
  SVGA_CACHE: 'svga-cache',
  CDN_IMAGES: 'cdn-images',
  API_CACHE: 'api-cache',
} as const

/**
 * Old cache versions to clean up on init.
 */
export const DEPRECATED_CACHE_NAMES: string[] = [
  // Add old cache names here when upgrading versions
  // e.g., 'flylive-assets-v0'
]
