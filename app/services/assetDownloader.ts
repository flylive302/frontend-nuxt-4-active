// ========================================
// Asset Downloader Service
// ========================================

import type {
  AssetMetadata,
  DownloadProgress,
  DownloadQueueItem,
  EnqueueItem,
  EnqueueOptions,
} from '~/types/asset/asset'
import { ASSET_CONFIG } from '~/constants/asset'
import * as cacheStorage from '~/services/cacheStorage'
import * as assetIndex from '~/services/assetIndex'
import { createLogger } from '~/utils/logger'

const log = createLogger('[AssetDownloader]')

// ========================================
// State
// ========================================

/** Download queue sorted by priority */
const queue: DownloadQueueItem[] = []

/** Currently downloading items */
const activeDownloads = new Set<string>()

/** Download progress tracking */
let progress: DownloadProgress = {
  total: 0,
  completed: 0,
  failed: 0,
  currentUrl: null,
  bytesDownloaded: 0,
  bytesTotal: 0,
}

/** Subscriptions */
type ProgressCallback = (progress: DownloadProgress) => void
type CompleteCallback = () => void

const progressCallbacks = new Set<ProgressCallback>()
const completeCallbacks = new Set<CompleteCallback>()

/** Flow control */
let isPaused = false
let isProcessing = false

// ========================================
// Queue Management
// ========================================

/**
 * Enqueue items for download.
 * Performs a batch cache pre-check to skip already-cached assets (1 cache.keys()
 * call instead of N serial cache.match() calls).
 * Items are sorted by priority (lower sortOrder = higher priority).
 */
export async function enqueue(items: EnqueueItem[]): Promise<void> {
  // Batch pre-check: get all cached URLs in one call
  const cachedUrls = new Set(await cacheStorage.getCachedUrls())

  for (const item of items) {
    // Skip if already cached, in queue, or active
    if (cachedUrls.has(item.url) || queue.some((q) => q.url === item.url) || activeDownloads.has(item.url)) {
      continue
    }

    const queueItem: DownloadQueueItem = {
      ...item,
      status: 'pending',
      retryCount: 0,
    }

    queue.push(queueItem)
  }

  // Sort queue by sortOrder (lower = higher priority)
  queue.sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity))

  progress.total = queue.length + activeDownloads.size
  notifyProgress()
}

/**
 * Manually enqueue a single asset.
 */
export function enqueueManual(url: string, options: EnqueueOptions): void {
  enqueue([
    {
      url,
      assetType: options.assetType,
      priority: options.priority,
      giftId: options.giftId,
      sortOrder: options.priority === 'critical' ? 0 : 100,
    },
  ])

  // Start processing if not already
  if (!isProcessing) {
    start()
  }
}

/**
 * Clear the download queue.
 */
export function clear(): void {
  queue.length = 0
  progress = {
    total: activeDownloads.size,
    completed: 0,
    failed: 0,
    currentUrl: null,
    bytesDownloaded: 0,
    bytesTotal: 0,
  }
  notifyProgress()

}

/**
 * Reset all internal state (for testing and HMR).
 */
export function resetAll(): void {
  queue.length = 0
  activeDownloads.clear()
  progress = {
    total: 0,
    completed: 0,
    failed: 0,
    currentUrl: null,
    bytesDownloaded: 0,
    bytesTotal: 0,
  }
  progressCallbacks.clear()
  completeCallbacks.clear()
  isPaused = false
  isProcessing = false
}

// ========================================
// Download Processing
// ========================================

/**
 * Start processing the download queue.
 */
export function start(): void {
  if (isProcessing) return
  isProcessing = true
  isPaused = false

  processQueue()
}

/**
 * Pause download processing.
 */
export function pause(): void {
  isPaused = true

}

/**
 * Resume download processing.
 */
export function resume(): void {
  isPaused = false

  processQueue()
}



/**
 * Process the next items in the queue.
 */
async function processQueue(): Promise<void> {
  if (isPaused) return

  // Check for completion
  if (queue.length === 0 && activeDownloads.size === 0) {
    isProcessing = false
    notifyComplete()

    return
  }

  // Fill up to MAX_CONCURRENT active downloads
  while (
    activeDownloads.size < ASSET_CONFIG.MAX_CONCURRENT &&
    queue.length > 0 &&
    !isPaused
  ) {
    const item = queue.shift()
    if (!item) break

    // Start download
    activeDownloads.add(item.url)
    downloadItem(item)
  }
}


/**
 * Download a single item.
 *
 * LT-1: Delegates to the Service Worker via postMessage when available.
 * Falls back to main-thread fetch when SW is unavailable (SSR, dev, or unsupported).
 */
