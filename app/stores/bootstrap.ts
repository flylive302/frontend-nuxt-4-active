// ========================================
// Bootstrap Store
// ========================================
// Stores = ref + computed + setters ONLY (no API, no toast, no cross-store calls)

import { defineStore } from 'pinia'
import type {
  BootstrapConfig,
  LevelBadge, LevelConfig,
} from '~/types/user/bootstrap'
import type { Gift } from '~/types/gift/gift'
import type { Badge } from "~/types/progression/badge";

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
  const vapid_public_key = ref<string | null>();

  /** Gift catalog (accumulates as user scrolls) */
  const giftCatalog = ref<Gift[]>([])

  /** Total gift count from the server */
  const giftTotal = ref<number>(0)

  /** Last bootstrap timestamp */
  const lastBootstrapAt = ref<number | null>(null)

  // ========================================
  // Getters
  // ========================================

  /**
   * Whether bootstrap has completed and config is available.
   */
  const isReady = computed(() => phase.value === 'complete')

  /**
   * Check if config needs refresh based on TTL.
   */
  const needsRefresh = computed(() => {
    if (!lastBootstrapAt.value) return true
    const STALE_TIME = 50 * 60 * 1000 // 5 minutes
    return Date.now() - lastBootstrapAt.value > STALE_TIME
  })

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
    if (newPhase === 'complete') {
      lastBootstrapAt.value = Date.now()
    }
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
  }

  /**
   * Invalidate config (force refresh on next boot).
   */

  function invalidateConfig(type: 'levels' | 'badges' | 'gifts' | 'all'): void {
    if (type === 'all') {
      lastBootstrapAt.value = null
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
    lastBootstrapAt.value = null
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
    lastBootstrapAt,

    // Getters
    phase,
    isReady,
    needsRefresh,
    badgeMap,
    sortedWealthLevels,
    sortedCharmLevels,
    sortedRoomLevels,

    // Setters
    setPhase,
    setError,
    setConfig,
    setGifts,
    appendGifts,
    getBadgeById,
    invalidateConfig,
    reset,
  }
}, {
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
      'lastBootstrapAt'
    ],
  },
})
