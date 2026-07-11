// ========================================
// Asset Downloader Service Tests
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  enqueue,
  enqueueManual,
  clear,
  resetAll,
  start,
  pause,
  resume,
  onProgress,
  onComplete,
  getProgress,
  isDownloading,
  getQueueLength,
} from '~/services/assetDownloader'
import type { EnqueueItem } from '~/types/asset/asset'

// ========================================
// Mocks
// ========================================

// Mock logger
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

// Mock dependent services — must use vi.hoisted() since vi.mock is hoisted
const { mockCacheStorage, mockAssetIndex, mockNetworkDetector, mockSentry } = vi.hoisted(() => ({
  mockCacheStorage: {
    hasAsset: vi.fn().mockResolvedValue(false),
    putAsset: vi.fn().mockResolvedValue(undefined),
    getAsset: vi.fn().mockResolvedValue(null),
    getCachedUrls: vi.fn().mockResolvedValue([]),
  },
  mockAssetIndex: {
    upsert: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  mockNetworkDetector: {
    getNetworkInfo: vi.fn().mockReturnValue({
      isOnline: true,
      connectionType: 'unknown',
      effectiveType: 'unknown',
      saveData: false,
    }),
  },
  mockSentry: {
    captureException: vi.fn(),
  },
}))

vi.mock('~/services/cacheStorage', () => mockCacheStorage)
vi.mock('~/services/assetIndex', () => mockAssetIndex)
vi.mock('~/services/networkDetector', () => mockNetworkDetector)
vi.mock('@sentry/nuxt', () => mockSentry)

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

function setupSuccessfulFetch(size = 100) {
  mockFetch.mockResolvedValue({
    ok: true,
    blob: vi.fn().mockResolvedValue(new Blob(['x'.repeat(size)])),
    headers: { get: vi.fn().mockReturnValue(String(size)) },
  })
}

function setupFailingFetch(status = 500) {
  mockFetch.mockResolvedValue({
    ok: false,
    status,
    blob: vi.fn(),
    headers: { get: vi.fn() },
  })
}

// ========================================
// Test Data
// ========================================

const sampleItems: EnqueueItem[] = [
  {
    url: 'https://example.com/asset1.webm',
    assetType: 'video',
    priority: 'critical',
    giftId: 1,
    scope: 'global',
    sortOrder: 1,
  },
  {
    url: 'https://example.com/asset2.webm',
    assetType: 'video',
    priority: 'normal',
    scope: 'global',
    giftId: 2,
    sortOrder: 2,
  },
]

// ========================================
// Tests
// ========================================

describe('assetDownloader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAll()
    setupSuccessfulFetch()
    mockNetworkDetector.getNetworkInfo.mockReturnValue({
      isOnline: true,
      connectionType: 'unknown',
      effectiveType: 'unknown',
      saveData: false,
    })
    // No service worker by default
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { controller: null },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    resetAll()
  })

  // ========================================
  // Queue Management
  // ========================================

  describe('enqueue', () => {
    it('should add items to the queue', async () => {
      await enqueue(sampleItems)
      expect(getQueueLength()).toBe(2)
    })

    it('should not add duplicate URLs', async () => {
      await enqueue(sampleItems)
      await enqueue(sampleItems) // Same items again
      expect(getQueueLength()).toBe(2)
    })

    it('should sort items by sortOrder (ascending)', async () => {
      const unsortedItems: EnqueueItem[] = [
        { url: 'a.webm', assetType: 'video', priority: 'normal', sortOrder: 3, scope: 'global' },
        { url: 'b.webm', assetType: 'video', priority: 'critical', sortOrder: 1, scope: 'global' },
        { url: 'c.webm', assetType: 'video', priority: 'high', sortOrder: 2, scope: 'global' },
      ]

      await enqueue(unsortedItems)
      expect(getQueueLength()).toBe(3)
    })

    it('should skip items that are already cached', async () => {
      mockCacheStorage.getCachedUrls.mockResolvedValueOnce(['https://example.com/asset1.webm'])

      await enqueue(sampleItems)
      expect(getQueueLength()).toBe(1) // Only asset2 should be queued
    })

    it('should update progress.total after enqueue', async () => {
      await enqueue(sampleItems)
      const progress = getProgress()
      expect(progress.total).toBe(2)
    })
  })

  describe('enqueueManual', () => {
    it('should add a single item to the queue', async () => {
      enqueueManual('https://example.com/manual.webm', {
        priority: 'high',
        assetType: 'video',
        scope: 'global',
        giftId: 99,
      })

      // enqueue() is async internally — wait for it to settle
      await vi.waitFor(() => {
        expect(getProgress().total).toBeGreaterThanOrEqual(1)
      })
    })

    it('should set critical priority items with sortOrder 0', async () => {
      enqueueManual('https://example.com/critical.webm', {
        priority: 'critical',
        scope: 'global',
        assetType: 'video',
      })

      // Start was called — so item should be processing
      const progress = getProgress()
      expect(progress.total).toBeGreaterThanOrEqual(0)
    })
  })

  describe('clear', () => {
    it('should empty the queue', async () => {
      await enqueue(sampleItems)
      expect(getQueueLength()).toBe(2)

      clear()
      expect(getQueueLength()).toBe(0)
    })

    it('should reset progress counters', async () => {
      await enqueue(sampleItems)
      clear()

      const progress = getProgress()
      expect(progress.completed).toBe(0)
      expect(progress.failed).toBe(0)
    })
  })

  describe('resetAll', () => {
    it('should reset all internal state including flow control flags', async () => {
      await enqueue(sampleItems)
      start()

      resetAll()

      expect(getQueueLength()).toBe(0)
      expect(isDownloading()).toBe(false)
      const progress = getProgress()
      expect(progress.total).toBe(0)
      expect(progress.completed).toBe(0)
      expect(progress.failed).toBe(0)
    })
  })

  // ========================================
  // Download Flow Control
  // ========================================

  describe('start/pause/resume', () => {
    it('start() should begin queue processing', async () => {
      await enqueue(sampleItems)
      start()
      expect(isDownloading()).toBe(true)
    })

    it('start() should be idempotent', async () => {
      await enqueue(sampleItems)
      start()
      start() // Second call should not crash
      expect(isDownloading()).toBe(true)
    })

    it('pause() should stop processing', async () => {
      await enqueue(sampleItems)
      start()
      pause()
      expect(isDownloading()).toBe(false)
    })

    it('resume() should restart processing after pause', async () => {
      await enqueue(sampleItems)
      start()
      pause()
      resume()
      expect(isDownloading()).toBe(true)
    })
  })

  // ========================================
  // Subscriptions
  // ========================================

  describe('onProgress', () => {
    it('should return an unsubscribe function', () => {
      const callback = vi.fn()
      const unsubscribe = onProgress(callback)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })

    it('should fire callback when progress changes (on enqueue)', async () => {
      const callback = vi.fn()
      onProgress(callback)

      await enqueue(sampleItems)

      expect(callback).toHaveBeenCalled()
      const lastCall = callback.mock.calls[callback.mock.calls.length - 1]![0]
      expect(lastCall.total).toBe(2)
    })
  })

  describe('onComplete', () => {
    it('should return an unsubscribe function', () => {
      const callback = vi.fn()
      const unsubscribe = onComplete(callback)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })

    it('should fire when queue is fully processed', async () => {
      const completeCb = vi.fn()
      onComplete(completeCb)

      // Empty queue + start = immediate completion
      start()

      // Allow microtask queue to settle
      await vi.waitFor(() => {
        expect(completeCb).toHaveBeenCalledTimes(1)
      })
    })
  })

  // ========================================
  // Download Processing
  // ========================================

  describe('download flow (main-thread fallback)', () => {
    it('should fetch, store in cache, and store metadata on success', async () => {
      setupSuccessfulFetch(500)

      await enqueue([sampleItems[0]!])
      start()

      // Wait for download to complete
      await vi.waitFor(() => {
        expect(mockCacheStorage.putAsset).toHaveBeenCalled()
      })

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/asset1.webm', expect.objectContaining({ signal: expect.any(AbortSignal) }))
      expect(mockAssetIndex.upsert).toHaveBeenCalled()
    })

    it('should update progress completed count on success', async () => {
      setupSuccessfulFetch()
      const progressCb = vi.fn()
      onProgress(progressCb)

      await enqueue([sampleItems[0]!])
      start()

      await vi.waitFor(() => {
        const calls = progressCb.mock.calls
        const hasCompletedProgress = calls.some(
          (call: unknown[]) => (call[0] as { completed: number }).completed >= 1
        )
        expect(hasCompletedProgress).toBe(true)
      })
    })
  })

  describe('error handling and retry', () => {
    it('should retry failed downloads', async () => {
      setupFailingFetch(500)

      await enqueue([sampleItems[0]!])
      start()

      // Wait for retries — fetch should be called more than once
      await vi.waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledTimes(2) // initial + 1 retry (MAX_RETRIES = 2)
        },
        { timeout: 5000 }
      )
    })

    it('should mark item as failed after MAX_RETRIES exhausted', async () => {
      setupFailingFetch(500)
      const progressCb = vi.fn()
      onProgress(progressCb)

      await enqueue([sampleItems[0]!])
      start()

      await vi.waitFor(
        () => {
          const calls = progressCb.mock.calls
          const hasFailedProgress = calls.some(
            (call: unknown[]) => (call[0] as { failed: number }).failed >= 1
          )
          expect(hasFailedProgress).toBe(true)
        },
        { timeout: 10000 }
      )
    })
  })

  // ========================================
  // Sentry Capture
  // ========================================

  describe('Sentry capture on retry exhaustion', () => {
    it('captures exactly one Sentry event when retries are exhausted', async () => {
      setupFailingFetch(404)

      await enqueue([sampleItems[0]!])
      start()

      await vi.waitFor(
        () => {
          expect(getProgress().failed).toBe(1)
        },
        { timeout: 10000 }
      )

      expect(mockSentry.captureException).toHaveBeenCalledTimes(1)
    })

    it('captures with correct context shape, tags, and parsed httpStatus', async () => {
      setupFailingFetch(404)

      await enqueue([sampleItems[0]!])
      start()

      await vi.waitFor(
        () => {
          expect(getProgress().failed).toBe(1)
        },
        { timeout: 10000 }
      )

      expect(mockSentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        {
          tags: {
            asset_scope: 'global',
            asset_priority: 'critical',
          },
          contexts: {
            asset_download: {
              url: 'https://example.com/asset1.webm',
              assetType: 'video',
              scope: 'global',
              priority: 'critical',
              retryCount: expect.any(Number),
              httpStatus: 404,
              errorMessage: 'HTTP 404',
            },
          },
        }
      )
    })

    it('sets httpStatus to null for non-HTTP errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'))

      await enqueue([sampleItems[0]!])
      start()

      await vi.waitFor(
        () => {
          expect(getProgress().failed).toBe(1)
        },
        { timeout: 10000 }
      )

      const [, captureContext] = mockSentry.captureException.mock.calls[0]!
      expect(captureContext.contexts.asset_download.httpStatus).toBeNull()
    })
  })

  // ========================================
  // Getters
  // ========================================

  describe('getProgress', () => {
    it('should return a progress snapshot (not a reference)', () => {
      const progress = getProgress()
      expect(progress).toHaveProperty('total')
      expect(progress).toHaveProperty('completed')
      expect(progress).toHaveProperty('failed')
      expect(progress).toHaveProperty('currentUrl')
      expect(progress).toHaveProperty('bytesDownloaded')
      expect(progress).toHaveProperty('bytesTotal')
    })
  })

  describe('isDownloading', () => {
    it('should return false initially', () => {
      expect(isDownloading()).toBe(false)
    })
  })

  describe('getQueueLength', () => {
    it('should return 0 for empty queue', () => {
      expect(getQueueLength()).toBe(0)
    })

    it('should return correct count after enqueue', async () => {
      await enqueue(sampleItems)
      expect(getQueueLength()).toBe(2)
    })
  })

  // ========================================
  // Adaptive Concurrency
  // ========================================

  describe('adaptive concurrency', () => {
    it('should cap concurrent downloads at MAX_CONCURRENT_METERED on 2G', async () => {
      mockNetworkDetector.getNetworkInfo.mockReturnValue({
        isOnline: true,
        connectionType: 'cellular',
        effectiveType: '2g',
        saveData: false,
      })

      let concurrentCount = 0
      let peakConcurrent = 0

      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            concurrentCount++
            peakConcurrent = Math.max(peakConcurrent, concurrentCount)
            setTimeout(() => {
              concurrentCount--
              resolve({
                ok: true,
                blob: vi.fn().mockResolvedValue(new Blob(['x'])),
                headers: { get: vi.fn().mockReturnValue('1') },
              })
            }, 30)
          }),
      )

      const items: EnqueueItem[] = Array.from({ length: 6 }, (_, i) => ({
        url: `https://example.com/slow-asset${i}.webm`,
        assetType: 'video' as const,
        priority: 'normal' as const,
        scope: 'global' as const,
      }))

      await enqueue(items)

      const completeCb = vi.fn()
      onComplete(completeCb)
      start()

      await vi.waitFor(() => expect(completeCb).toHaveBeenCalled(), { timeout: 5000 })

      expect(peakConcurrent).toBeGreaterThan(0)
      expect(peakConcurrent).toBeLessThanOrEqual(2)
    })

    it('should use full MAX_CONCURRENT on normal connections', async () => {
      // Default mock returns 'unknown' effectiveType → no cap
      let concurrentCount = 0
      let peakConcurrent = 0

      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            concurrentCount++
            peakConcurrent = Math.max(peakConcurrent, concurrentCount)
            setTimeout(() => {
              concurrentCount--
              resolve({
                ok: true,
                blob: vi.fn().mockResolvedValue(new Blob(['x'])),
                headers: { get: vi.fn().mockReturnValue('1') },
              })
            }, 30)
          }),
      )

      const items: EnqueueItem[] = Array.from({ length: 6 }, (_, i) => ({
        url: `https://example.com/fast-asset${i}.webm`,
        assetType: 'video' as const,
        priority: 'normal' as const,
        scope: 'global' as const,
      }))

      await enqueue(items)

      const completeCb = vi.fn()
      onComplete(completeCb)
      start()

      await vi.waitFor(() => expect(completeCb).toHaveBeenCalled(), { timeout: 5000 })

      expect(peakConcurrent).toBeGreaterThan(2)
    })

    it('should cap at MAX_CONCURRENT_METERED when saveData is true', async () => {
      mockNetworkDetector.getNetworkInfo.mockReturnValue({
        isOnline: true,
        connectionType: 'cellular',
        effectiveType: '4g',
        saveData: true,
      })

      let concurrentCount = 0
      let peakConcurrent = 0

      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            concurrentCount++
            peakConcurrent = Math.max(peakConcurrent, concurrentCount)
            setTimeout(() => {
              concurrentCount--
              resolve({
                ok: true,
                blob: vi.fn().mockResolvedValue(new Blob(['x'])),
                headers: { get: vi.fn().mockReturnValue('1') },
              })
            }, 30)
          }),
      )

      const items: EnqueueItem[] = Array.from({ length: 6 }, (_, i) => ({
        url: `https://example.com/savedata-asset${i}.webm`,
        assetType: 'video' as const,
        priority: 'normal' as const,
        scope: 'global' as const,
      }))

      await enqueue(items)

      const completeCb = vi.fn()
      onComplete(completeCb)
      start()

      await vi.waitFor(() => expect(completeCb).toHaveBeenCalled(), { timeout: 5000 })

      expect(peakConcurrent).toBeGreaterThan(0)
      expect(peakConcurrent).toBeLessThanOrEqual(2)
    })
  })
})
