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
  getCriticalQueuedCount: vi.fn().mockReturnValue(0),
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
      badges: [],
    })
    assetStore = createMockAssetStore()
    // Non-home, non-scoped route so getRouteScope()→null and gift videos aren't skipped
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

    it('EXECUTE: still downloads app-shell assets when there are no gifts', async () => {
      // The manual (app-shell) manifest keeps the queue non-empty even with no
      // gifts, so the pipeline downloads rather than short-circuiting to complete.
      bootstrapStore.gifts = []
      const { startAssetDownload } = useBootstrapAssets()

      await startAssetDownload()

      expect(mockAssetDownloader.enqueue).toHaveBeenCalledTimes(1)
      expect(assetStore.setPhase).toHaveBeenCalledWith('downloading')
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

    it('REACT: does not schedule stale eviction in giftBootstrapVideosOnly mode', async () => {
      ;(globalThis as Record<string, unknown>).requestIdleCallback = vi.fn()

      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload({ giftBootstrapVideosOnly: true })

      expect(mockAssetIndex.getStale).not.toHaveBeenCalled()
      expect(globalThis.requestIdleCallback).not.toHaveBeenCalled()

      Reflect.deleteProperty(globalThis, 'requestIdleCallback')
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

    function getPropItems(calls: unknown[][]): { url: string; priority: string; scope: string; assetType: string }[] {
      const enqueuedItems = (calls[0]?.[0] ?? []) as { url: string; priority: string; scope: string; assetType: string }[]
      return enqueuedItems.filter(i => i.scope === 'mall')
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

    it('does not enqueue props in giftBootstrapVideosOnly mode', async () => {
      const mallStore = createMockMallStore({
        propIndex: {
          1: { id: 1, type: 'frame', asset_url: `${R2}/frames/1.svga`, thumbnail_url: '', name: 'Frame' },
        },
      })
      ;(globalThis as Record<string, unknown>).useMallStore = () => mallStore

      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload({ giftBootstrapVideosOnly: true })

      const propItems = getPropItems(mockAssetDownloader.enqueue.mock.calls)
      expect(propItems).toHaveLength(0)
    })
  })

  describe('buildAssetQueue — featured room backgrounds', () => {
    function getFeaturedRoomItems(calls: unknown[][]): { url: string; priority: string; scope: string; groupKey: string }[] {
      const enqueuedItems = (calls[0]?.[0] ?? []) as { url: string; priority: string; scope: string; groupKey: string }[]
      return enqueuedItems.filter(i => i.groupKey === 'featured-rooms')
    }

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('enqueues non-null backgrounds as low priority with global scope', async () => {
      bootstrapStore.featuredRooms = [
        { id: 1, background: 'https://cdn.example.com/room1-bg.webp' },
        { id: 2, background: 'https://cdn.example.com/room2-bg.webp' },
      ]

      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload()

      const items = getFeaturedRoomItems(mockAssetDownloader.enqueue.mock.calls)
      expect(items).toHaveLength(2)
      expect(items.every(i => i.priority === 'low')).toBe(true)
      expect(items.every(i => i.scope === 'global')).toBe(true)
    })

    it('excludes rooms with null backgrounds', async () => {
      bootstrapStore.featuredRooms = [
        { id: 1, background: 'https://cdn.example.com/room1-bg.webp' },
        { id: 2, background: null },
        { id: 3, background: null },
      ]

      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload()

      const items = getFeaturedRoomItems(mockAssetDownloader.enqueue.mock.calls)
      expect(items).toHaveLength(1)
      expect(items[0]!.url).toBe('https://cdn.example.com/room1-bg.webp')
    })

    it('enqueues nothing when all backgrounds are null', async () => {
      bootstrapStore.featuredRooms = [
        { id: 1, background: null },
        { id: 2, background: null },
      ]

      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload()

      const items = getFeaturedRoomItems(mockAssetDownloader.enqueue.mock.calls)
      expect(items).toHaveLength(0)
    })

    it('enqueues nothing when featuredRooms is empty', async () => {
      bootstrapStore.featuredRooms = []

      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload()

      const items = getFeaturedRoomItems(mockAssetDownloader.enqueue.mock.calls)
      expect(items).toHaveLength(0)
    })

    it('does not enqueue featured rooms in giftBootstrapVideosOnly mode', async () => {
      bootstrapStore.featuredRooms = [
        { id: 1, background: 'https://cdn.example.com/room1-bg.webp' },
      ]

      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload({ giftBootstrapVideosOnly: true })

      const items = getFeaturedRoomItems(mockAssetDownloader.enqueue.mock.calls)
      expect(items).toHaveLength(0)
    })
  })

  describe('buildAssetQueue — critical manual assets', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('includes DEFAULT_SEAT_IMG, LOCK_SEAT_IMG, and COIN_ICON with priority critical', async () => {
      const { startAssetDownload } = useBootstrapAssets()
      await startAssetDownload()

      const enqueuedItems = mockAssetDownloader.enqueue.mock.calls[0]![0] as { url: string; priority: string }[]

      const seatItem = enqueuedItems.find(i => i.url.includes('seat.webp') && !i.url.includes('locked'))
      expect(seatItem).toBeDefined()
      expect(seatItem?.priority).toBe('critical')

      const lockItem = enqueuedItems.find(i => i.url.includes('seat-locked.webp'))
      expect(lockItem).toBeDefined()
      expect(lockItem?.priority).toBe('critical')

      const coinItem = enqueuedItems.find(i => i.url.includes('coin-icon.webp'))
      expect(coinItem).toBeDefined()
      expect(coinItem?.priority).toBe('critical')
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
        { id: 3, level: 3, card_animated_url: `${R2}/vip/3/card.mp4`, emblem_animated_url: `${R2}/vip/3/emblem.svga` },
        { id: 5, level: 5, card_animated_url: `${R2}/vip/5/card.mp4`, emblem_animated_url: `${R2}/vip/5/emblem.svga` },
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
        { id: 2, level: 2, card_animated_url: null, emblem_animated_url: `${R2}/vip/2/emblem.svga` },
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
