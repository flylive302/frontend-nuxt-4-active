// ========================================
// Bootstrap Store
// ========================================
// Stores = ref + computed + setters ONLY (no API, no toast, no cross-store calls)

import { defineStore } from 'pinia'
import type {
  BootstrapConfig,
  LevelConfig,
  VipLevel,
} from '~/types/user/bootstrap'
import type { Gift } from '~/types/gift/gift'
import type { Badge } from "~/types/progression/badge";
import { BOOTSTRAP_SHAPE_VERSION } from '~/constants/bootstrap'

// ========================================
// Store Definition
// ========================================

export const useBootstrapStore = defineStore('bootstrap', () => {
  // ========================================
  // State
  // ========================================

  /** Bootstrap phase */
  const phase = ref<'idle' | 'loading' | 'complete' | 'error'>('idle')

  /** Error message if bootstrap failed */
  const error = ref<string | null>(null)

  const apiVersion = ref<string | null>('v1');
  const roomOwnerPercentage = ref<number | null>(3);
  const receiverPercentage = ref<number | null>(30);
  const wealthLevels = ref<LevelConfig[] | null>([]);
  const charmLevels = ref<LevelConfig[] | null>([]);
  const roomLevels = ref<LevelConfig[] | null>([]);
  const badges = ref<Badge[] | null>([]);
  const gifts = ref<Gift[] | null>([]);
  const vapid_public_key = ref<string | null>()
  const vipLevels = ref<VipLevel[]>([])
  // JoyPlay games kill switch. `null` = the server has never told us (fresh
  // install, or a discarded catalog). Consumers treat only `true` as enabled,
  // so the button never renders before the server has said it may.
  const gamesEnabled = ref<boolean | null>(null);

  /**
   * Validator from the last 200 of `/bootstrap`, verbatim (the edge serves the
   * weak `W/` form; the server weak-compares) — sent back as `If-None-Match`.
   */
  const etag = ref<string | null>(null)

  /** `BOOTSTRAP_SHAPE_VERSION` of the client that wrote the persisted catalog. */
  const shapeVersion = ref<number | null>(null)

  /** Gift catalog (accumulates as user scrolls) */
  const giftCatalog = ref<Gift[]>([])

  /** Total gift count from the server */
  const giftTotal = ref<number>(0)

  // ========================================
  // Getters
  // ========================================

  /**
   * Whether bootstrap has completed and config is available.
   */
  const isReady = computed(() => phase.value === 'complete')

  /**
   * Whether the persisted catalog can render this open before any request:
   * written by a client of the current shape, with levels present. Anything
   * else (fresh install, pre-shape-version state, a bumped version) takes the
   * cold path.
   */
  const hasUsableCache = computed(() =>
    shapeVersion.value === BOOTSTRAP_SHAPE_VERSION
    && Boolean(wealthLevels.value?.length || charmLevels.value?.length)
  )

  /**
   * Badge map for O(1) lookup by ID.
   */
  const badgeMap = computed(() => {
    const map = new Map<number, Badge>()
    if (badges.value) {
      for (const badge of badges.value) {
        map.set(badge.id, badge)
      }
    }
    return map
  })

  /**
   * Wealth levels sorted by level (ascending). Cached by Vue reactivity.
   */
  const sortedWealthLevels = computed(() =>
    [...(wealthLevels.value ?? [])].sort((a, b) => a.level - b.level)
  )

  /**
   * Charm levels sorted by level (ascending). Cached by Vue reactivity.
   */
  const sortedCharmLevels = computed(() =>
    [...(charmLevels.value ?? [])].sort((a, b) => a.level - b.level)
  )

  /**
   * Room levels sorted by level (ascending). Cached by Vue reactivity.
   */
  const sortedRoomLevels = computed(() =>
    [...(roomLevels.value ?? [])].sort((a, b) => a.level - b.level)
  )

  /**
   * VIP levels sorted by level ascending.
   */
  const sortedVipLevels = computed(() =>
    [...vipLevels.value].sort((a, b) => a.level - b.level)
  )

  /**
   * VIP level → name colour (hex). Built once per bootstrap payload; O(1)
   * lookups for every rendered name. Source of truth is the backend
   * `vip_levels.color` column — never hardcode colours on the frontend.
   */
  const vipColorByLevel = computed(() => {
    const map = new Map<number, string>()
    for (const l of vipLevels.value) {
      if (l.color) map.set(l.level, l.color)
    }
    return map
  })

  /**
   * Persistent set of gift IDs for O(1) deduplication.
   */
  const giftIdSet = computed(() => new Set(giftCatalog.value.map(g => g.id)))

  // ========================================
  // Setters
  // ========================================

  /**
   * Set the bootstrap phase.
   */
  function setPhase(newPhase: typeof phase.value): void {
    phase.value = newPhase
  }

  /**
   * Mark the store ready from the persisted catalog. `phase` is deliberately
   * not persisted, so every open that renders from cache must flip it
   * explicitly or every `isReady` consumer (level/badge lookups) stays dark —
   * the "LV 1 everywhere" trap.
   */
  function markReadyFromCache(): void {
    if (phase.value !== 'idle') return
    if (!hasUsableCache.value) return
    phase.value = 'complete'
  }

  /**
   * Set the error message.
   */
  function setError(message: string | null): void {
    error.value = message
  }

  /**
   * Set config and level badges from bootstrap response.
   */
  function setConfig(newConfig: BootstrapConfig): void {
    apiVersion.value = newConfig.api_version
    roomOwnerPercentage.value = newConfig.room_owner_percentage
    receiverPercentage.value = newConfig.receiver_percentage
    wealthLevels.value = newConfig.wealth_levels
    charmLevels.value = newConfig.charm_levels
    roomLevels.value = newConfig.room_levels
    badges.value = newConfig.badges
    gifts.value = newConfig.gifts
    vapid_public_key.value = newConfig.vapid_public_key
    vipLevels.value = newConfig.vip_levels ?? []
    gamesEnabled.value = newConfig.games_enabled ?? false
    shapeVersion.value = BOOTSTRAP_SHAPE_VERSION
  }

  /**
   * Set the validator that came with the payload just stored (null when the
   * response carried none).
   */
  function setEtag(tag: string | null): void {
    etag.value = tag
  }

  /**
   * Set gift catalog and total from bootstrap response.
   */
  function setGifts(catalog: Gift[], total: number): void {
    giftCatalog.value = catalog
    giftTotal.value = total
  }

  /**
   * Append gifts to catalog (for pagination).
   */
  function appendGifts(gifts: Gift[]): void {
    const currentIds = giftIdSet.value
    const newGifts = gifts.filter(g => !currentIds.has(g.id))
    giftCatalog.value.push(...newGifts)
  }

  /**
   * Get badge by ID.
   */
  function getBadgeById(id: number): Badge | null {
    return badgeMap.value?.get(id) ?? null
  }

  /**
   * Clear all bootstrap configuration fields.
   */
  function clearBootstrapConfig(): void {
    apiVersion.value = null
    roomOwnerPercentage.value = null
    receiverPercentage.value = null
    wealthLevels.value = null
    charmLevels.value = null
    roomLevels.value = null
    badges.value = null
    gifts.value = null
    vapid_public_key.value = null
    vipLevels.value = []
    gamesEnabled.value = null
    etag.value = null
    shapeVersion.value = null
  }

  /**
   * Invalidate config. `all` discards the persisted catalog and its validator,
   * so the next fetch is unconditional.
   */
  function invalidateConfig(type: 'levels' | 'badges' | 'gifts' | 'all'): void {
    if (type === 'all') {
      clearBootstrapConfig()
    }
    if (type === 'all' || type === 'gifts') {
      giftCatalog.value = []
    }
  }

  /**
   * Reset store state.
   */
  function reset(): void {
    phase.value = 'idle'
    error.value = null
    clearBootstrapConfig()
    giftCatalog.value = []
    giftTotal.value = 0
    badges.value = []
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    error,
    apiVersion,
    gifts,
    giftCatalog,
    giftTotal,
    roomOwnerPercentage,
    receiverPercentage,
    wealthLevels,
    charmLevels,
    roomLevels,
    badges,
    vapid_public_key,
    vipLevels,
    gamesEnabled,
    etag,
    shapeVersion,

    // Getters
    phase,
    isReady,
    hasUsableCache,
    badgeMap,
    sortedWealthLevels,
    sortedCharmLevels,
    sortedRoomLevels,
    sortedVipLevels,
    vipColorByLevel,

    // Setters
    setPhase,
    markReadyFromCache,
    setError,
    setConfig,
    setEtag,
    setGifts,
    appendGifts,
    getBadgeById,
    invalidateConfig,
    reset,
  }
}, {
  // storage: localStorage, from the nuxt.config default. This was an implicit
  // COOKIE until 2026-08-22 — see that file's note before changing it.
  persist: {
    pick: [
      'gifts',
      'giftCatalog',
      'giftTotal',
      'roomOwnerPercentage',
      'receiverPercentage',
      'wealthLevels',
      'charmLevels',
      'roomLevels',
      'badges',
      'vapid_public_key',
      'vipLevels',
      'gamesEnabled',
      'etag',
      'shapeVersion',
    ],
  },
})
