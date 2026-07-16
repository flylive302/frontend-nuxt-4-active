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

  /** Maximum concurrent downloads (HTTP/2 supports 6+ parallel streams) */
  MAX_CONCURRENT: 6,

  /** Maximum concurrent downloads on metered/slow connections (2G, save-data) */
  MAX_CONCURRENT_METERED: 2,

  /** Maximum retry attempts per download */
  MAX_RETRIES: 2,

  /** Delay between retries (ms) */
  RETRY_DELAY_MS: 1000,

  /**
   * Per-attempt download timeout (ms). Generous on purpose: the largest
   * bootstrap assets are ~5–7 MB and must survive slow mobile links.
   */
  DOWNLOAD_TIMEOUT_MS: 120_000,

  /** Number of top gifts considered critical */
  CRITICAL_COUNT: 30,

  /** Days before asset considered stale */
  STALE_DAYS: 30,
} as const

/**
 * Old cache versions to clean up on init.
 * The self-destructing /sw.js also deletes every non-app bucket on activate;
 * this list is belt-and-braces for clients whose SW update never fires.
 */
export const DEPRECATED_CACHE_NAMES: string[] = [
  // Add old cache names here when upgrading versions
  // e.g., 'flylive-assets-v0'
  'fly-assets-v1', // orphan bucket the old SW asset handler wrote to
  'gift-videos', // retired Workbox rule — videos live in flylive-assets-v1 now
  'svga-cache', // retired Workbox rule — SVGAs are read-through flylive-assets-v1 now (ADR 0020)
  'cdn-images', // retired Workbox rule — images fall back to browser HTTP caching
  'api-cache', // retired Workbox rule — API responses are never cached
]
