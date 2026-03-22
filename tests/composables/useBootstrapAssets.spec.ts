// ========================================
// useBootstrapAssets Composable Tests
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
  createMockBootstrapStore,
  createMockAssetStore,
} from '../helpers/nuxtMocks'

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

vi.mock('~/utils/platform', () => ({
  resolveVideoUrl: (url: string) => url,
}))

const mockAssetDownloader = {
  enqueue: vi.fn(),
  enqueueManual: vi.fn(),
  start: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  onProgress: vi.fn(),
  onComplete: vi.fn(),
}

const mockCacheStorage = {
  initCacheStorage: vi.fn().mockResolvedValue(undefined),
  deleteAsset: vi.fn().mockResolvedValue(true),
}

const mockAssetIndex = {
  initAssetIndex: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
}

vi.mock('~/services/assetDownloader', () => mockAssetDownloader)
vi.mock('~/services/cacheStorage', () => mockCacheStorage)
vi.mock('~/services/assetIndex', () => mockAssetIndex)

// ========================================
// Tests
// ========================================

let useBootstrapAssets: () => ReturnType<typeof import('~/composables/shared/useBootstrapAssets')['useBootstrapAssets']>

describe('useBootstrapAssets', () => {
  let bootstrapStore: ReturnType<typeof createMockBootstrapStore>
  let assetStore: ReturnType<typeof createMockAssetStore>

  beforeEach(async () => {
    bootstrapStore = createMockBootstrapStore({
      giftCatalog: [
        { id: 1, animation_url: 'https://cdn.example.com/gift1.webm', asset_type: 'video', sort_order: 1 },
        { id: 2, animation_url: 'https://cdn.example.com/gift2.svga', asset_type: 'svga', sort_order: 2 },
        { id: 3, animation_url: null, asset_type: 'image', sort_order: 3 }, // Filtered out
      ],
    })
    assetStore = createMockAssetStore()
    setupNuxtMocks({ bootstrapStore, assetStore })

    vi.clearAllMocks()

    const mod = await import('~/composables/shared/useBootstrapAssets')
    useBootstrapAssets = mod.useBootstrapAssets
  })

  afterEach(() => {
    cleanupNuxtMocks()
    vi.restoreAllMocks()
  })

  describe('startAssetDownload', () => {
    it('GATE: should skip when already downloading', async () => {
      assetStore.phase = 'downloading'
      const { startAssetDownload } = useBootstrapAssets()

      await startAssetDownload()

      expect(mockCacheStorage.initCacheStorage).not.toHaveBeenCalled()
    })

    it('GATE: should set complete phase when no gifts', async () => {
      bootstrapStore.giftCatalog = []
      const { startAssetDownload } = useBootstrapAssets()

      await startAssetDownload()

      expect(assetStore.setPhase).toHaveBeenCalledWith('complete')
    })

    it('EXECUTE: should init services before enqueuing', async () => {
      const { startAssetDownload } = useBootstrapAssets()

      await startAssetDownload()

      expect(mockCacheStorage.initCacheStorage).toHaveBeenCalled()
      expect(mockAssetIndex.initAssetIndex).toHaveBeenCalled()
    })

    it('EXECUTE: should filter out image-only and null animation assets', async () => {
      const { startAssetDownload } = useBootstrapAssets()

      await startAssetDownload()

      // Only 2 valid items (gift1 video, gift2 svga); gift3 has null URL
      expect(mockAssetDownloader.enqueue).toHaveBeenCalledTimes(1)
      const enqueuedItems = mockAssetDownloader.enqueue.mock.calls[0]![0]
      expect(enqueuedItems).toHaveLength(2)
    })

    it('EXECUTE: should set phase to downloading and call start', async () => {
      const { startAssetDownload } = useBootstrapAssets()

      await startAssetDownload()

      expect(assetStore.setPhase).toHaveBeenCalledWith('downloading')
      expect(mockAssetDownloader.start).toHaveBeenCalled()
    })

    it('REACT: should subscribe to progress and complete callbacks', async () => {
      const { startAssetDownload } = useBootstrapAssets()

      await startAssetDownload()

      expect(mockAssetDownloader.onProgress).toHaveBeenCalledWith(expect.any(Function))
      expect(mockAssetDownloader.onComplete).toHaveBeenCalledWith(expect.any(Function))
    })
  })

  describe('invalidateAsset', () => {
    it('should delete from cache and index', async () => {
      const { invalidateAsset } = useBootstrapAssets()

      await invalidateAsset({ url: 'https://cdn.example.com/old.webm', priority: 'normal' })

      expect(mockCacheStorage.deleteAsset).toHaveBeenCalledWith('https://cdn.example.com/old.webm')
      expect(mockAssetIndex.remove).toHaveBeenCalledWith('https://cdn.example.com/old.webm')
    })

    it('should re-download critical assets', async () => {
      const { invalidateAsset } = useBootstrapAssets()

      await invalidateAsset({ url: 'https://cdn.example.com/critical.webm', priority: 'critical' })

      expect(mockAssetDownloader.enqueueManual).toHaveBeenCalledWith(
        'https://cdn.example.com/critical.webm',
        { priority: 'critical', assetType: 'video' },
      )
    })

    it('should NOT re-download normal-priority assets', async () => {
      const { invalidateAsset } = useBootstrapAssets()

      await invalidateAsset({ url: 'https://cdn.example.com/normal.webm', priority: 'normal' })

      expect(mockAssetDownloader.enqueueManual).not.toHaveBeenCalled()
    })
  })

  describe('pause / resume', () => {
    it('should delegate pause to service', () => {
      const { pause } = useBootstrapAssets()
      pause()
      expect(mockAssetDownloader.pause).toHaveBeenCalled()
    })

    it('should delegate resume to service', () => {
      const { resume } = useBootstrapAssets()
      resume()
      expect(mockAssetDownloader.resume).toHaveBeenCalled()
    })
  })
})
