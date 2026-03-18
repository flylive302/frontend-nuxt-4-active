// ========================================
// Bootstrap Store
// ========================================

import { defineStore } from 'pinia'
import type {
  BootstrapResponse,
  BootstrapConfig,
  LevelBadge,
} from '~/types/user/bootstrap'
import type { Gift } from '~/types/gift/gift'
import type { DownloadProgress, EnqueueItem, EnqueueOptions } from '~/types/asset/asset'
import { CACHE_TTL, isStale } from '~/constants/cache'
import { ASSET_CONFIG } from '~/constants/asset'
import * as assetDownloader from '~/services/assetDownloader'
import * as cacheStorage from '~/services/cacheStorage'
import * as assetIndex from '~/services/assetIndex'
import { createLogger } from '~/utils/logger'
import { resolveVideoUrl } from '~/utils/platform'

const log = createLogger('[BootstrapStore]')

// ========================================
// Types
// ========================================

export type LevelCategory = 'wealth' | 'charm'

export interface LevelInfo {
  level: number
  name: string
  badge: { id: number; name: string; image_url: string } | null
}

// ========================================
// Constants
// ========================================

export const DEFAULT_WEALTH_BADGE = 'https://assets.flyliveapp.com/badges/wealth/level_0.webp'
export const DEFAULT_CHARM_BADGE = 'https://assets.flyliveapp.com/badges/charm/level_0.webp'

// ========================================
// Store Definition
// ========================================

