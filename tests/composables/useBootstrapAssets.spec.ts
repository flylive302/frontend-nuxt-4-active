// ========================================
// useBootstrapAssets Composable Tests
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
  createMockBootstrapStore,
  createMockAssetStore,
  createMockMallStore,
} from '../helpers/nuxtMocks'
import type { Gift } from '~/types/gift/gift'

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
  onItemResult: vi.fn(),
}

const mockCacheStorage = {
  initCacheStorage: vi.fn().mockResolvedValue(undefined),
  deleteAsset: vi.fn().mockResolvedValue(true),
}

const mockAssetIndex = {
  initAssetIndex: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  getStale: vi.fn().mockResolvedValue([]),
  getAllByPriority: vi.fn().mockResolvedValue([]),
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
      gifts: [
        { id: 1, animation_url: 'https://cdn.example.com/gift1.webm', asset_type: 'video', sort_order: 1 },
        { id: 2, animation_url: 'https://cdn.example.com/gift2.svga', asset_type: 'svga', sort_order: 2 },
        { id: 3, animation_url: null, asset_type: 'image', sort_order: 3 }, // Filtered out
      ],
      badges: [{ id: 9, image_url: 'https://example.com/badge_9.webp' }],
    })
    assetStore = createMockAssetStore()
    setupNuxtMocks({ bootstrapStore, assetStore, route: { path: '/explore', meta: { middleware: [] } } })

    vi.clearAllMocks()

    const mod = await import('~/composables/shared/useBootstrapAssets')
    useBootstrapAssets = mod.useBootstrapAssets
  })

  afterEach(() => {
    cleanupNuxtMocks()
    vi.restoreAllMocks()
  })

  describe('startAssetDownload', () => {
    it('GATE: should not (re)start the download when already downloading', async () => {
      // Init/index setup now runs unconditionally; the guard moved past
      // queue-building and only prevents kicking off a second download.
      assetStore.phase = 'downloading'
      const { startAssetDownload } = useBootstrapAssets()

      await startAssetDownload()

      expect(mockAssetDownloader.start).not.toHaveBeenCalled()
    })

    it('EXECUTE: completes without downloading when there is nothing to fetch', async () => {
      // Isolate from the real PAGE_ASSET_MANIFESTS (which always carries the mall
      // video) so the queue can genuinely be empty: no gifts, no page items.
      vi.resetModules()
      vi.doMock('~/constants/assetManifest', () => ({ MANUAL_ASSET_MANIFEST: [], PAGE_ASSET_MANIFESTS: {} }))
      bootstrapStore.gifts = []
      const mod = await import('~/composables/shared/useBootstrapAssets')
      const { startAssetDownload } = mod.useBootstrapAssets()

      await startAssetDownload()

      expect(mockAssetDownloader.enqueue).not.toHaveBeenCalled()
      expect(assetStore.setPhase).toHaveBeenCalledWith('complete')

      vi.doUnmock('~/constants/assetManifest')
      vi.resetModules()
      const freshMod = await import('~/composables/shared/useBootstrapAssets')
      useBootstrapAssets = freshMod.useBootstrapAssets
    })

    it('EXECUTE: should init services before enqueuing', async () => {
      const { startAssetDownload } = useBootstrapAssets()

      await startAssetDownload()

      expect(mockCacheStorage.initCacheStorage).toHaveBeenCalled()
      expect(mockAssetIndex.initAssetIndex).toHaveBeenCalled()
    })

    it('EXECUTE: should filter out image-only and null-animation gift assets', async () => {
      const { startAssetDownload } = useBootstrapAssets()

      await startAssetDownload()

      // The queue also carries app-shell/manual assets — assert only the gift items:
      // gift1 (video) + gift2 (svga) kept; gift3 (null URL / image) filtered out.
      expect(mockAssetDownloader.enqueue).toHaveBeenCalledTimes(1)
      const enqueuedItems = mockAssetDownloader.enqueue.mock.calls[0]![0] as { scope: string }[]
      const giftItems = enqueuedItems.filter((i) => i.scope === 'gift')
      expect(giftItems).toHaveLength(2)
    })

    it('EXECUTE: never enqueues a badge picture, even though badges exist in the bootstrap catalog', async () => {
      const { startAssetDownload } = useBootstrapAssets()

      await startAssetDownload()

      const enqueuedItems = mockAssetDownloader.enqueue.mock.calls[0]![0] as { scope: string; assetType: string }[]
      expect(enqueuedItems.some((i) => i.scope === 'badge')).toBe(false)
      // Mutation check: only 'svga' | 'video' | 'vap' should ever reach the queue.
      for (const item of enqueuedItems) {
        expect(['svga', 'video', 'vap']).toContain(item.assetType)
      }
    })

    it('EXECUTE: skips a gift whose asset_type is "image"', async () => {
      bootstrapStore.gifts = [
        { id: 4, animation_url: 'https://cdn.example.com/gift4.png', asset_type: 'image', sort_order: 1 },
      ] as unknown as Gift[]
      const { startAssetDownload } = useBootstrapAssets()

      await startAssetDownload()

      // Mall page video still queues (page manifests aren't route/catalog-scoped);
      // the image gift itself never enters the queue.
      const enqueuedItems = mockAssetDownloader.enqueue.mock.calls[0]![0] as { scope: string }[]
      expect(enqueuedItems.some((i) => i.scope === 'gift')).toBe(false)
    })

    it('EXECUTE: queues the mall page video regardless of the current route', async () => {
      setupNuxtMocks({ bootstrapStore, assetStore, route: { path: '/wallet', meta: { middleware: [] } } })
      const { startAssetDownload } = useBootstrapAssets()

      await startAssetDownload()

      const enqueuedItems = mockAssetDownloader.enqueue.mock.calls[0]![0] as { scope: string; groupKey?: string }[]
      expect(enqueuedItems.some((i) => i.groupKey === 'page-mall')).toBe(true)
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

    it('REACT: calls deleteAsset and remove for each stale entry via requestIdleCallback', async () => {
      const staleEntries = [
        { url: 'https://cdn.example.com/old1.webm' },
        { url: 'https://cdn.example.com/old2.webm' },
        { url: 'https://cdn.example.com/old3.svga' },
      ]
      mockAssetIndex.getStale.mockResolvedValue(staleEntries)
      ;(globalThis as Record<string, unknown>).requestIdleCallback = (cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void) => {
        cb({ didTimeout: false, timeRemaining: () => 50 })
        return 1
      }

      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload()

      await vi.waitFor(() => expect(mockCacheStorage.deleteAsset).toHaveBeenCalledTimes(3))
      expect(mockAssetIndex.remove).toHaveBeenCalledTimes(3)
      expect(mockCacheStorage.deleteAsset).toHaveBeenCalledWith('https://cdn.example.com/old1.webm')
      expect(mockCacheStorage.deleteAsset).toHaveBeenCalledWith('https://cdn.example.com/old2.webm')
      expect(mockCacheStorage.deleteAsset).toHaveBeenCalledWith('https://cdn.example.com/old3.svga')

      Reflect.deleteProperty(globalThis, 'requestIdleCallback')
    })

    it('quiet mode: enqueues and starts, but never touches assetStore or subscribes callbacks', async () => {
      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload({ quiet: true })

      expect(mockAssetDownloader.enqueue).toHaveBeenCalledTimes(1)
      expect(mockAssetDownloader.start).toHaveBeenCalled()
      expect(assetStore.setPhase).not.toHaveBeenCalled()
      expect(mockAssetDownloader.onProgress).not.toHaveBeenCalled()
      expect(mockAssetDownloader.onComplete).not.toHaveBeenCalled()
      expect(mockAssetDownloader.onItemResult).not.toHaveBeenCalled()
    })

    it('quiet mode: an empty queue just returns, without enqueueing or starting', async () => {
      vi.resetModules()
      vi.doMock('~/constants/assetManifest', () => ({ MANUAL_ASSET_MANIFEST: [], PAGE_ASSET_MANIFESTS: {} }))
      bootstrapStore.gifts = []
      const mod = await import('~/composables/shared/useBootstrapAssets')
      const { startAssetDownload } = mod.useBootstrapAssets()

      await startAssetDownload({ quiet: true })

      expect(mockAssetDownloader.enqueue).not.toHaveBeenCalled()
      expect(mockAssetDownloader.start).not.toHaveBeenCalled()
      expect(assetStore.setPhase).not.toHaveBeenCalled()

      vi.doUnmock('~/constants/assetManifest')
      vi.resetModules()
      const freshMod = await import('~/composables/shared/useBootstrapAssets')
      useBootstrapAssets = freshMod.useBootstrapAssets
    })
    // Defence in depth: a miscategorised manifest entry must still never
    // reach the queue as a picture (Cache Storage copies of pictures are never read).
    it('drops a picture-typed manifest entry before it reaches the queue', async () => {
      vi.resetModules()
      vi.doMock('~/constants/assetManifest', () => ({
        MANUAL_ASSET_MANIFEST: [
          { url: 'https://ik.imagekit.io/x/pic.webp', assetType: 'image', scope: 'manual', priority: 'high' },
        ],
        PAGE_ASSET_MANIFESTS: {},
      }))
      bootstrapStore.gifts = []
      try {
        const mod = await import('~/composables/shared/useBootstrapAssets')
        const { startAssetDownload } = mod.useBootstrapAssets()

        await startAssetDownload({ quiet: true })

        expect(mockAssetDownloader.enqueue).not.toHaveBeenCalled()
      } finally {
        vi.doUnmock('~/constants/assetManifest')
        vi.resetModules()
        const freshMod = await import('~/composables/shared/useBootstrapAssets')
        useBootstrapAssets = freshMod.useBootstrapAssets
      }
    })
  })

  describe('startRoomAssetDownload', () => {
    it('enqueues gift animations only — no props, VIP, or page items — and runs no eviction', async () => {
      const mallStore = createMockMallStore({
        propIndex: {
          1: { id: 1, type: 'frame', asset_url: 'https://assets.flyliveapp.com/frames/1.svga', thumbnail_url: '', name: 'Frame' },
        },
      })
      ;(globalThis as Record<string, unknown>).useMallStore = () => mallStore
      bootstrapStore.vipLevels = [
        { id: 3, level: 3, color: '#000000', card_animated_url: 'https://assets.flyliveapp.com/vip/3/card.mp4', emblem_animated_url: null },
      ]

      const { startRoomAssetDownload } = useBootstrapAssets()
      await startRoomAssetDownload()

      expect(mockAssetDownloader.enqueue).toHaveBeenCalledTimes(1)
      const items = mockAssetDownloader.enqueue.mock.calls[0]![0] as { scope: string }[]
      expect(items.every((i) => i.scope === 'gift')).toBe(true)
      expect(items).toHaveLength(2)
      expect(mockAssetDownloader.start).toHaveBeenCalled()

      // Quiet + no eviction.
      expect(assetStore.setPhase).not.toHaveBeenCalled()
      expect(mockAssetIndex.getStale).not.toHaveBeenCalled()
      expect(mockAssetIndex.getAllByPriority).not.toHaveBeenCalled()
    })

    it('an empty gift queue just returns', async () => {
      bootstrapStore.gifts = []
      const { startRoomAssetDownload } = useBootstrapAssets()
      await startRoomAssetDownload()

      expect(mockAssetDownloader.enqueue).not.toHaveBeenCalled()
      expect(mockAssetDownloader.start).not.toHaveBeenCalled()
    })
  })

  describe('evictAssets — catalog-diff pass', () => {
    beforeEach(() => {
      ;(globalThis as Record<string, unknown>).requestIdleCallback = (cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void) => {
        cb({ didTimeout: false, timeRemaining: () => 50 })
        return 1
      }
    })

    afterEach(() => {
      Reflect.deleteProperty(globalThis, 'requestIdleCallback')
    })

    it('with a populated catalog: deletes a badge-image entry, keeps a catalog gift entry, keeps a runtime entry', async () => {
      const mallStore = createMockMallStore({
        propIndex: { 1: { id: 1, type: 'frame', asset_url: 'https://assets.flyliveapp.com/frames/1.svga', thumbnail_url: '', name: 'Frame' } },
      })
      ;(globalThis as Record<string, unknown>).useMallStore = () => mallStore

      mockAssetIndex.getAllByPriority.mockResolvedValue([
        { url: 'https://example.com/badge_9.webp', scope: 'badge', assetType: 'image' },
        { url: 'https://cdn.example.com/gift1.webm', scope: 'gift', assetType: 'video' },
        { url: 'https://cdn.example.com/some-runtime.svga', scope: 'runtime', assetType: 'svga' },
      ])

      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload()

      await vi.waitFor(() => expect(mockAssetIndex.getAllByPriority).toHaveBeenCalled())
      await vi.waitFor(() => expect(mockCacheStorage.deleteAsset).toHaveBeenCalledWith('https://example.com/badge_9.webp'))
      expect(mockCacheStorage.deleteAsset).not.toHaveBeenCalledWith('https://cdn.example.com/gift1.webm')
      expect(mockCacheStorage.deleteAsset).not.toHaveBeenCalledWith('https://cdn.example.com/some-runtime.svga')
    })

    it('GATE: empty gifts skips the catalog-diff pass entirely (no deleteAsset from it)', async () => {
      bootstrapStore.gifts = []
      const mallStore = createMockMallStore({
        propIndex: { 1: { id: 1, type: 'frame', asset_url: 'https://assets.flyliveapp.com/frames/1.svga', thumbnail_url: '', name: 'Frame' } },
      })
      ;(globalThis as Record<string, unknown>).useMallStore = () => mallStore
      mockAssetIndex.getAllByPriority.mockResolvedValue([
        { url: 'https://example.com/badge_9.webp', scope: 'badge', assetType: 'image' },
      ])

      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload()

      // Give any scheduled idle callbacks a tick to run.
      await new Promise((r) => setTimeout(r, 0))
      expect(mockAssetIndex.getAllByPriority).not.toHaveBeenCalled()
    })

    it('GATE: empty propIndex skips the catalog-diff pass entirely (no deleteAsset from it)', async () => {
      const mallStore = createMockMallStore({ propIndex: {} })
      ;(globalThis as Record<string, unknown>).useMallStore = () => mallStore
      mockAssetIndex.getAllByPriority.mockResolvedValue([
        { url: 'https://example.com/badge_9.webp', scope: 'badge', assetType: 'image' },
      ])

      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload()

      await new Promise((r) => setTimeout(r, 0))
      expect(mockAssetIndex.getAllByPriority).not.toHaveBeenCalled()
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
        { priority: 'critical', assetType: 'video', scope: 'gift', giftId: undefined, badgeId: undefined },
      )
    })

    it('should NOT re-download normal-priority assets', async () => {
      const { invalidateAsset } = useBootstrapAssets()

      await invalidateAsset({ url: 'https://cdn.example.com/normal.webm', priority: 'normal' })

      expect(mockAssetDownloader.enqueueManual).not.toHaveBeenCalled()
    })

    it('should NOT re-download a critical badge (badges are pictures)', async () => {
      const { invalidateAsset } = useBootstrapAssets()

      await invalidateAsset({ url: 'https://example.com/badge_9.webp', priority: 'critical', badgeId: 9 })

      expect(mockCacheStorage.deleteAsset).toHaveBeenCalledWith('https://example.com/badge_9.webp')
      expect(mockAssetIndex.remove).toHaveBeenCalledWith('https://example.com/badge_9.webp')
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

  describe('buildAssetQueue — prop assets from propIndex', () => {
    const R2 = 'https://assets.flyliveapp.com'
    const IK = 'https://ik.imagekit.io/flylive'

    function getPropItems(calls: unknown[][]): { url: string; priority: string; scope: string; assetType: string; groupKey?: string }[] {
      const enqueuedItems = (calls[0]?.[0] ?? []) as { url: string; priority: string; scope: string; assetType: string; groupKey?: string }[]
      return enqueuedItems.filter(i => i.groupKey === 'bootstrap-props')
    }

    async function runAndAssertOnlyR2Frame2(mallStore: ReturnType<typeof createMockMallStore>): Promise<void> {
      ;(globalThis as Record<string, unknown>).useMallStore = () => mallStore
      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload()
      const propItems = getPropItems(mockAssetDownloader.enqueue.mock.calls)
      expect(propItems).toHaveLength(1)
      expect(propItems[0]!.url).toContain('frames/2.svga')
    }

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('enqueues R2 props with correct priority by type', async () => {
      const mallStore = createMockMallStore({
        propIndex: {
          1: { id: 1, type: 'frame', asset_url: `${R2}/frames/1.svga`, thumbnail_url: '', name: 'Frame' },
          2: { id: 2, type: 'entry_animation', asset_url: `${R2}/anim/1.svga`, thumbnail_url: '', name: 'Anim' },
          3: { id: 3, type: 'chat_bubble', asset_url: `${R2}/bubble/1.svga`, thumbnail_url: '', name: 'Bubble' },
          4: { id: 4, type: 'mice_wave', asset_url: `${R2}/wave/1.svga`, thumbnail_url: '', name: 'Wave' },
          5: { id: 5, type: 'data_card', asset_url: `${R2}/card/1.svga`, thumbnail_url: '', name: 'DataCard' },
          6: { id: 6, type: 'slides', asset_url: `${R2}/slides/1.mp4`, thumbnail_url: '', name: 'Slides' },
        },
      })
      ;(globalThis as Record<string, unknown>).useMallStore = () => mallStore

      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload()

      const propItems = getPropItems(mockAssetDownloader.enqueue.mock.calls)
      expect(propItems).toHaveLength(6)
      expect(propItems.find(i => i.url.includes('frames/'))?.priority).toBe('critical')
      expect(propItems.find(i => i.url.includes('anim/'))?.priority).toBe('critical')
      expect(propItems.find(i => i.url.includes('bubble/'))?.priority).toBe('high')
      expect(propItems.find(i => i.url.includes('wave/'))?.priority).toBe('high')
      expect(propItems.find(i => i.url.includes('card/'))?.priority).toBe('normal')
      expect(propItems.find(i => i.url.includes('slides/'))?.priority).toBe('normal')
    })

    it('detects svga vs video asset type from URL extension', async () => {
      const mallStore = createMockMallStore({
        propIndex: {
          1: { id: 1, type: 'frame', asset_url: `${R2}/frames/1.svga`, thumbnail_url: '', name: 'SVGA Frame' },
          2: { id: 2, type: 'slides', asset_url: `${R2}/slides/1.mp4`, thumbnail_url: '', name: 'MP4 Slides' },
        },
      })
      ;(globalThis as Record<string, unknown>).useMallStore = () => mallStore

      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload()

      const propItems = getPropItems(mockAssetDownloader.enqueue.mock.calls)
      expect(propItems.find(i => i.url.includes('.svga'))?.assetType).toBe('svga')
      expect(propItems.find(i => i.url.includes('.mp4'))?.assetType).toBe('video')
    })

    it('excludes ImageKit-hosted prop asset_urls', async () => {
      const mallStore = createMockMallStore({
        propIndex: {
          1: { id: 1, type: 'frame', asset_url: `${IK}/frames/1.webp`, thumbnail_url: '', name: 'IK Frame' },
          2: { id: 2, type: 'frame', asset_url: `${R2}/frames/2.svga`, thumbnail_url: '', name: 'R2 Frame' },
        },
      })
      await runAndAssertOnlyR2Frame2(mallStore)
    })

    it('excludes prop asset_urls from third-party CDNs (not IK, not R2)', async () => {
      const mallStore = createMockMallStore({
        propIndex: {
          1: { id: 1, type: 'frame', asset_url: 'https://other-cdn.example.com/frames/1.svga', thumbnail_url: '', name: 'Other CDN' },
          2: { id: 2, type: 'frame', asset_url: `${R2}/frames/2.svga`, thumbnail_url: '', name: 'R2 Frame' },
        },
      })
      await runAndAssertOnlyR2Frame2(mallStore)
    })

    it('skips props with empty or null asset_url', async () => {
      const mallStore = createMockMallStore({
        propIndex: {
          1: { id: 1, type: 'frame', asset_url: '', thumbnail_url: '', name: 'Empty URL' },
          2: { id: 2, type: 'frame', asset_url: null as unknown as string, thumbnail_url: '', name: 'Null URL' },
          3: { id: 3, type: 'frame', asset_url: `${R2}/frames/3.svga`, thumbnail_url: '', name: 'Valid' },
        },
      })
      ;(globalThis as Record<string, unknown>).useMallStore = () => mallStore

      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload()

      const propItems = getPropItems(mockAssetDownloader.enqueue.mock.calls)
      expect(propItems).toHaveLength(1)
    })

    it('uses normal priority as fallback for unknown prop types', async () => {
      const mallStore = createMockMallStore({
        propIndex: {
          1: { id: 1, type: 'signature', asset_url: `${R2}/sig/1.svga`, thumbnail_url: '', name: 'Signature' },
        },
      })
      ;(globalThis as Record<string, unknown>).useMallStore = () => mallStore

      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload()

      const propItems = getPropItems(mockAssetDownloader.enqueue.mock.calls)
      expect(propItems[0]?.priority).toBe('normal')
    })
  })

  describe('buildAssetQueue — bundled static UI pictures', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('never queues a bundled picture (they load from disk; a Cache Storage copy is never read)', async () => {
      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload()

      const enqueuedItems = mockAssetDownloader.enqueue.mock.calls[0]![0] as { url: string }[]
      expect(enqueuedItems.length).toBeGreaterThan(0)
      for (const item of enqueuedItems) {
        expect(item.url).toMatch(/^https:\/\//)
      }
      for (const name of ['seat-default.webp', 'seat-locked.webp', 'coin-icon.webp', 'avatar-placeholder.webp']) {
        expect(enqueuedItems.some(i => i.url.includes(name))).toBe(false)
      }
    })
  })

  describe('buildAssetQueue — VIP animated assets', () => {
    const R2 = 'https://assets.flyliveapp.com'

    function getVipItems(calls: unknown[][]): { url: string; priority: string; scope: string }[] {
      const enqueuedItems = (calls[0]?.[0] ?? []) as { url: string; priority: string; scope: string }[]
      return enqueuedItems.filter(i => i.scope === 'vip')
    }

    beforeEach(() => {
      vi.clearAllMocks()
      bootstrapStore.vipLevels = [
        { id: 3, level: 3, color: '#000000', card_animated_url: `${R2}/vip/3/card.mp4`, emblem_animated_url: `${R2}/vip/3/emblem.svga` },
        { id: 5, level: 5, color: '#000000', card_animated_url: `${R2}/vip/5/card.mp4`, emblem_animated_url: `${R2}/vip/5/emblem.svga` },
      ]
      ;(globalThis as Record<string, unknown>).useAuthStore = () => ({ user: { vip_level: 3 } })
    })

    it("enqueues the user's own VIP level animated assets as critical", async () => {
      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload()

      const vipItems = getVipItems(mockAssetDownloader.enqueue.mock.calls)
      const ownLevelItems = vipItems.filter(i => i.url.includes('/vip/3/'))
      expect(ownLevelItems).toHaveLength(2)
      expect(ownLevelItems.every(i => i.priority === 'critical')).toBe(true)
    })

    it('enqueues other VIP level animated assets as high', async () => {
      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload()

      const vipItems = getVipItems(mockAssetDownloader.enqueue.mock.calls)
      const otherLevelItems = vipItems.filter(i => i.url.includes('/vip/5/'))
      expect(otherLevelItems).toHaveLength(2)
      expect(otherLevelItems.every(i => i.priority === 'high')).toBe(true)
    })

    it('skips VIP animated assets with null URLs', async () => {
      bootstrapStore.vipLevels = [
        { id: 2, level: 2, color: '#000000', card_animated_url: null, emblem_animated_url: `${R2}/vip/2/emblem.svga` },
      ]
      ;(globalThis as Record<string, unknown>).useAuthStore = () => ({ user: { vip_level: 2 } })

      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload()

      const vipItems = getVipItems(mockAssetDownloader.enqueue.mock.calls)
      expect(vipItems).toHaveLength(1)
      expect(vipItems[0]!.url).toContain('/vip/2/emblem.svga')
    })
  })
})
