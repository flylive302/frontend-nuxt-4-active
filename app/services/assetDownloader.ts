// ========================================
// Asset Downloader Service
// ========================================

import * as Sentry from '@sentry/nuxt'
import type {
  AssetMetadata,
  AssetPriority,
  DownloadProgress,
  DownloadQueueItem,
  EnqueueItem,
  EnqueueOptions,
} from '~/types/asset/asset'
import { ASSET_CONFIG } from '~/constants/asset'
import * as cacheStorage from '~/services/cacheStorage'
import * as assetIndex from '~/services/assetIndex'
import { getNetworkInfo } from '~/services/networkDetector'


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
type ItemResultCallback = (url: string, priority: AssetPriority, succeeded: boolean) => void

const progressCallbacks = new Set<ProgressCallback>()
const completeCallbacks = new Set<CompleteCallback>()
const itemResultCallbacks = new Set<ItemResultCallback>()

/** Tracks critical-priority items actually pushed to the queue (post cache-filter) */
let criticalQueued = 0

/** Flow control */
let isPaused = false
let isProcessing = false

const R2_ORIGIN = 'https://assets.flyliveapp.com'

/** In Vite dev, load R2 through same-origin `/__r2` proxy (see `nuxt.config` vite.server.proxy). */
function rewriteR2UrlForDevFetch(url: string): string {
  if (!import.meta.dev || typeof window === 'undefined') return url
  if (!url.startsWith(R2_ORIGIN)) return url
  return `/__r2${url.slice(R2_ORIGIN.length)}`
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    parsed.hash = ''
    parsed.searchParams.sort()
    return parsed.toString()
  } catch {
    return url.trim()
  }
}

// ========================================
// Queue Management
// ========================================

/**
 * Enqueue items for download.
 * Performs a batch cache pre-check to skip already-cached assets.
 */
export async function enqueue(items: EnqueueItem[]): Promise<void> {
  const cachedUrls = new Set((await cacheStorage.getCachedUrls()).map(normalizeUrl))

  for (const item of items) {
    const normalizedUrl = normalizeUrl(item.url)

    if (
        cachedUrls.has(normalizedUrl) ||
        queue.some((q) => normalizeUrl(q.url) === normalizedUrl) ||
        activeDownloads.has(normalizedUrl)
    ) {
      continue
    }

    const queueItem: DownloadQueueItem = {
      ...item,
      url: normalizedUrl,
      status: 'pending',
      retryCount: 0,
    }

    queue.push(queueItem)
    if (item.priority === 'critical') criticalQueued++
  }

  queue.sort((a, b) => {
    const priorityWeight = { critical: 0, high: 1, normal: 2, low: 3 } as const
    const priorityDiff = priorityWeight[a.priority] - priorityWeight[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    return (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity)
  })

  progress.total = queue.length + activeDownloads.size
  notifyProgress()
}

/**
 * Manually enqueue a single asset.
 */
export function enqueueManual(url: string, options: EnqueueOptions): void {
  void enqueue([
    {
      url,
      assetType: options.assetType,
      priority: options.priority,
      scope: options.scope,
      groupKey: options.groupKey,
      giftId: options.giftId,
      badgeId: options.badgeId,
      sortOrder: options.priority === 'critical' ? 0 : 100,
    },
  ])

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
  itemResultCallbacks.clear()
  criticalQueued = 0
  isPaused = false
  isProcessing = false
}

// ========================================
// Download Processing
// ========================================

export function start(): void {
  if (isProcessing) return
  isProcessing = true
  isPaused = false
  void processQueue()
}

export function pause(): void {
  isPaused = true
}

export function resume(): void {
  isPaused = false
  void processQueue()
}

function getEffectiveConcurrency(): number {
  const { effectiveType, saveData } = getNetworkInfo()
  if (effectiveType === '2g' || effectiveType === 'slow-2g' || saveData) {
    return ASSET_CONFIG.MAX_CONCURRENT_METERED
  }
  return ASSET_CONFIG.MAX_CONCURRENT
}

async function processQueue(): Promise<void> {
  if (isPaused) return

  if (queue.length === 0 && activeDownloads.size === 0) {
    isProcessing = false
    notifyComplete()
    return
  }

  const maxConcurrent = getEffectiveConcurrency()

  while (
      activeDownloads.size < maxConcurrent &&
      queue.length > 0 &&
      !isPaused
      ) {
    const item = queue.shift()
    if (!item) break

    activeDownloads.add(item.url)
    void downloadItem(item)
  }
}

/**
 * Download a single item.
 */
async function downloadItem(item: DownloadQueueItem): Promise<void> {
  item.status = 'downloading'
  progress.currentUrl = item.url
  notifyProgress()

  try {
    const sw = navigator?.serviceWorker?.controller
    if (sw) {
      const result = await downloadViaSW(sw, item.url)

      if (result.success) {
        const metadata: AssetMetadata = {
          url: item.url,
          assetType: item.assetType,
          priority: item.priority,
          scope: item.scope,
          groupKey: item.groupKey,
          sizeBytes: result.sizeBytes ?? 0,
          giftId: item.giftId,
          badgeId: item.badgeId,
          downloadedAt: Date.now(),
          lastAccessedAt: Date.now(),
          retryCount: item.retryCount,
        }
        await assetIndex.upsert(metadata)
        handleSuccess(item, result.sizeBytes)
        return
      }

      handleError(item, new Error(result.error ?? 'SW download failed'))
      return
    }

    const fetchUrl = rewriteR2UrlForDevFetch(item.url)
    // Abortable fetch — without it a stalled connection holds this queue
    // slot forever and the download gate hangs one short of completion.
    const response = await fetch(fetchUrl, {
      signal: AbortSignal.timeout(ASSET_CONFIG.DOWNLOAD_TIMEOUT_MS),
    })
    if (!response.ok) {
      handleError(item, new Error(`HTTP ${response.status}`))
      return
    }

    const blob = await response.blob()

    const contentLength = response.headers.get('Content-Length')
    if (contentLength && blob.size !== parseInt(contentLength, 10)) {
      handleError(item, new Error('Size mismatch - download may be corrupted'))
      return
    }

    await cacheStorage.putAsset(item.url, blob)

    const metadata: AssetMetadata = {
      url: item.url,
      assetType: item.assetType,
      priority: item.priority,
      scope: item.scope,
      groupKey: item.groupKey,
      sizeBytes: blob.size,
      giftId: item.giftId,
      badgeId: item.badgeId,
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

function downloadViaSW(
    sw: ServiceWorker,
    url: string,
): Promise<{ success: boolean; sizeBytes?: number; error?: string }> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      navigator.serviceWorker.removeEventListener('message', handler)
      resolve({ success: false, error: 'SW download timeout' })
    }, ASSET_CONFIG.DOWNLOAD_TIMEOUT_MS)

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
    sw.postMessage({ type: 'ASSET_DOWNLOAD', url, cacheName: ASSET_CONFIG.CACHE_NAME })
  })
}