export const useBootstrapStore = defineStore('bootstrap', () => {
  const { api, normalizeError } = useApi()

  // ========================================
  // State
  // ========================================

  /** Bootstrap phase */
  const phase = ref<'idle' | 'loading' | 'complete' | 'error'>('idle')

  /** Error message if bootstrap failed */
  const error = ref<string | null>(null)

  /** Level and economy configuration */
  const config = ref<BootstrapConfig | null>(null)

  /** Gift catalog (accumulates as user scrolls) */
  const giftCatalog = ref<Gift[]>([])

  /** Total gift count from server */
  const giftTotal = ref<number>(0)

  /** Level badges for XP-to-badge lookup */
  const levelBadges = ref<LevelBadge[]>([])

  /** Last bootstrap timestamp */
  const lastBootstrapAt = ref<number | null>(null)

  /** Asset download phase */
  const assetPhase = ref<'idle' | 'downloading' | 'complete' | 'error'>('idle')

  /** Asset download progress */
  const assetProgress = ref<DownloadProgress | null>(null)

  /** Asset download error */
  const assetError = ref<string | null>(null)

  // ========================================
  // Getters
  // ========================================

  const isReady = computed(() => phase.value === 'complete')
  const isLoading = computed(() => phase.value === 'loading')
  const hasError = computed(() => phase.value === 'error')

  /**
   * Check if config needs refresh based on TTL.
   */
  const needsRefresh = computed(() =>
    isStale(lastBootstrapAt.value, CACHE_TTL.LEVEL_CONFIG)
  )

  /**
   * Get badge by ID for quick lookup.
   */
  const badgeMap = computed(() => {
    const map = new Map<number, LevelBadge>()
    for (const badge of levelBadges.value) {
      map.set(badge.id, badge)
    }
    return map
  })

  /**
   * Pre-sorted wealth level configs (ascending by required_xp).
   * Cached as computed — only re-sorts when config changes.
   */
  const sortedWealthLevels = computed(() =>
    config.value ? [...config.value.wealth_levels].sort((a, b) => a.required_xp - b.required_xp) : []
  )

  /**
   * Pre-sorted charm level configs (ascending by required_xp).
   */
  const sortedCharmLevels = computed(() =>
    config.value ? [...config.value.charm_levels].sort((a, b) => a.required_xp - b.required_xp) : []
  )

  /**
   * Persistent set of gift IDs for O(1) deduplication.
   */
  const giftIdSet = computed(() => new Set(giftCatalog.value.map(g => g.id)))

  // ========================================
  // Actions
  // ========================================

  /**
   * Fetch bootstrap data from API in two phases:
   * 1. Critical: user + config (fast, unblocks UI)
   * 2. Deferred: gifts + user_data (background, non-blocking)
   *
   * Uses LT-4 partial bootstrap endpoint (?fields=).
   */
  async function fetchBootstrap(): Promise<BootstrapResponse | null> {
    if (phase.value === 'loading') {
      log.warn('Bootstrap already in progress')
      return null
    }

    const { trackBootstrapStarted, trackBootstrapCompleted, trackBootstrapFailed } = useTelemetry()
    const startTime = Date.now()
    trackBootstrapStarted()

    phase.value = 'loading'
    error.value = null

    try {
      // Phase 1: Critical path — user identity + config (fast)
      const criticalResponse = await api<{ status: string; message: string; data: Partial<BootstrapResponse> }>(
        '/bootstrap?fields=user,config'
      )
      const criticalData = criticalResponse.data

      // Apply critical data immediately
      if (criticalData.config) {
        config.value = criticalData.config
        levelBadges.value = criticalData.config.level_badges
      }

      // Mark phase complete — UI can render with user + config
      lastBootstrapAt.value = Date.now()
      phase.value = 'complete'

      // Phase 2: Deferred — gifts + user_data (background, non-blocking)
      fetchDeferredData().catch((e) => {
        log.warn('Deferred bootstrap data failed (non-critical):', e)
      })

      trackBootstrapCompleted(Date.now() - startTime)

      // Return a merged response for callers that need the full shape
      return criticalData as BootstrapResponse
    } catch (e) {
      // Log raw error for debugging
      log.error('Bootstrap raw error:', e)
      const normalized = normalizeError(e)
      error.value = normalized.message
      phase.value = 'error'
      log.error('Bootstrap failed:', normalized.message, normalized)
      trackBootstrapFailed(normalized.message)
      return null
    }
  }

  /**
   * Fetch deferred bootstrap sections (gifts + user_data) in the background.
   * Failures here are non-critical — the app remains usable.
   */
  async function fetchDeferredData(): Promise<void> {
    try {
      const deferredResponse = await api<{ status: string; message: string; data: Partial<BootstrapResponse> }>(
        '/bootstrap?fields=gifts,user_data'
      )
      const data = deferredResponse.data

      if (data.gifts) {
        giftCatalog.value = data.gifts.catalog
        giftTotal.value = data.gifts.total
      }

      log.info('Deferred bootstrap data loaded')
    } catch (e) {
      log.warn('Failed to load deferred bootstrap data:', e)
    }
  }

  /**
   * Append gifts to catalog (for pagination).
   */
  function appendGifts(gifts: Gift[]) {
    const currentIds = giftIdSet.value
    const newGifts = gifts.filter(g => !currentIds.has(g.id))
    giftCatalog.value.push(...newGifts)
  }

  /**
   * Get badge by ID.
   */
  function getBadgeById(id: number): LevelBadge | null {
    return badgeMap.value.get(id) ?? null
  }

  /**
   * Invalidate config (force refresh on next boot).
   */
  function invalidateConfig(type: 'levels' | 'badges' | 'gifts' | 'all') {
    if (type === 'all' || type === 'levels') {
      // Will trigger refresh on next needsRefresh check
      lastBootstrapAt.value = null
    }
    if (type === 'all' || type === 'gifts') {
      giftCatalog.value = []
    }

  }

  /**
   * Reset store state.
   */
  function reset() {
    phase.value = 'idle'
    error.value = null
    config.value = null
    giftCatalog.value = []
    giftTotal.value = 0
    levelBadges.value = []
    lastBootstrapAt.value = null
    assetPhase.value = 'idle'
    assetProgress.value = null
    assetError.value = null
  }

  // ========================================
  // Asset Download
  // ========================================

  /**
   * Start downloading gift assets after bootstrap.
   */
  async function startAssetDownload(): Promise<void> {
    if (assetPhase.value === 'downloading') {
      log.warn('Asset download already in progress')
      return
    }

    // Initialize services
    await cacheStorage.initCacheStorage()
    await assetIndex.initAssetIndex()

    // Debug: Log catalog state before filtering


    // Build queue from gift catalog
    const items: EnqueueItem[] = giftCatalog.value
      .filter((gift) => gift.animation_url && gift.asset_type !== 'image')
      .map((gift, index) => ({
        url: resolveVideoUrl(gift.animation_url!),
        assetType: gift.asset_type === 'svga' ? 'svga' : 'video',
        priority: index < ASSET_CONFIG.CRITICAL_COUNT ? 'critical' : 'normal',
        giftId: gift.id,
        sortOrder: gift.sort_order,
      }))

    // Debug: Log filtered items count


    if (items.length === 0) {

      assetPhase.value = 'complete'
      return
    }

    // Subscribe to progress
    assetDownloader.onProgress((progress) => {
      assetProgress.value = progress
    })

    assetDownloader.onComplete(() => {
      assetPhase.value = 'complete'

    })

    // Enqueue and start
    assetPhase.value = 'downloading'
    assetDownloader.enqueue(items)
    assetDownloader.start()


  }

  /**
   * Manually enqueue an asset for download.
   */
  function enqueueAsset(url: string, options: EnqueueOptions): void {
    assetDownloader.enqueueManual(url, options)
  }

  // ========================================
  // Level/Badge Utilities
  // ========================================

  /**
   * Get level info from XP value.
   * O(n) search but levels array is small (~50 items max).
   */
  function getLevelFromXp(
    xp: string | number | null | undefined,
    category: LevelCategory
  ): LevelInfo {
    if (!config.value) return { level: 0, name: 'Unknown', badge: null }

    const xpNum = typeof xp === 'string' ? parseFloat(xp) : (xp ?? 0)
    const sorted = category === 'wealth' ? sortedWealthLevels.value : sortedCharmLevels.value

    // Find highest matching level via reverse scan (early exit)
    let matched: (typeof sorted)[number] | undefined
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (xpNum >= sorted[i]!.required_xp) {
        matched = sorted[i]
        break
      }
    }

    if (!matched) return { level: 0, name: 'Beginner', badge: null }

    const badge = matched.badge_id ? badgeMap.value.get(matched.badge_id) : null
    return {
      level: matched.level,
      name: matched.name,
      badge: badge?.image_url
        ? { id: badge.id, name: badge.name, image_url: badge.image_url }
        : null,
    }
  }

  /**
   * Get badge image URL from XP value.
   */
  function getBadgeFromXp(
    xp: string | number | null | undefined,
    category: LevelCategory,
    fallback?: string
  ): string {
    const defaultFallback = category === 'wealth' ? DEFAULT_WEALTH_BADGE : DEFAULT_CHARM_BADGE
    return getLevelFromXp(xp, category).badge?.image_url ?? fallback ?? defaultFallback
  }

  // ========================================
  // Asset Download Helpers
  // ========================================

  /** Count of cached/completed assets */
  const cachedAssetCount = computed(() => assetProgress.value?.completed ?? 0)

  /** Count of total assets to download */
  const totalAssetCount = computed(() => assetProgress.value?.total ?? 0)

  /** Download percentage (0-100) */
  const downloadPercent = computed(() => {
    if (!assetProgress.value || assetProgress.value.total === 0) return 0
    return Math.round((assetProgress.value.completed / assetProgress.value.total) * 100)
  })

  /** Check if download is in progress */
  const isDownloading = computed(() => assetPhase.value === 'downloading')

  /** Check if all assets are downloaded */
  const isDownloadComplete = computed(() => assetPhase.value === 'complete')

  // ========================================
  // Return
  // ========================================

  return {
    // State
    phase,
    error,
    config,
    giftCatalog,
    giftTotal,
    levelBadges,
    lastBootstrapAt,

    // Getters
    isReady,
    isLoading,
    hasError,
    needsRefresh,
    badgeMap,

    // Actions
    fetchBootstrap,
    appendGifts,
    getBadgeById,
    invalidateConfig,
    reset,

    // Level Utilities
    getLevelFromXp,
    getBadgeFromXp,

    // Asset Download
    assetPhase,
    assetProgress,
    assetError,
    startAssetDownload,
    enqueueAsset,

    // Asset Download Helpers
    cachedAssetCount,
    totalAssetCount,
    downloadPercent,
    isDownloading,
    isDownloadComplete,
  }
}, {
  persist: {
    pick: ['config', 'levelBadges', 'lastBootstrapAt'],
  },
})
