/**
 * Mall Page Composable
 *
 * Orchestrates page-level initialization and selection for the mall.
 * Encapsulates all store mutations and init logic that pages must not
 * perform directly.
 *
 * Pages call these methods; this composable handles the GATE → EXECUTE flow.
 */
import { PROP_TYPE_LABELS } from '~/constants/mall'
import type { Prop, PropType, UserProp } from '~/types/mall/prop'

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
   * EXECUTE: reset → fetchTypes → set first type → fetchCatalog
   * REACT:   none (pure data)
   */
  async function initializeCatalog(): Promise<void> {
    // Reset currentType to ensure fresh state on navigation
    mallStore.setCurrentType(undefined)

    // Fetch types first to populate tabs
    await fetchTypes()

    // Set initial type to first available type after types are loaded
    const firstType = mallStore.orderedTypes[0]?.type ?? undefined
    mallStore.setCurrentType(firstType)

    // Now fetch catalog with correct type filter
    await fetchCatalog({}, true)
  }

  // ========================================
  // User Props Page Init
  // ========================================

  /**
   * Initialize the my-props page.
   *
   * GATE:    none (always runs on mount)
   * EXECUTE: reset → fetchTypes → set first type → fetchUserProps + fetchEquipped
   * REACT:   none (pure data)
   */
  async function initializeUserProps(): Promise<void> {
    // Reset currentType to ensure fresh state on navigation
    mallStore.setCurrentType(undefined)

    // Fetch types first, then set initial type before fetching user props
    await fetchTypes()

    // Set initial type to first available type after types are loaded
    const firstType = mallStore.orderedTypes[0]?.type ?? undefined
    mallStore.setCurrentType(firstType)

    // Now fetch user props and equipped with correct type filter
    await Promise.all([
      fetchUserProps({}, true),
      fetchEquipped(),
    ])
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