function handleSuccess(item: DownloadQueueItem, sizeBytes?: number): void {
  item.status = 'complete'
  activeDownloads.delete(item.url)
  progress.completed++
  if (sizeBytes) {
    progress.bytesDownloaded += sizeBytes
  }
  notifyItemResult(item.url, item.priority, true)
  notifyProgress()
  void processQueue()
}

function extractHttpStatus(message: string): number | null {
  const match = /^HTTP (\d{3})/.exec(message)
  return match ? parseInt(match[1]!, 10) : null
}

function captureDownloadFailure(item: DownloadQueueItem, error: Error): void {
  const httpStatus = extractHttpStatus(error.message)
  const extras = {
    tags: {
      asset_scope: item.scope,
      asset_priority: item.priority,
    },
    contexts: {
      asset_download: {
        url: item.url,
        assetType: item.assetType,
        scope: item.scope,
        priority: item.priority,
        retryCount: item.retryCount,
        httpStatus,
        errorMessage: error.message,
      },
    },
  }
  // 5xx = transient CDN/infra failure; report as warning, not an alertable error
  if (httpStatus !== null && httpStatus >= 500) {
    Sentry.captureMessage(error.message, { level: 'warning', ...extras })
  }
  else {
    Sentry.captureException(error, extras)
  }
}

function handleError(item: DownloadQueueItem, error: Error): void {
  item.retryCount++
  activeDownloads.delete(item.url)

  if (item.retryCount < ASSET_CONFIG.MAX_RETRIES) {
    item.status = 'pending'
    queue.push(item)
    setTimeout(() => void processQueue(), ASSET_CONFIG.RETRY_DELAY_MS * item.retryCount)
    return
  }

  item.status = 'failed'
  item.error = error.message
  progress.failed++
  captureDownloadFailure(item, error)
  notifyItemResult(item.url, item.priority, false)
  notifyProgress()
  void processQueue()
}

// ========================================
// Subscriptions
// ========================================

export function onProgress(callback: ProgressCallback): () => void {
  progressCallbacks.add(callback)
  return () => progressCallbacks.delete(callback)
}

export function onComplete(callback: CompleteCallback): () => void {
  completeCallbacks.add(callback)
  return () => completeCallbacks.delete(callback)
}

/** Subscribe to per-item success/failure events (fires only on retry exhaustion for failures). */
export function onItemResult(callback: ItemResultCallback): () => void {
  itemResultCallbacks.add(callback)
  return () => itemResultCallbacks.delete(callback)
}

function notifyProgress(): void {
  progressCallbacks.forEach((cb) => cb({ ...progress }))
}

function notifyComplete(): void {
  completeCallbacks.forEach((cb) => cb())
}

function notifyItemResult(url: string, priority: AssetPriority, succeeded: boolean): void {
  itemResultCallbacks.forEach((cb) => cb(url, priority, succeeded))
}

// ========================================
// Getters
// ========================================

export function getProgress(): DownloadProgress {
  return { ...progress }
}

/** Number of critical-priority items actually pushed to the queue this session (post cache-filter). */
export function getCriticalQueuedCount(): number {
  return criticalQueued
}

export function isDownloading(): boolean {
  return isProcessing && !isPaused
}

export function getQueueLength(): number {
  return queue.length
}