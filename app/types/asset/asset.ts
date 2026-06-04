// ========================================
// Asset Types
// ========================================

/**
 * Type of asset being cached.
 */
export type AssetType = 'svga' | 'video' | 'image' | 'json' | string

/**
 * Priority level for asset downloads.
 * - critical: Top N gifts, download immediately
 * - high: Important but can wait
 * - normal: Standard priority
 * - low: Background download when idle
 */
export type AssetPriority = 'critical' | 'high' | 'normal' | 'low'

/**
 * Logical asset scope/category.
 * Used to group manual/page assets without creating separate pipelines.
 */
export type AssetScope = 'gift' | 'badge' | 'mall' | 'wallet' | 'global' | 'manual' | 'vip'

/**
 * Download status for queue items.
 */
export type DownloadStatus = 'pending' | 'downloading' | 'complete' | 'failed'

// ========================================
// Metadata Types
// ========================================

/**
 * Asset metadata stored in IndexedDB.
 * Tracks download state and enables smart invalidation.
 */
export interface AssetMetadata {
  /** Full URL of the asset */
  url: string
  /** Type of asset */
  assetType: AssetType
  /** Priority level */
  priority: AssetPriority
  /** Logical scope/category */
  scope: AssetScope
  /** Optional grouping key for a page or feature */
  groupKey?: string
  /** Size in bytes (from Content-Length or backend) */
  sizeBytes: number | null
  /** Associated gift ID (if gift asset) */
  giftId?: number
  /** Associated badge ID (if badge asset) */
  badgeId?: number
  /** Timestamp when downloaded */
  downloadedAt: number
  /** Timestamp when last accessed */
  lastAccessedAt: number
  /** Number of retry attempts */
  retryCount: number
}

// ========================================
// Download Queue Types
// ========================================

/**
 * Item to enqueue for download.
 */
export interface EnqueueItem {
  /** Full URL to download */
  url: string
  /** Type of asset */
  assetType: AssetType
  /** Priority (lower sort_order = higher priority) */
  priority: AssetPriority
  /** Logical scope/category */
  scope: AssetScope
  /** Optional grouping key for a page or feature */
  groupKey?: string
  /** Associated gift ID */
  giftId?: number
  /** Associated badge ID */
  badgeId?: number
  /** Sort order for priority queue */
  sortOrder?: number
}

/**
 * Internal queue item with status tracking.
 */
export interface DownloadQueueItem extends EnqueueItem {
  /** Current download status */
  status: DownloadStatus
  /** Number of retry attempts */
  retryCount: number
  /** Error message if failed */
  error?: string
}

/**
 * Download progress for UI display.
 */
export interface DownloadProgress {
  /** Total items in the queue */
  total: number
  /** Completed downloads */
  completed: number
  /** Failed downloads */
  failed: number
  /** Currently downloading URL */
  currentUrl: string | null
  /** Bytes downloaded so far */
  bytesDownloaded: number
  /** Total bytes to download */
  bytesTotal: number
}

// ========================================
// Network Types
// ========================================

/**
 * Network connection information.
 */
export interface NetworkInfo {
  /** Whether the device is online */
  isOnline: boolean
  /** Connection type */
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown'
  /** Effective connection type */
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown'
  /** Whether a user has data saver enabled */
  saveData: boolean
}

// ========================================
// Event Payloads
// ========================================

/**
 * Payload for asset:invalidate socket event.
 */
export interface AssetInvalidatePayload {
  /** Full asset URL to invalidate */
  url: string
  /** Associated gift ID (optional) */
  giftId?: number
  /** Associated badge ID (optional) */
  badgeId?: number
  /** Priority for re-download */
  priority?: 'critical' | 'normal'
  /** Reason for invalidation */
  reason?: string
}

// ========================================
// Enqueue Options
// ========================================

/**
 * Options for manual asset enqueue.
 */
export interface EnqueueOptions {
  /** Priority level */
  priority: AssetPriority
  /** Asset type */
  assetType: AssetType
  /** Logical scope/category */
  scope: AssetScope
  /** Optional grouping key */
  groupKey?: string
  /** Associated gift ID */
  giftId?: number
  /** Associated badge ID */
  badgeId?: number
}