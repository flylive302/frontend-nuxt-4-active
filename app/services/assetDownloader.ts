// ========================================
// Asset Downloader Service
// ========================================

import type {
  AssetMetadata,
  DownloadProgress,
  DownloadQueueItem,
  EnqueueItem,
  EnqueueOptions,
} from '~/types/asset'
import { ASSET_CONFIG } from '~/constants/asset'
import * as cacheStorage from '~/services/cacheStorage'
import * as assetIndex from '~/services/assetIndex'
import { isMeteredConnection } from '~/services/networkDetector'
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
type ConsentCallback = (sizeBytes: number) => void

const progressCallbacks = new Set<ProgressCallback>()
const completeCallbacks = new Set<CompleteCallback>()
const consentCallbacks = new Set<ConsentCallback>()

/** Flow control */
let isPaused = false
let isProcessing = false
let cellularConsentGiven = false

// ========================================
// Queue Management
// ========================================

/**
 * Enqueue items for download.
 * Items are sorted by priority (lower sortOrder = higher priority).
 */
export function enqueue(items: EnqueueItem[]): void {
  for (const item of items) {
    // Skip if already in queue or active
    if (queue.some((q) => q.url === item.url) || activeDownloads.has(item.url)) {
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

  log.debug('Enqueued', items.length, 'items, queue size:', queue.length)
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
  log.debug('Queue cleared')
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
  log.debug('Starting download processing')
  processQueue()
}

/**
 * Pause download processing.
 */
export function pause(): void {
  isPaused = true
  log.debug('Download paused')
}

/**
 * Resume download processing.
 */
export function resume(): void {
  isPaused = false
  log.debug('Download resumed')
  processQueue()
}

/**
 * Set cellular consent (allows downloads on metered connections).
 */
export function setCellularConsent(granted: boolean): void {
  cellularConsentGiven = granted
  if (granted) {
    resume()
  }
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
    log.debug('All downloads complete')
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

    // Check cellular consent for non-critical, large downloads
    if (shouldRequestConsent(item)) {
      // Put item back and pause
      queue.unshift(item)
      isPaused = true
      notifyNeedConsent()
      return
    }

    // Start download
    activeDownloads.add(item.url)
    downloadItem(item)
  }
}

/**
 * Check if we should request cellular consent.
 * Per user requirement: download silently on any network.
 * Consent is no longer required for any asset type.
 */
function shouldRequestConsent(_item: DownloadQueueItem): boolean {
  return false
}

/**
 * Download a single item.
 */
async function downloadItem(item: DownloadQueueItem): Promise<void> {
  item.status = 'downloading'
  progress.currentUrl = item.url
  notifyProgress()

  try {
    // Check if already cached
    const cached = await cacheStorage.hasAsset(item.url)
    if (cached) {
      log.debug('Already cached:', item.url)
      handleSuccess(item)
      return
    }

    // Fetch the asset
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
  log.debug('Downloaded:', item.url)
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

/**
 * Subscribe to consent needed event.
 */
export function onNeedConsent(callback: ConsentCallback): () => void {
  consentCallbacks.add(callback)
  return () => consentCallbacks.delete(callback)
}

function notifyProgress(): void {
  progressCallbacks.forEach((cb) => cb({ ...progress }))
}

function notifyComplete(): void {
  completeCallbacks.forEach((cb) => cb())
}

function notifyNeedConsent(): void {
  const remainingSize = queue.reduce((sum, q) => sum + (q.sortOrder ?? 100000), 0)
  consentCallbacks.forEach((cb) => cb(remainingSize))
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