async function downloadItem(item: DownloadQueueItem): Promise<void> {
  item.status = 'downloading'
  progress.currentUrl = item.url
  notifyProgress()

  try {
    // LT-1: Try Service Worker delegation first
    const sw = navigator?.serviceWorker?.controller
    if (sw) {
      const result = await downloadViaSW(sw, item.url)

      if (result.success) {
        // Store metadata in IndexedDB (still on main thread — lightweight)
        const metadata: AssetMetadata = {
          url: item.url,
          assetType: item.assetType,
          priority: item.priority,
          sizeBytes: result.sizeBytes ?? 0,
          giftId: item.giftId,
          downloadedAt: Date.now(),
          lastAccessedAt: Date.now(),
          retryCount: item.retryCount,
        }
        await assetIndex.upsert(metadata)
        handleSuccess(item, result.sizeBytes)
        return
      } else {
        throw new Error(result.error ?? 'SW download failed')
      }
    }

    // Fallback: main-thread fetch (no SW available)
    const response = await fetch(item.url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const blob = await response.blob()

    // Validate size if Content-Length was provided
    const contentLength = response.headers.get('Content-Length')
    if (contentLength && blob.size !== parseInt(contentLength, 10)) {
      throw new Error('Size mismatch - download may be corrupted')
    }

    // Store in cache
    await cacheStorage.putAsset(item.url, blob)

    // Store metadata
    const metadata: AssetMetadata = {
      url: item.url,
      assetType: item.assetType,
      priority: item.priority,
      sizeBytes: blob.size,
      giftId: item.giftId,
      downloadedAt: Date.now(),
      lastAccessedAt: Date.now(),
      retryCount: item.retryCount,
    }
    await assetIndex.upsert(metadata)

    handleSuccess(item, blob.size)
  } catch (e) {
    handleError(item, e as Error)
  }
}

/**
 * Delegate download to the Service Worker and wait for result.
 * Returns a promise that resolves with the SW's response message.
 */
function downloadViaSW(
  sw: ServiceWorker,
  url: string,
): Promise<{ success: boolean; sizeBytes?: number; error?: string }> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      navigator.serviceWorker.removeEventListener('message', handler)
      resolve({ success: false, error: 'SW download timeout' })
    }, 30_000) // 30s timeout

    function handler(event: MessageEvent) {
      if (event.data?.type === 'ASSET_DOWNLOAD_RESULT' && event.data.url === url) {
        clearTimeout(timeout)
        navigator.serviceWorker.removeEventListener('message', handler)
        resolve({
          success: event.data.success,
          sizeBytes: event.data.sizeBytes,
          error: event.data.error,
        })
      }
    }

    navigator.serviceWorker.addEventListener('message', handler)
    sw.postMessage({ type: 'ASSET_DOWNLOAD', url })
  })
}

/**
 * Handle successful download.
 */
function handleSuccess(item: DownloadQueueItem, sizeBytes?: number): void {
  item.status = 'complete'
  activeDownloads.delete(item.url)
  progress.completed++
  if (sizeBytes) {
    progress.bytesDownloaded += sizeBytes
  }
  notifyProgress()

  processQueue()
}

/**
 * Handle download error with retry logic.
 */
function handleError(item: DownloadQueueItem, error: Error): void {
  item.retryCount++
  activeDownloads.delete(item.url)

  if (item.retryCount < ASSET_CONFIG.MAX_RETRIES) {
    // Re-queue for retry
    item.status = 'pending'
    queue.push(item)
    log.warn('Retrying download:', item.url, `(attempt ${item.retryCount + 1})`)

    // Delay before retry
    setTimeout(() => processQueue(), ASSET_CONFIG.RETRY_DELAY_MS * item.retryCount)
  } else {
    // Max retries exceeded
    item.status = 'failed'
    item.error = error.message
    progress.failed++
    notifyProgress()
    log.error('Download failed:', item.url, error.message)
    processQueue()
  }
}

// ========================================
// Subscriptions
// ========================================

/**
 * Subscribe to progress updates.
 */
export function onProgress(callback: ProgressCallback): () => void {
  progressCallbacks.add(callback)
  return () => progressCallbacks.delete(callback)
}

/**
 * Subscribe to completion event.
 */
export function onComplete(callback: CompleteCallback): () => void {
  completeCallbacks.add(callback)
  return () => completeCallbacks.delete(callback)
}

function notifyProgress(): void {
  progressCallbacks.forEach((cb) => cb({ ...progress }))
}

function notifyComplete(): void {
  completeCallbacks.forEach((cb) => cb())
}

// ========================================
// Getters
// ========================================

/**
 * Get current progress.
 */
export function getProgress(): DownloadProgress {
  return { ...progress }
}

/**
 * Check if download is in progress.
 */
export function isDownloading(): boolean {
  return isProcessing && !isPaused
}

/**
 * Get queue length.
 */
export function getQueueLength(): number {
  return queue.length
}
