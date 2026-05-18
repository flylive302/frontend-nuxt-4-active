// ========================================
// Mall Store
// ========================================
// State + computed + setters ONLY.
// All API calls, toasts, socket emissions, and business logic
// live in composables: useMallCatalog, useMallActions, useMallUserProps.
// ========================================

import { defineStore } from 'pinia'
import type {
  Prop,
  PropType,
  PropTypeInfo,
  UserProp,
  EquippedProp,
  EquippedPropsMap,
  PropStatus,
  CatalogState,
  UserPropsState,
} from '~/types/mall/prop'
import type { BootstrapProp } from '~/types/user/bootstrap'
import { PROP_TYPE_ORDER, MALL_STALE_TIME } from '~/constants/mall'

// ========================================
// Store Definition
// ========================================

export const useMallStore = defineStore('mall', () => {
  // ========================================
  // State
  // ========================================

  const catalog = ref<CatalogState>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  const types = ref<PropTypeInfo[]>([])
  const typesLoading = ref(false)

  const userProps = ref<UserPropsState>({
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
  })

  const equipped = ref<EquippedPropsMap>({
    frame: null,
    signature: null,
    room_theme: null,
    chat_bubble: null,
    entry_animation: null,
    data_card: null,
    mice_wave: null,
  })
  const equippedLoading = ref(false)

  const currentType = ref<PropType | undefined>(undefined)
  const currentStatus = ref<PropStatus | 'all'>('active')
  const selectedProp = ref<Prop | null>(null)
  const selectedUserProp = ref<UserProp | null>(null)

  /** Timestamp of last successful data fetch */
  const lastFetchedAt = ref<number | null>(null)

  /**
   * Prop manifest index — keyed by prop ID for O(1) lookups.
   * Seeded from bootstrap, enriched lazily on cache-miss.
   */
  const propIndex = ref<Record<number, BootstrapProp>>({})


  // ========================================
  // Computed
  // ========================================

  /** Ordered prop types for UI tabs. */
  const orderedTypes = computed(() => {
    return PROP_TYPE_ORDER
      .map(type => types.value.find(t => t.type === type))
      .filter((t): t is PropTypeInfo => t !== undefined)
  })

  /** Props of currently equipped type. */
  const currentEquipped = computed(() => {
    if (!currentType.value) return null
    return equipped.value[currentType.value]
  })

  /** User props filtered by current type. */
  const filteredUserProps = computed(() => {
    if (!currentType.value) return userProps.value.items
    return userProps.value.items.filter(p => p.type === currentType.value)
  })

  /** Whether cached data needs refreshing. */
  const needsRefresh = computed<boolean>(() => {
    if (!lastFetchedAt.value) return true
    return Date.now() - lastFetchedAt.value > MALL_STALE_TIME
  })

  // ========================================
  // Setters — Catalog
  // ========================================

  function setTypes(value: PropTypeInfo[]): void {
    types.value = value
  }

  function setTypesLoading(value: boolean): void {
    typesLoading.value = value
  }

  function setLastFetchedAt(value: number | null): void {
    lastFetchedAt.value = value
  }

  function setCatalogItems(items: Prop[]): void {
    catalog.value.items = items
  }

  function appendCatalogItems(items: Prop[]): void {
    catalog.value.items.push(...items)
  }

  function setCatalogLoading(value: boolean): void {
    catalog.value.loading = value
  }

  function setCatalogError(value: string | null): void {
    catalog.value.error = value
  }

  function setCatalogPagination(cursor: string | null, hasMore: boolean): void {
    catalog.value.cursor = cursor
    catalog.value.hasMore = hasMore
  }

  function resetCatalog(): void {
    catalog.value.items = []
    catalog.value.cursor = null
    catalog.value.hasMore = true
  }

  // ========================================
  // Setters — User Props
  // ========================================

  function setUserPropsItems(items: UserProp[]): void {
    userProps.value.items = items
  }

  function appendUserPropsItems(items: UserProp[]): void {
    userProps.value.items.push(...items)
  }

  function setUserPropsLoading(value: boolean): void {
    userProps.value.loading = value
  }

  function setUserPropsError(value: string | null): void {
    userProps.value.error = value
  }

  function setUserPropsPagination(cursor: string | null, hasMore: boolean): void {
    userProps.value.cursor = cursor
    userProps.value.hasMore = hasMore
  }

  function resetUserProps(): void {
    userProps.value.items = []
    userProps.value.cursor = null
    userProps.value.hasMore = true
  }

  /** Update is_equipped flag on a specific user prop item. */
  function setUserPropEquipped(userPropId: number, value: boolean): void {
    const prop = userProps.value.items.find(p => p.id === userPropId)
    if (prop) {
      prop.is_equipped = value
    }
  }

  // ========================================
  // Setters — Equipped
  // ========================================

  function setEquipped(value: EquippedPropsMap): void {
    equipped.value = value
  }

  function setEquippedLoading(value: boolean): void {
    equippedLoading.value = value
  }

  function setEquippedForType(type: PropType, value: EquippedProp | null): void {
    equipped.value[type] = value
  }

  // ========================================
  // Setters — Filters & Selection
  // ========================================

  function setCurrentType(type: PropType | undefined): void {
    currentType.value = type
  }

  function setCurrentStatus(status: PropStatus | 'all'): void {
    currentStatus.value = status
  }

  function selectProp(prop: Prop | null): void {
    selectedProp.value = prop
  }

  function selectUserProp(userProp: UserProp | null): void {
    selectedUserProp.value = userProp
  }

  // ========================================
  // Setters — Prop Index (O(1) lookups)
  // ========================================

  /**
   * Seed the prop index from bootstrap manifest (array → id-keyed object).
   * Called once during bootstrap init via cross-store write.
   */
  function seedPropIndex(props: BootstrapProp[]): void {
    const index: Record<number, BootstrapProp> = {}
    for (const p of props) {
      index[p.id] = p
    }
    propIndex.value = index
  }

  /**
   * Add or update a single prop in the index (failsafe lazy-fetch).
   */
  function addToPropIndex(prop: BootstrapProp): void {
    propIndex.value[prop.id] = prop
  }

  // ========================================
  // Reset
  // ========================================

  function reset(): void {
    catalog.value = {
      items: [],
      loading: false,
      error: null,
      hasMore: true,
      cursor: null,
    }
    types.value = []
    userProps.value = {
      items: [],
      loading: false,
      error: null,
      hasMore: true,
      cursor: null,
    }
    equipped.value = {
      frame: null,
      signature: null,
      room_theme: null,
      chat_bubble: null,
      entry_animation: null,
      data_card: null,
      mice_wave: null,
    }
    currentType.value = undefined
    currentStatus.value = 'active'
    selectedProp.value = null
    selectedUserProp.value = null
    lastFetchedAt.value = null
    propIndex.value = {}
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    catalog,
    types,
    typesLoading,
    userProps,
    equipped,
    equippedLoading,
    currentType,
    currentStatus,
    selectedProp,
    selectedUserProp,
    lastFetchedAt,

    // Computed
    orderedTypes,
    currentEquipped,
    filteredUserProps,
    needsRefresh,

    // Setters — Catalog
    setTypes,
    setTypesLoading,
    setLastFetchedAt,
    setCatalogItems,
    appendCatalogItems,
    setCatalogLoading,
    setCatalogError,
    setCatalogPagination,
    resetCatalog,

    // Setters — User Props
    setUserPropsItems,
    appendUserPropsItems,
    setUserPropsLoading,
    setUserPropsError,
    setUserPropsPagination,
    resetUserProps,
    setUserPropEquipped,

    // Setters — Equipped
    setEquipped,
    setEquippedLoading,
    setEquippedForType,

    // Setters — Filters & Selection
    setCurrentType,
    setCurrentStatus,
    selectProp,
    selectUserProp,

    // Reset
    reset,

    // Prop Index (O(1) lookups)
    propIndex,
    seedPropIndex,
    addToPropIndex,
  }
}, {
  // Persist equipped state to avoid flicker on navigation
  persist: {
    pick: ['equipped', 'types', 'propIndex'],
  },
})
