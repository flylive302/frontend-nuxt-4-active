/**
 * Mall Page Composable
 *
 * Orchestrates page-level initialization and selection for the mall.
 * Encapsulates all store mutations and init logic that pages must not
 * perform directly.
 *
 * Pages call these methods; this composable handles the GATE → EXECUTE flow.
 */
import { PROP_TYPE_LABELS, PROP_TYPE_ORDER } from '~/constants/mall'
import { createLogger } from '~/utils/logger'
import type { Prop, PropType, UserProp } from '~/types/mall/prop'

const log = createLogger('[MallPage]')

export function useMallPage() {
  // ========================================
  // Dependencies
  // ========================================

  const mallStore = useMallStore()
  const { fetchTypes, fetchCatalog, setType } = useMallCatalog()
  const { fetchUserProps, fetchEquipped } = useMallUserProps()

  // ========================================
  // Computed (UI-derived state for pages)
  // ========================================

  /**
   * Tab items from prop types.
   */
  const tabItems = computed(() => {
    return mallStore.orderedTypes.map(typeInfo => ({
      label: PROP_TYPE_LABELS[typeInfo.type],
      value: typeInfo.type,
      count: typeInfo.count,
    }))
  })

  /**
   * Selected tab value synced with store.
   */
  const selectedTab = computed({
    get: () => mallStore.currentType ?? tabItems.value[0]?.value ?? undefined,
    set: (val) => mallStore.setCurrentType(val as PropType | undefined),
  })

  // ========================================
  // Catalog Page Init
  // ========================================

  /**
   * Initialize the catalog page.
   *
   * GATE:    none (always runs on mount)
   * EXECUTE: predict first tab → fetch types + type-filtered catalog in parallel
   * REACT:   none (pure data)
   *
   * Types and catalog used to be fetched in series (await fetchTypes() → set
   * first type → await fetchCatalog()), doubling the round-trip before any
   * content painted. The backend's /props/types always returns every
   * PropType (PropCatalogService::getTypeCounts maps PropType::cases(),
   * count 0 when a type has no props), and `orderedTypes` just re-orders
   * that full set by the static PROP_TYPE_ORDER — so orderedTypes[0] is
   * deterministically PROP_TYPE_ORDER[0] without waiting on the network.
   * We predict it, apply it as the filter up front, and fire both requests
   * together. fetchTypes/fetchCatalog each swallow their own errors
   * internally, so one failing never blanks the other's rendered section.
   */
  async function initializeCatalog(): Promise<void> {
    const predictedType = PROP_TYPE_ORDER[0]
    mallStore.setCurrentType(predictedType)

    await Promise.all([
      fetchTypes(),
      fetchCatalog({}, true),
    ])

    reconcileFirstType(predictedType)
  }

  // ========================================
  // User Props Page Init
  // ========================================

  /**
   * Initialize the my-props page.
   *
   * GATE:    none (always runs on mount)
   * EXECUTE: predict first tab → fetch types + type-filtered user props + equipped, all in parallel
   * REACT:   none (pure data)
   *
   * Same rationale as initializeCatalog: predict the first tab
   * (PROP_TYPE_ORDER[0], guaranteed present because /props/types always
   * returns every PropType), apply it up front, and fire all three
   * requests together instead of waiting on types first. Each fetch
   * handles its own errors, so one failing never blanks the others.
   */
  async function initializeUserProps(): Promise<void> {
    const predictedType = PROP_TYPE_ORDER[0]
    mallStore.setCurrentType(predictedType)

    await Promise.all([
      fetchTypes(),
      fetchUserProps({}, true),
      fetchEquipped(),
    ])

    reconcileFirstType(predictedType)
  }

  /**
   * Reconcile the predicted first tab with the types response that just
   * landed. In practice this is a no-op — see initializeCatalog's comment
   * on why orderedTypes[0] is deterministic — kept only as a defensive
   * guard in case that backend invariant ever changes.
   */
  function reconcileFirstType(predictedType: PropType | undefined): void {
    const actualFirstType = mallStore.orderedTypes[0]?.type
    if (actualFirstType && actualFirstType !== predictedType) {
      log.warn('Predicted mall tab mismatched API response; correcting', { predictedType, actualFirstType })
      mallStore.setCurrentType(actualFirstType)
    }
  }

  // ========================================
  // Tab Handlers
  // ========================================

  /**
   * Handle tab change on catalog page.
   * Accepts the tab value directly from UTabs @update:model-value.
   */
  async function handleCatalogTabChange(value: string | number): Promise<void> {
    await setType(String(value) as PropType | undefined)
  }

  /**
   * Handle tab change on user props page.
   * Accepts the tab value directly from UTabs @update:model-value.
   */
  async function handleUserPropsTabChange(value: string | number): Promise<void> {
    mallStore.setCurrentType(String(value) as PropType | undefined)
    // Refetch with new type filter for server-side filtering
    await fetchUserProps({}, true)
  }

  // ========================================
  // Selection Handlers
  // ========================================

  /** Select a catalog prop for detail modal. */
  function selectProp(prop: Prop | null): void {
    mallStore.selectProp(prop)
  }

  /** Select a user prop for detail modal. */
  function selectUserProp(userProp: UserProp | null): void {
    mallStore.selectUserProp(userProp)
  }

  // ========================================
  // Load More
  // ========================================

  /** Load more catalog props. */
  async function loadMoreCatalog(): Promise<void> {
    if (mallStore.catalog.hasMore && !mallStore.catalog.loading) {
      await fetchCatalog()
    }
  }

  /** Load more user props. */
  async function loadMoreUserProps(): Promise<void> {
    if (mallStore.userProps.hasMore && !mallStore.userProps.loading) {
      await fetchUserProps()
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    // Computed
    tabItems,
    selectedTab,

    // Initializers
    initializeCatalog,
    initializeUserProps,

    // Tab handlers
    handleCatalogTabChange,
    handleUserPropsTabChange,

    // Selection
    selectProp,
    selectUserProp,

    // Pagination
    loadMoreCatalog,
    loadMoreUserProps,

    // Re-export for convenience (pages need these for retry buttons)
    fetchCatalog,
    fetchUserProps,
  }
}
