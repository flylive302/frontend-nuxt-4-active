// ========================================
// SVGA Asset Cache Service Tests
// ========================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveSvgaSource, evictSvga } from '~/services/svgaAssetCache'

// ========================================
// Mocks
// ========================================

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

const { mockCacheStorage, mockAssetIndex } = vi.hoisted(() => ({
  mockCacheStorage: {
    getAsset: vi.fn(),
    putAsset: vi.fn(),
    deleteAsset: vi.fn(),
    hasAsset: vi.fn(),
  },
  mockAssetIndex: {
    get: vi.fn(),
    upsert: vi.fn(),
    remove: vi.fn(),
    updateLastAccessed: vi.fn(),
  },
}))

vi.mock('~/services/cacheStorage', () => mockCacheStorage)
vi.mock('~/services/assetIndex', () => mockAssetIndex)

const SVGA_URL = 'https://assets.flyliveapp.com/frames/frame-7.svga'

// ========================================
// Tests
// ========================================

describe('svgaAssetCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCacheStorage.getAsset.mockResolvedValue(null)
    mockCacheStorage.putAsset.mockResolvedValue(undefined)
    mockCacheStorage.deleteAsset.mockResolvedValue(true)
    mockAssetIndex.get.mockResolvedValue(null)
    mockAssetIndex.upsert.mockResolvedValue(undefined)
    mockAssetIndex.remove.mockResolvedValue(undefined)
    mockAssetIndex.updateLastAccessed.mockResolvedValue(undefined)

    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('URL', Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    }))
  })

  describe('resolveSvgaSource', () => {
    it('passes through non-http URLs untouched', async () => {
      const source = await resolveSvgaSource('blob:local-thing')

      expect(source.src).toBe('blob:local-thing')
      expect(mockCacheStorage.getAsset).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
    })

    it('serves a cache hit as a blob URL without touching the network', async () => {
      mockCacheStorage.getAsset.mockResolvedValue('blob:cached-url')

      const source = await resolveSvgaSource(SVGA_URL)

      expect(source.src).toBe('blob:cached-url')
      expect(fetch).not.toHaveBeenCalled()
      expect(mockAssetIndex.updateLastAccessed).toHaveBeenCalledWith(SVGA_URL)

      source.revoke()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cached-url')
    })

    it('on a miss: fetches, persists to cache + index (scope runtime), returns blob URL', async () => {
      const blob = new Blob(['svga-bytes'])
      vi.mocked(fetch).mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) } as unknown as Response)

      const source = await resolveSvgaSource(SVGA_URL)

      expect(source.src).toBe('blob:mock-url')
      expect(mockCacheStorage.putAsset).toHaveBeenCalledWith(SVGA_URL, blob)
      expect(mockAssetIndex.upsert).toHaveBeenCalledWith(expect.objectContaining({
        url: SVGA_URL,
        assetType: 'svga',
        scope: 'runtime',
        priority: 'normal',
        sizeBytes: blob.size,
      }))
    })

    it('preserves existing index scope/priority for catalog-owned entries', async () => {
      const blob = new Blob(['svga-bytes'])
      vi.mocked(fetch).mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) } as unknown as Response)
      mockAssetIndex.get.mockResolvedValue({
        url: SVGA_URL,
        assetType: 'svga',
        priority: 'critical',
        scope: 'vip',
        sizeBytes: 1,
        downloadedAt: 1,
        lastAccessedAt: 1,
        retryCount: 0,
      })

      await resolveSvgaSource(SVGA_URL)

      expect(mockAssetIndex.upsert).toHaveBeenCalledWith(expect.objectContaining({
        scope: 'vip',
        priority: 'critical',
      }))
    })

    it('falls back to the original URL when fetch fails', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('network down'))

      const source = await resolveSvgaSource(SVGA_URL)

      expect(source.src).toBe(SVGA_URL)
      expect(mockCacheStorage.putAsset).not.toHaveBeenCalled()
    })

    it('falls back to the original URL on non-OK response', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404 } as unknown as Response)

      const source = await resolveSvgaSource(SVGA_URL)

      expect(source.src).toBe(SVGA_URL)
      expect(mockCacheStorage.putAsset).not.toHaveBeenCalled()
    })

    it('still returns a playable blob URL when persistence fails (quota)', async () => {
      const blob = new Blob(['svga-bytes'])
      vi.mocked(fetch).mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) } as unknown as Response)
      mockCacheStorage.putAsset.mockRejectedValue(new Error('QuotaExceededError'))

      const source = await resolveSvgaSource(SVGA_URL)

      expect(source.src).toBe('blob:mock-url')
    })

    it('normalizes the URL for cache keys (sorted query params)', async () => {
      mockCacheStorage.getAsset.mockResolvedValue('blob:cached-url')

      await resolveSvgaSource('https://assets.flyliveapp.com/f.svga?b=2&a=1')

      expect(mockCacheStorage.getAsset).toHaveBeenCalledWith('https://assets.flyliveapp.com/f.svga?a=1&b=2')
    })
  })

  describe('evictSvga', () => {
    it('removes the entry from cache storage and the index', async () => {
      await evictSvga(SVGA_URL)

      expect(mockCacheStorage.deleteAsset).toHaveBeenCalledWith(SVGA_URL)
      expect(mockAssetIndex.remove).toHaveBeenCalledWith(SVGA_URL)
    })
  })
})
