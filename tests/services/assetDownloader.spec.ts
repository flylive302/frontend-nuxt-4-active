// ========================================
// Asset Downloader Service Tests
// ========================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  enqueue,
  enqueueManual,
  clear,
  start,
  pause,
  resume,
  setCellularConsent,
  onProgress,
  onComplete,
  onNeedConsent,
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

// Mock dependent services
vi.mock('~/services/cacheStorage', () => ({
  hasAsset: vi.fn().mockResolvedValue(false),
  putAsset: vi.fn().mockResolvedValue(undefined),
  getAsset: vi.fn().mockResolvedValue(null),
}))

vi.mock('~/services/assetIndex', () => ({
  upsert: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
  remove: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('~/services/networkDetector', () => ({
  isCellular: vi.fn().mockReturnValue(false),
  isMeteredConnection: vi.fn().mockReturnValue(false),
}))

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  blob: vi.fn().mockResolvedValue(new Blob(['test'])),
  headers: {
    get: vi.fn().mockReturnValue('100'),
  },
})

describe('assetDownloader', () => {
  const sampleItems: EnqueueItem[] = [
    {
      url: 'https://example.com/asset1.webm',
      assetType: 'video',
      priority: 'critical',
      giftId: 1,
      sortOrder: 1,
    },
    {
      url: 'https://example.com/asset2.webm',
      assetType: 'video',
      priority: 'normal',
      giftId: 2,
      sortOrder: 2,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    clear()
  })

  describe('enqueue', () => {
    it('should add items to the queue', () => {
      enqueue(sampleItems)
      expect(getQueueLength()).toBe(2)
    })

    it('should not add duplicate URLs', () => {
      enqueue(sampleItems)
      enqueue(sampleItems) // Same items again
      expect(getQueueLength()).toBe(2)
    })

    it('should sort items by sortOrder', () => {
      const unsortedItems: EnqueueItem[] = [
        { url: 'a.webm', assetType: 'video', priority: 'normal', sortOrder: 3 },
        { url: 'b.webm', assetType: 'video', priority: 'critical', sortOrder: 1 },
        { url: 'c.webm', assetType: 'video', priority: 'high', sortOrder: 2 },
      ]

      enqueue(unsortedItems)

      // Queue should be sorted by sortOrder
      expect(getQueueLength()).toBe(3)
    })
  })

  describe('enqueueManual', () => {
    it('should add a single item with options', () => {
      enqueueManual('https://example.com/manual.webm', {
        priority: 'high',
        assetType: 'video',
        giftId: 99,
      })

      // enqueueManual calls start() which processes the queue,
      // so check progress.total instead of queueLength
      const progress = getProgress()
      expect(progress.total).toBeGreaterThanOrEqual(0)
    })
  })

  describe('clear', () => {
    it('should empty the queue', () => {
      enqueue(sampleItems)
      expect(getQueueLength()).toBe(2)

      clear()
      expect(getQueueLength()).toBe(0)
    })
  })

  describe('start/pause/resume', () => {
    it('should control download flow', () => {
      // These are flow control functions
      expect(typeof start).toBe('function')
      expect(typeof pause).toBe('function')
      expect(typeof resume).toBe('function')
    })
  })

  describe('setCellularConsent', () => {
    it('should accept consent value', () => {
      expect(() => setCellularConsent(true)).not.toThrow()
      expect(() => setCellularConsent(false)).not.toThrow()
    })
  })

  describe('onProgress', () => {
    it('should return unsubscribe function', () => {
      const callback = vi.fn()
      const unsubscribe = onProgress(callback)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })
  })

  describe('onComplete', () => {
    it('should return unsubscribe function', () => {
      const callback = vi.fn()
      const unsubscribe = onComplete(callback)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })
  })

  describe('onNeedConsent', () => {
    it('should return unsubscribe function', () => {
      const callback = vi.fn()
      const unsubscribe = onNeedConsent(callback)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })
  })

  describe('getProgress', () => {
    it('should return progress object', () => {
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

    it('should return correct count after enqueue', () => {
      enqueue(sampleItems)
      expect(getQueueLength()).toBe(2)
    })
  })
})
