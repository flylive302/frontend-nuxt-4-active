// ========================================
// Pretty ID Store — "me" + Choose browse / search / claim flow
// ========================================
// State + setters ONLY. API calls, toasts and navigation live in
// composables/pretty-id. Not persisted.
// ========================================

import { defineStore } from 'pinia'
import type { Ref } from 'vue'
import { PRETTY_ID_DEFAULT_TIER } from '~/constants/pretty-id'
import type {
  PrettyIdCategory,
  PrettyIdCelebration,
  PrettyIdItem,
  PrettyIdMe,
  PrettyIdRaceConflict,
  PrettyIdSearchStatus,
  PrettyIdTier,
  PrettyIdTierMode,
  PrettyIdTierState,
} from '~/types/pretty-id'

/**
 * Read-only view of a state ref. `readonly()` at runtime (writes are rejected);
 * typed shallow so the contract interfaces (mutable arrays) stay assignable to
 * component props instead of turning into `DeepReadonly<...>`.
 */
function exposeReadonly<T>(source: Ref<T>): Readonly<Ref<T>> {
  return readonly(source) as unknown as Readonly<Ref<T>>
}

export const usePrettyIdStore = defineStore('prettyId', () => {
  // ========================================
  // State
  // ========================================

  const me = ref<PrettyIdMe | null>(null)
  const isMeLoading = ref(false)
  /** The last `me` load failed and there is still nothing to show — the event cannot render. */
  const isMeFailed = ref(false)

  const activeTier = ref<PrettyIdTier>(PRETTY_ID_DEFAULT_TIER)
  const category = ref<PrettyIdCategory | null>(null)
  const items = ref<PrettyIdItem[]>([])
  const itemsTotal = ref(0)
  const nextCursor = ref<string | null>(null)
  const isListLoading = ref(false)
  const isListLoadingMore = ref(false)
  /** The last list load failed (first page) — the grid offers a retry. */
  const isListFailed = ref(false)

  const searchQuery = ref('')
  const searchStatus = ref<PrettyIdSearchStatus>('idle')
  /** The searched number when it is available; `null` otherwise. */
  const searchResult = ref<PrettyIdItem | null>(null)

  /** The number shown in the confirm modal. */
  const claimTarget = ref<PrettyIdItem | null>(null)
  const isClaiming = ref(false)
  const raceConflict = ref<PrettyIdRaceConflict | null>(null)
  const celebration = ref<PrettyIdCelebration | null>(null)

  // ========================================
  // Computed
  // ========================================

  const wealthLevel = computed(() => me.value?.wealth_level ?? 0)

  const activeTierState = computed<PrettyIdTierState | null>(
    () => me.value?.tiers.find(state => state.tier === activeTier.value) ?? null,
  )

  /** What the Choose tab shows for the active tier. */
  const tierMode = computed<PrettyIdTierMode>(() => {
    const state = activeTierState.value
    if (state === null) return 'loading'
    if (state.claimed !== null) return 'claimed'
    return state.unlocked ? 'browse' : 'locked'
  })

  /** The tier being browsed, or `null` while the active tier is loading / locked / claimed. */
  const browseTier = computed<PrettyIdTier | null>(() => (tierMode.value === 'browse' ? activeTier.value : null))

  const hasMore = computed(() => nextCursor.value !== null)

  // ========================================
  // Setters
  // ========================================

  function setMe(value: PrettyIdMe | null): void {
    me.value = value
  }

  function setMeLoading(value: boolean): void {
    isMeLoading.value = value
  }

  function setMeFailed(value: boolean): void {
    isMeFailed.value = value
  }

  function setActiveTier(value: PrettyIdTier): void {
    activeTier.value = value
  }

  function setCategory(value: PrettyIdCategory | null): void {
    category.value = value
  }

  /** Replaces the list (first page). */
  function setList(nextItems: PrettyIdItem[], total: number, cursor: string | null): void {
    items.value = nextItems
    itemsTotal.value = total
    nextCursor.value = cursor
  }

  /** Appends the next page (a number already listed is skipped); `total` follows the latest response. */
  function appendList(nextItems: PrettyIdItem[], total: number, cursor: string | null): void {
    const listed = new Set(items.value.map(item => item.signature))
    items.value = [...items.value, ...nextItems.filter(item => !listed.has(item.signature))]
    itemsTotal.value = total
    nextCursor.value = cursor
  }

  function clearList(): void {
    items.value = []
    itemsTotal.value = 0
    nextCursor.value = null
    isListFailed.value = false
  }

  function setListLoading(value: boolean): void {
    isListLoading.value = value
  }

  function setListLoadingMore(value: boolean): void {
    isListLoadingMore.value = value
  }

  function setListFailed(value: boolean): void {
    isListFailed.value = value
  }

  function setSearch(query: string, status: PrettyIdSearchStatus, result: PrettyIdItem | null = null): void {
    searchQuery.value = query
    searchStatus.value = status
    searchResult.value = result
  }

  function setClaimTarget(value: PrettyIdItem | null): void {
    claimTarget.value = value
  }

  function setClaiming(value: boolean): void {
    isClaiming.value = value
  }

  function setRaceConflict(value: PrettyIdRaceConflict | null): void {
    raceConflict.value = value
  }

  function setCelebration(value: PrettyIdCelebration | null): void {
    celebration.value = value
  }

  function reset(): void {
    me.value = null
    isMeLoading.value = false
    isMeFailed.value = false
    activeTier.value = PRETTY_ID_DEFAULT_TIER
    category.value = null
    items.value = []
    itemsTotal.value = 0
    nextCursor.value = null
    isListLoading.value = false
    isListLoadingMore.value = false
    isListFailed.value = false
    searchQuery.value = ''
    searchStatus.value = 'idle'
    searchResult.value = null
    claimTarget.value = null
    isClaiming.value = false
    raceConflict.value = null
    celebration.value = null
  }

  return {
    me: exposeReadonly(me),
    isMeLoading: readonly(isMeLoading),
    isMeFailed: readonly(isMeFailed),
    activeTier: readonly(activeTier),
    category: readonly(category),
    items: exposeReadonly(items),
    itemsTotal: readonly(itemsTotal),
    nextCursor: readonly(nextCursor),
    isListLoading: readonly(isListLoading),
    isListLoadingMore: readonly(isListLoadingMore),
    isListFailed: readonly(isListFailed),
    searchQuery: readonly(searchQuery),
    searchStatus: readonly(searchStatus),
    searchResult: exposeReadonly(searchResult),
    claimTarget: exposeReadonly(claimTarget),
    isClaiming: readonly(isClaiming),
    raceConflict: exposeReadonly(raceConflict),
    celebration: exposeReadonly(celebration),
    wealthLevel,
    activeTierState,
    tierMode,
    browseTier,
    hasMore,
    setMe,
    setMeLoading,
    setMeFailed,
    setActiveTier,
    setCategory,
    setList,
    appendList,
    clearList,
    setListLoading,
    setListLoadingMore,
    setListFailed,
    setSearch,
    setClaimTarget,
    setClaiming,
    setRaceConflict,
    setCelebration,
    reset,
  }
})
