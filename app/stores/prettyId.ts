// ========================================
// Pretty ID Store — "me" + Choose / search / claim flow
// ========================================
// State + setters ONLY. API calls, toasts and navigation live in
// composables/pretty-id. Not persisted.
// ========================================

import { defineStore } from 'pinia'
import type { Ref } from 'vue'
import { PRETTY_ID_SLOT_LENGTH } from '~/constants/pretty-id'
import type {
  PrettyIdCelebration,
  PrettyIdItem,
  PrettyIdLength,
  PrettyIdMe,
  PrettyIdRaceConflict,
  PrettyIdSearchResult,
  PrettyIdTier,
} from '~/types/pretty-id'

/** The Choose tab opens on the 6-digit (Lv 17) list. */
const DEFAULT_LIST_LENGTH: PrettyIdLength = PRETTY_ID_SLOT_LENGTH.lv17

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

  const listLength = ref<PrettyIdLength>(DEFAULT_LIST_LENGTH)
  const listTier = ref<PrettyIdTier | null>(null)
  const items = ref<PrettyIdItem[]>([])
  const itemsTotal = ref(0)
  const isListLoading = ref(false)

  const searchQuery = ref('')
  const searchResult = ref<PrettyIdSearchResult | null>(null)
  const isSearching = ref(false)

  /** The ID shown in the confirm modal. */
  const claimTarget = ref<string | null>(null)
  const isClaiming = ref(false)
  const raceConflict = ref<PrettyIdRaceConflict | null>(null)
  const celebration = ref<PrettyIdCelebration | null>(null)

  // ========================================
  // Computed
  // ========================================

  const level = computed(() => me.value?.level ?? 0)

  // ========================================
  // Setters
  // ========================================

  function setMe(value: PrettyIdMe | null): void {
    me.value = value
  }

  function setMeLoading(value: boolean): void {
    isMeLoading.value = value
  }

  function setListLength(value: PrettyIdLength): void {
    listLength.value = value
  }

  function setListTier(value: PrettyIdTier | null): void {
    listTier.value = value
  }

  function setList(nextItems: PrettyIdItem[], total: number): void {
    items.value = nextItems
    itemsTotal.value = total
  }

  function setListLoading(value: boolean): void {
    isListLoading.value = value
  }

  function setSearch(query: string, result: PrettyIdSearchResult | null): void {
    searchQuery.value = query
    searchResult.value = result
  }

  function setSearching(value: boolean): void {
    isSearching.value = value
  }

  function setClaimTarget(id: string | null): void {
    claimTarget.value = id
  }

  function setClaiming(value: boolean): void {
    isClaiming.value = value
  }

  function setRaceConflict(value: PrettyIdRaceConflict | null): void {
    raceConflict.value = value
  }

  function setMeFailed(value: boolean): void {
    isMeFailed.value = value
  }

  function setCelebration(value: PrettyIdCelebration | null): void {
    celebration.value = value
  }

  function reset(): void {
    me.value = null
    isMeLoading.value = false
    isMeFailed.value = false
    listLength.value = DEFAULT_LIST_LENGTH
    listTier.value = null
    items.value = []
    itemsTotal.value = 0
    isListLoading.value = false
    searchQuery.value = ''
    searchResult.value = null
    isSearching.value = false
    claimTarget.value = null
    isClaiming.value = false
    raceConflict.value = null
    celebration.value = null
  }

  return {
    me: exposeReadonly(me),
    isMeLoading: readonly(isMeLoading),
    isMeFailed: readonly(isMeFailed),
    listLength: readonly(listLength),
    listTier: readonly(listTier),
    items: exposeReadonly(items),
    itemsTotal: readonly(itemsTotal),
    isListLoading: readonly(isListLoading),
    searchQuery: readonly(searchQuery),
    searchResult: exposeReadonly(searchResult),
    isSearching: readonly(isSearching),
    claimTarget: readonly(claimTarget),
    isClaiming: readonly(isClaiming),
    raceConflict: exposeReadonly(raceConflict),
    celebration: exposeReadonly(celebration),
    level,
    setMe,
    setMeLoading,
    setListLength,
    setListTier,
    setList,
    setListLoading,
    setSearch,
    setSearching,
    setClaimTarget,
    setClaiming,
    setRaceConflict,
    setMeFailed,
    setCelebration,
    reset,
  }
})
