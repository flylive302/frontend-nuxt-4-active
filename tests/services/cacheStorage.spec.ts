// ========================================
// Cache Storage Service Tests
// ========================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  initCacheStorage,
  putAsset,
  getAsset,
  hasAsset,
  deleteAsset,
  clearAll,
  getTotalSize,
  getCachedUrls,
} from '~/services/cacheStorage'

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

// Mock cache storage
const mockCache = {
  put: vi.fn(),
  match: vi.fn(),
  delete: vi.fn(),
  keys: vi.fn().mockResolvedValue([]),
}

const mockCaches = {
  open: vi.fn().mockResolvedValue(mockCache),
  delete: vi.fn().mockResolvedValue(true),
}

// Set up global caches mock
Object.defineProperty(global, 'caches', {
  value: mockCaches,
  writable: true,
})

describe('cacheStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCache.put.mockClear()
    mockCache.match.mockClear()
    mockCache.delete.mockClear()
    mockCache.keys.mockResolvedValue([])
  })

  describe('initCacheStorage', () => {
    it('should open the cache', async () => {
      await initCacheStorage()
      expect(mockCaches.open).toHaveBeenCalledWith('flylive-assets-v1')
    })
  })

  describe('putAsset', () => {
    it('should store a blob in cache', async () => {
      const blob = new Blob(['test data'], { type: 'application/json' })
      const url = 'https://example.com/asset.json'

      await putAsset(url, blob)

      expect(mockCache.put).toHaveBeenCalled()
      const calledUrl = mockCache.put.mock.calls[0]?.[0]
      expect(calledUrl).toBe(url)
    })
  })

  describe('getAsset', () => {
    it('should return null when asset not found', async () => {
      mockCache.match.mockResolvedValueOnce(undefined)

      const result = await getAsset('https://example.com/missing.json')

      expect(result).toBeNull()
    })

    it('should return blob URL when asset found', async () => {
      const mockBlob = new Blob(['test'])
      const mockResponse = {
        blob: vi.fn().mockResolvedValue(mockBlob),
      }
      mockCache.match.mockResolvedValueOnce(mockResponse)

      // Mock URL.createObjectURL
      const mockBlobUrl = 'blob:test-url'
      global.URL.createObjectURL = vi.fn().mockReturnValue(mockBlobUrl)

      const result = await getAsset('https://example.com/asset.json')

      expect(result).toBe(mockBlobUrl)
    })
  })

  describe('hasAsset', () => {
    it('should return true when asset exists', async () => {
      mockCache.match.mockResolvedValueOnce({ ok: true })

      const result = await hasAsset('https://example.com/asset.json')

      expect(result).toBe(true)
    })

    it('should return false when asset not found', async () => {
      mockCache.match.mockResolvedValueOnce(undefined)

      const result = await hasAsset('https://example.com/missing.json')

      expect(result).toBe(false)
    })
  })

  describe('deleteAsset', () => {
    it('should delete asset from cache', async () => {
      mockCache.delete.mockResolvedValueOnce(true)

      const result = await deleteAsset('https://example.com/asset.json')

      expect(result).toBe(true)
      expect(mockCache.delete).toHaveBeenCalledWith('https://example.com/asset.json')
    })
  })

  describe('clearAll', () => {
    it('should delete the entire cache', async () => {
      await clearAll()

      expect(mockCaches.delete).toHaveBeenCalledWith('flylive-assets-v1')
    })
  })

  describe('getTotalSize', () => {
    it('should calculate total size from Content-Length headers', async () => {
      const mockRequest1 = { url: 'https://example.com/asset1.json' }
      const mockRequest2 = { url: 'https://example.com/asset2.json' }

      mockCache.keys.mockResolvedValueOnce([mockRequest1, mockRequest2])
      mockCache.match
        .mockResolvedValueOnce({
          headers: { get: () => '1000' },
        })
        .mockResolvedValueOnce({
          headers: { get: () => '2000' },
        })

      const result = await getTotalSize()

      expect(result).toBe(3000)
    })

    it('should return 0 when cache is empty', async () => {
      mockCache.keys.mockResolvedValueOnce([])

      const result = await getTotalSize()

      expect(result).toBe(0)
    })
  })

  describe('getCachedUrls', () => {
    it('should return list of cached URLs', async () => {
      mockCache.keys.mockResolvedValueOnce([
        { url: 'https://example.com/asset1.json' },
        { url: 'https://example.com/asset2.json' },
      ])

      const result = await getCachedUrls()

      expect(result).toEqual([
        'https://example.com/asset1.json',
        'https://example.com/asset2.json',
      ])
    })
  })
})
