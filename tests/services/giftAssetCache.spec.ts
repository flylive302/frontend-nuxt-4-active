// ========================================
// Gift Asset Cache Service Tests
// ========================================
// Tests for the 3-tier cache strategy: L1 Memory → L2 Cache Storage → L3 Network

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

// Mock platform resolver — passthrough
vi.mock('~/utils/platform', () => ({
  resolveVideoUrl: (url: string) => url,
}))

// Mock dependent services — must use vi.hoisted() since vi.mock is hoisted
const { mockCacheStorage, mockAssetIndex } = vi.hoisted(() => ({
  mockCacheStorage: {
    getAsset: vi.fn().mockResolvedValue(null),
    putAsset: vi.fn().mockResolvedValue(undefined),
    hasAsset: vi.fn().mockResolvedValue(false),
    deleteAsset: vi.fn().mockResolvedValue(true),
  },
  mockAssetIndex: {
    updateLastAccessed: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('~/services/cacheStorage', () => mockCacheStorage)
vi.mock('~/services/assetIndex', () => mockAssetIndex)

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock URL.createObjectURL
const mockBlobUrl = 'blob:http://localhost/mock-blob-url'

// ========================================
// Tests
// ========================================

describe('giftAssetCache', () => {
  // Fresh import each test to reset module-level singleton caches
  let giftAssetCache: typeof import('~/services/giftAssetCache')

  beforeEach(async () => {
    vi.clearAllMocks()

    // Re-establish URL.createObjectURL mock (cleared by vi.clearAllMocks)
    global.URL.createObjectURL = vi.fn().mockReturnValue(mockBlobUrl)

    // Reset module registry to clear module-level Maps/Sets
    vi.resetModules()

    // Fresh import
    giftAssetCache = await import('~/services/giftAssetCache')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ========================================
  // preloadVideo
  // ========================================

  describe('preloadVideo', () => {
    it('should fetch from network (L3) when not cached', async () => {
      const blob = new Blob(['video data'])
      mockCacheStorage.getAsset.mockResolvedValueOnce(null)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValue(blob),
      })

      const result = await giftAssetCache.preloadVideo('https://example.com/video.webm')

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/video.webm')
      expect(mockCacheStorage.putAsset).toHaveBeenCalledWith('https://example.com/video.webm', blob)
      expect(result).toBe(mockBlobUrl)
    })

    it('should return from L2 (Cache Storage) without fetching', async () => {
      const cachedBlobUrl = 'blob:http://localhost/cached'
      mockCacheStorage.getAsset.mockResolvedValueOnce(cachedBlobUrl)

      const result = await giftAssetCache.preloadVideo('https://example.com/video.webm')

      expect(result).toBe(cachedBlobUrl)
      expect(mockFetch).not.toHaveBeenCalled()
      expect(mockAssetIndex.updateLastAccessed).toHaveBeenCalled()
    })

    it('should return from L1 (memory) on second call without hitting L2', async () => {
      // First call — populate L1 from network
      const blob = new Blob(['data'])
      mockCacheStorage.getAsset.mockResolvedValueOnce(null)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValue(blob),
      })
      const firstResult = await giftAssetCache.preloadVideo('https://example.com/video.webm')

      // Reset only the specific mocks we want to check
      mockCacheStorage.getAsset.mockClear()
      mockFetch.mockClear()

      // Second call — should hit L1 memory
      const result = await giftAssetCache.preloadVideo('https://example.com/video.webm')

      expect(result).toBe(firstResult)
      expect(mockCacheStorage.getAsset).not.toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should deduplicate concurrent requests for same URL', async () => {
      const blob = new Blob(['data'])
      mockCacheStorage.getAsset.mockResolvedValue(null)
      mockFetch.mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(blob),
      })

      // Start two concurrent loads for the same URL
      const [result1, result2] = await Promise.all([
        giftAssetCache.preloadVideo('https://example.com/same.webm'),
        giftAssetCache.preloadVideo('https://example.com/same.webm'),
      ])

      expect(result1).toBe(result2)
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only one fetch
    })

    it('should throw on failed fetch', async () => {
      mockCacheStorage.getAsset.mockResolvedValueOnce(null)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      await expect(
        giftAssetCache.preloadVideo('https://example.com/missing.webm')
      ).rejects.toThrow('HTTP 404')
    })
  })

  // ========================================
  // preloadSvga
  // ========================================

  describe('preloadSvga', () => {
    it('should use SVGA plugin fetchAnimation when available', async () => {
      const svgaPlugin = {
        fetchAnimation: vi.fn().mockResolvedValue({}),
      }

      const warmed = await giftAssetCache.preloadSvga('gift_animation', svgaPlugin)

      expect(svgaPlugin.fetchAnimation).toHaveBeenCalledWith('gift_animation')
      expect(warmed).toBe(true)
    })

    it('should fallback to fetch() when no SVGA plugin', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      const warmed = await giftAssetCache.preloadSvga('gift_animation')

      expect(mockFetch).toHaveBeenCalledWith('gift_animation')
      // bytes only — parse cache is still cold, so this must NOT count as ready
      expect(warmed).toBe(false)
    })

    it('should not throw on SVGA plugin error', async () => {
      const svgaPlugin = {
        fetchAnimation: vi.fn().mockRejectedValue(new Error('SVGA parse error')),
      }

      await expect(
        giftAssetCache.preloadSvga('broken_animation', svgaPlugin)
      ).resolves.toBe(false)
    })
  })

  // ========================================
  // preloadGift
  // ========================================

  describe('preloadGift', () => {
    it('should route video gifts to preloadVideo', async () => {
      const blob = new Blob(['video'])
      mockCacheStorage.getAsset.mockResolvedValueOnce(null)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValue(blob),
      })

      await giftAssetCache.preloadGift({
        id: 1,
        asset_type: 'video',
        animation_url: 'https://example.com/gift.webm',
      })

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/gift.webm')
    })

    it('should route SVGA gifts to preloadSvga', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      await giftAssetCache.preloadGift({
        id: 2,
        asset_type: 'svga',
        animation_url: 'https://example.com/gift.svga',
      })

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/gift.svga')
    })

    it('does NOT mark an svga gift ready when only the HTTP cache was warmed (no plugin)', async () => {
      mockFetch.mockResolvedValue({ ok: true })
      mockCacheStorage.hasAsset.mockResolvedValue(false)
      const gift = { id: 77, asset_type: 'svga', animation_url: 'https://example.com/gift.svga' }

      await giftAssetCache.preloadGift(gift)

      expect(
        await giftAssetCache.isGiftAssetCached({ ...gift, thumbnail_url: 'https://cdn.example.com/t.jpg' }),
      ).toBe(false)
      // and a later preload WITH the plugin is not short-circuited by the id set
      const svgaPlugin = { fetchAnimation: vi.fn().mockResolvedValue({}) }
      await giftAssetCache.preloadGift(gift, svgaPlugin)
      expect(svgaPlugin.fetchAnimation).toHaveBeenCalledWith('https://example.com/gift.svga')
      expect(
        await giftAssetCache.isGiftAssetCached({ ...gift, thumbnail_url: 'https://cdn.example.com/t.jpg' }),
      ).toBe(true)
    })

    it('should skip gifts with no animation_url', async () => {
      await giftAssetCache.preloadGift({
        id: 3,
        asset_type: 'video',
        animation_url: null,
      })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should skip already-preloaded gifts', async () => {
      const blob = new Blob(['data'])
      mockCacheStorage.getAsset.mockResolvedValue(null)
      mockFetch.mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(blob),
      })

      const gift = { id: 42, asset_type: 'video', animation_url: 'https://example.com/gift42.webm' }

      await giftAssetCache.preloadGift(gift)
      vi.clearAllMocks()

      // Second call should be a no-op
      await giftAssetCache.preloadGift(gift)

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  // ========================================
  // getCachedVideoUrlSync
  // ========================================

  describe('getCachedVideoUrlSync', () => {
    it('should return original URL when not in L1 cache', () => {
      const result = giftAssetCache.getCachedVideoUrlSync('https://example.com/uncached.webm')
      expect(result).toBe('https://example.com/uncached.webm')
    })

    it('should return blob URL when in L1 cache', async () => {
      // Prime L1 cache
      const blob = new Blob(['data'])
      mockCacheStorage.getAsset.mockResolvedValueOnce(null)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValue(blob),
      })
      const cachedUrl = await giftAssetCache.preloadVideo('https://example.com/cached.webm')

      const result = giftAssetCache.getCachedVideoUrlSync('https://example.com/cached.webm')
      expect(result).toBe(cachedUrl)
      expect(result).not.toBe('https://example.com/cached.webm') // Not the original URL
    })
  })

  // ========================================
  // Utility functions
  // ========================================

  describe('isVideoCached', () => {
    it('should return false for uncached URL', () => {
      expect(giftAssetCache.isVideoCached('https://example.com/nope.webm')).toBe(false)
    })
  })

  describe('isGiftPreloaded', () => {
    it('should return false for un-preloaded gift', () => {
      expect(giftAssetCache.isGiftPreloaded(999)).toBe(false)
    })

    it('should return true after preloading a gift', async () => {
      const blob = new Blob(['data'])
      mockCacheStorage.getAsset.mockResolvedValueOnce(null)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValue(blob),
      })

      await giftAssetCache.preloadGift({
        id: 55,
        asset_type: 'video',
        animation_url: 'https://example.com/g55.webm',
      })

      expect(giftAssetCache.isGiftPreloaded(55)).toBe(true)
    })
  })

  describe('getCacheStats', () => {
    it('should return zeroed stats initially', () => {
      const stats = giftAssetCache.getCacheStats()
      expect(stats.videoCount).toBe(0)
      expect(stats.pendingCount).toBe(0)
      expect(stats.preloadedGiftCount).toBe(0)
    })
  })

  // ========================================
  // isGiftAssetCached
  // ========================================

  describe('isGiftAssetCached', () => {
    let mockCacheMatch: ReturnType<typeof vi.fn>
    let mockCacheOpen: ReturnType<typeof vi.fn>

    afterEach(() => {
      // Prevent global.caches from leaking into non-image tests
      delete (global as Record<string, unknown>).caches
    })

    function setupImageCache(response: Response | undefined): void {
      mockCacheMatch = vi.fn().mockResolvedValue(response)
      mockCacheOpen = vi.fn().mockResolvedValue({ match: mockCacheMatch })
      ;(global as Record<string, unknown>).caches = { open: mockCacheOpen }
    }

    it('returns true for video when cacheStorage.hasAsset returns true', async () => {
      mockCacheStorage.hasAsset.mockResolvedValueOnce(true)

      const result = await giftAssetCache.isGiftAssetCached({
        asset_type: 'video',
        animation_url: 'https://example.com/gift.webm',
        thumbnail_url: 'https://cdn.example.com/thumb.jpg',
      })

      expect(result).toBe(true)
      expect(mockCacheStorage.hasAsset).toHaveBeenCalledWith('https://example.com/gift.webm')
    })

    it('returns false for video when cacheStorage.hasAsset returns false', async () => {
      mockCacheStorage.hasAsset.mockResolvedValueOnce(false)

      const result = await giftAssetCache.isGiftAssetCached({
        asset_type: 'video',
        animation_url: 'https://example.com/gift.webm',
        thumbnail_url: 'https://cdn.example.com/thumb.jpg',
      })

      expect(result).toBe(false)
    })

    it('returns true for svga when preloaded in this session (L1)', async () => {
      const svgaPlugin = { fetchAnimation: vi.fn().mockResolvedValue({}) }

      await giftAssetCache.preloadGift(
        {
          id: 42,
          asset_type: 'svga',
          animation_url: 'https://example.com/gift.svga',
        },
        svgaPlugin,
      )

      const result = await giftAssetCache.isGiftAssetCached({
        id: 42,
        asset_type: 'svga',
        animation_url: 'https://example.com/gift.svga',
        thumbnail_url: 'https://cdn.example.com/thumb.jpg',
      })

      expect(result).toBe(true)
      expect(mockCacheStorage.hasAsset).not.toHaveBeenCalled()
    })

    it('falls back to persistent cache for svga when not preloaded this session', async () => {
      mockCacheStorage.hasAsset.mockResolvedValue(false)

      const result = await giftAssetCache.isGiftAssetCached({
        id: 999,
        asset_type: 'svga',
        animation_url: 'https://example.com/gift.svga',
        thumbnail_url: 'https://cdn.example.com/thumb.jpg',
      })

      expect(result).toBe(false)
      expect(mockCacheStorage.hasAsset).toHaveBeenCalledWith('https://example.com/gift.svga')
    })

    it('returns true for svga persisted by the read-through cache (second session)', async () => {
      mockCacheStorage.hasAsset.mockResolvedValue(true)

      const result = await giftAssetCache.isGiftAssetCached({
        id: 999,
        asset_type: 'svga',
        animation_url: 'https://example.com/gift.svga',
        thumbnail_url: 'https://cdn.example.com/thumb.jpg',
      })

      expect(result).toBe(true)
    })

    it('returns true for vap when cacheStorage.hasAsset returns true', async () => {
      mockCacheStorage.hasAsset.mockResolvedValueOnce(true)

      const result = await giftAssetCache.isGiftAssetCached({
        asset_type: 'vap',
        animation_url: 'https://example.com/gift.mp4',
        thumbnail_url: 'https://cdn.example.com/thumb.jpg',
      })

      expect(result).toBe(true)
      expect(mockCacheStorage.hasAsset).toHaveBeenCalledWith('https://example.com/gift.mp4')
    })

    it('returns false for non-image type when animation_url is null', async () => {
      const result = await giftAssetCache.isGiftAssetCached({
        asset_type: 'video',
        animation_url: null,
        thumbnail_url: 'https://cdn.example.com/thumb.jpg',
      })

      expect(result).toBe(false)
      expect(mockCacheStorage.hasAsset).not.toHaveBeenCalled()
    })

    it('returns true for image without probing the image cache (NuxtImg rewrites the URL)', async () => {
      // A cdn-images cache is present, but the image branch must NOT consult it:
      // NuxtImg appends `tr=` params, so caches.match(thumbnail_url) would always
      // miss. Images load natively via <img>, so they are treated as always-ready.
      setupImageCache(new Response())

      const result = await giftAssetCache.isGiftAssetCached({
        asset_type: 'image',
        animation_url: null,
        thumbnail_url: 'https://cdn.example.com/thumb.jpg',
      })

      expect(result).toBe(true)
      expect(mockCacheOpen).not.toHaveBeenCalled()
      expect(mockCacheStorage.hasAsset).not.toHaveBeenCalled()
    })

    it('returns true for image even when caches is unavailable (SSR-safe)', async () => {
      // The image branch never touches `caches`, so the SSR path (no global) is safe.
      delete (global as Record<string, unknown>).caches

      const result = await giftAssetCache.isGiftAssetCached({
        asset_type: 'image',
        animation_url: null,
        thumbnail_url: 'https://cdn.example.com/thumb.jpg',
      })

      expect(result).toBe(true)
      expect(mockCacheStorage.hasAsset).not.toHaveBeenCalled()
    })

    it('returns true from L1 without hitting L2 (cacheStorage.hasAsset)', async () => {
      // Prime L1 via preloadVideo
      const blob = new Blob(['video'])
      mockCacheStorage.getAsset.mockResolvedValueOnce(null)
      mockFetch.mockResolvedValueOnce({ ok: true, blob: vi.fn().mockResolvedValue(blob) })
      await giftAssetCache.preloadVideo('https://example.com/primed.webm')

      mockCacheStorage.hasAsset.mockClear()

      const result = await giftAssetCache.isGiftAssetCached({
        asset_type: 'video',
        animation_url: 'https://example.com/primed.webm',
        thumbnail_url: 'https://cdn.example.com/thumb.jpg',
      })

      expect(result).toBe(true)
      expect(mockCacheStorage.hasAsset).not.toHaveBeenCalled()
    })
  })
})
