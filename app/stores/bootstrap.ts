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

export const DEFAULT_WEALTH_BADGE = 'https://ik.imagekit.io/flylive/badges/wealth/level_0.webp'
export const DEFAULT_CHARM_BADGE = 'https://ik.imagekit.io/flylive/badges/charm/level_0.webp'

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

  /** Cellular consent for non-critical asset downloads (persisted) */
  const cellularConsentGiven = ref(false)

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

  // ========================================
  // Actions
  // ========================================

  /**
   * Fetch bootstrap data from API.
   * Seeds auth, levels, and other stores.
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
      // Laravel wraps response in { status, message, data: BootstrapResponse }
      const response = await api<{ status: string; message: string; data: BootstrapResponse }>('/bootstrap')
      const data = response.data

      // Store config
      config.value = data.config
      levelBadges.value = data.config.level_badges

      // Store gifts (initial batch)
      giftCatalog.value = data.gifts.catalog
      giftTotal.value = data.gifts.total

      // Mark complete
      lastBootstrapAt.value = Date.now()
      phase.value = 'complete'

      log.debug('Bootstrap complete', {
        gifts: data.gifts.catalog.length,
        wealthLevels: data.config.wealth_levels.length,
      })

      trackBootstrapCompleted(Date.now() - startTime)
      return data
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
   * Append gifts to catalog (for pagination).
   */
  function appendGifts(gifts: Gift[]) {
    const existingIds = new Set(giftCatalog.value.map(g => g.id))
    const newGifts = gifts.filter(g => !existingIds.has(g.id))
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
    log.debug('Config invalidated:', type)
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
    log.debug('Gift catalog state:', {
      totalGifts: giftCatalog.value.length,
      sampleGift: giftCatalog.value[0] ? {
        id: giftCatalog.value[0].id,
        name: giftCatalog.value[0].name,
        asset_type: giftCatalog.value[0].asset_type,
        animation_url: giftCatalog.value[0].animation_url,
      } : 'NO GIFTS',
    })

    // Build queue from gift catalog
    const items: EnqueueItem[] = giftCatalog.value
      .filter((gift) => gift.animation_url && gift.asset_type !== 'image')
      .map((gift, index) => ({
        url: gift.animation_url!,
        assetType: gift.asset_type === 'svga' ? 'svga' : 'video',
        priority: index < ASSET_CONFIG.CRITICAL_COUNT ? 'critical' : 'normal',
        giftId: gift.id,
        sortOrder: gift.sort_order,
      }))

    // Debug: Log filtered items count
    log.debug('Filtered assets:', {
      totalFiltered: items.length,
      allWithAnimationUrl: giftCatalog.value.filter(g => g.animation_url).length,
      nonImageAssets: giftCatalog.value.filter(g => g.asset_type !== 'image').length,
    })

    if (items.length === 0) {
      log.debug('No assets to download')
      assetPhase.value = 'complete'
      return
    }

    // Set cellular consent from persisted state
    assetDownloader.setCellularConsent(cellularConsentGiven.value)

    // Subscribe to progress
    assetDownloader.onProgress((progress) => {
      assetProgress.value = progress
    })

    assetDownloader.onComplete(() => {
      assetPhase.value = 'complete'
      log.debug('Asset download complete')
    })

    // Enqueue and start
    assetPhase.value = 'downloading'
    assetDownloader.enqueue(items)
    assetDownloader.start()

    log.debug('Started asset download:', items.length, 'items')
  }

  /**
   * Manually enqueue an asset for download.
   */
  function enqueueAsset(url: string, options: EnqueueOptions): void {
    assetDownloader.enqueueManual(url, options)
  }

  /**
   * Set cellular consent for non-critical asset downloads.
   */
  function setCellularConsent(granted: boolean): void {
    cellularConsentGiven.value = granted
    assetDownloader.setCellularConsent(granted)
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
    const levels = category === 'wealth'
      ? config.value.wealth_levels
      : config.value.charm_levels

    // Sort ascending and find highest matching level
    const sorted = [...levels].sort((a, b) => a.required_xp - b.required_xp)
    const matched = sorted.filter(l => xpNum >= l.required_xp).pop()

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
    cellularConsentGiven,

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
    setCellularConsent,

    // Asset Download Helpers
    cachedAssetCount,
    totalAssetCount,
    downloadPercent,
    isDownloading,
    isDownloadComplete,
  }
}, {
  persist: {
    pick: ['config', 'giftCatalog', 'giftTotal', 'levelBadges', 'lastBootstrapAt', 'cellularConsentGiven'],
  },
})
