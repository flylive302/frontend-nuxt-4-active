// ========================================
// Mall Store
// ========================================

import { defineStore } from 'pinia'
import { createLogger } from '~/utils/logger'
import { useAuthStore } from '~/stores/auth'
import type {
  Prop,
  PropType,
  PropTypeInfo,
  UserProp,
  EquippedPropsMap,
  GetPropsParams,
  GetUserPropsParams,
  PropListResponse,
  PropTypesResponse,
  UserPropsResponse,
  EquippedPropsResponse,
  PropPurchaseResponse,
  PropEquipResponse,
  PropStatus,
} from '~/types/mall/prop'
import { PROP_TYPE_ORDER } from '~/types/mall/prop'

// ========================================
// Types
// ========================================

interface CatalogState {
  items: Prop[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}

interface UserPropsState {
  items: UserProp[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}

// ========================================
// Store Definition
// ========================================

export const useMallStore = defineStore('mall', () => {
  const log = createLogger('[MallStore]')
  const { api, normalizeError } = useApi()
  const toast = useToast()
  const authStore = useAuthStore()

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
  })
  const equippedLoading = ref(false)

  const currentType = ref<PropType | undefined>(undefined)
  const currentStatus = ref<PropStatus | 'all'>('active')
  const selectedProp = ref<Prop | null>(null)
  const selectedUserProp = ref<UserProp | null>(null)

  // Action states
  const isPurchasing = ref(false)
  const isEquipping = ref<number | null>(null)

  /** Timestamp of last successful data fetch */
  const lastFetchedAt = ref<number | null>(null)

  // ========================================
  // Constants
  // ========================================

  /** Data is considered stale after 5 minutes */
  const STALE_TIME = 5 * 60 * 1000

  // ========================================
  // Computed
  // ========================================

  /**
   * Ordered prop types for UI tabs.
   */
  const orderedTypes = computed(() => {
    return PROP_TYPE_ORDER
      .map(type => types.value.find(t => t.type === type))
      .filter((t): t is PropTypeInfo => t !== undefined)
  })

  /**
   * Props of currently equipped type.
   */
  const currentEquipped = computed(() => {
    if (!currentType.value) return null
    return equipped.value[currentType.value]
  })

  /**
   * User props filtered by current type.
   */
  const filteredUserProps = computed(() => {
    if (!currentType.value) return userProps.value.items
    return userProps.value.items.filter(p => p.type === currentType.value)
  })

  /**
   * Whether cached data needs refreshing.
   */
  const needsRefresh = computed<boolean>(() => {
    if (!lastFetchedAt.value) return true
    return Date.now() - lastFetchedAt.value > STALE_TIME
  })

  // ========================================
  // Catalog Actions
  // ========================================

  /**
   * Fetch prop types with counts.
   * Backend caches for 5 minutes.
   */
  async function fetchTypes(): Promise<void> {
    if (typesLoading.value) return

    typesLoading.value = true

    try {
      const response = await api<PropTypesResponse>('/props/types')
      log.debug('fetchTypes response:', response)
      types.value = response.data.types
      lastFetchedAt.value = Date.now()
    } catch (err) {
      log.error('fetchTypes failed:', err)
    } finally {
      typesLoading.value = false
    }
  }

  /**
   * Fetch catalog props with pagination.
   */
  async function fetchCatalog(params: GetPropsParams = {}, reset = false): Promise<void> {
    if (reset) {
      catalog.value.items = []
      catalog.value.cursor = null
      catalog.value.hasMore = true
    }

    if (!catalog.value.hasMore || catalog.value.loading) return

    catalog.value.loading = true
    catalog.value.error = null

    try {
      const queryParams: Record<string, unknown> = {
        per_page: params.per_page ?? 20,
      }

      if (params.type || currentType.value) {
        queryParams.type = params.type ?? currentType.value
      }
      if (catalog.value.cursor) {
        queryParams.cursor = catalog.value.cursor
      }

      log.debug('fetchCatalog queryParams:', queryParams)
      const response = await api<PropListResponse>('/props', { params: queryParams })
      log.debug('fetchCatalog response:', response)

      if (reset) {
        catalog.value.items = response.data.props
      } else {
        catalog.value.items.push(...response.data.props)
      }

      catalog.value.cursor = response.data.pagination.next_cursor
      catalog.value.hasMore = response.data.pagination.has_more
    } catch (err) {
      const normalized = normalizeError(err)
      catalog.value.error = normalized.message
      log.error('fetchCatalog failed:', err)
    } finally {
      catalog.value.loading = false
    }
  }

  /**
   * Set current type filter and refetch catalog.
   */
  async function setType(type: PropType | undefined): Promise<void> {
    currentType.value = type
    await fetchCatalog({}, true)
  }

  // ========================================
  // User Props Actions
  // ========================================

  /**
   * Fetch user's owned props.
   */
  async function fetchUserProps(params: GetUserPropsParams = {}, reset = false): Promise<void> {
    if (reset) {
      userProps.value.items = []
      userProps.value.cursor = null
      userProps.value.hasMore = true
    }

    if (!userProps.value.hasMore || userProps.value.loading) return

    userProps.value.loading = true
    userProps.value.error = null

    try {
      const queryParams: Record<string, unknown> = {
        per_page: params.per_page ?? 50,
        status: params.status ?? currentStatus.value,
      }

      if (params.type || currentType.value) {
        queryParams.type = params.type ?? currentType.value
      }
      if (userProps.value.cursor) {
        queryParams.cursor = userProps.value.cursor
      }

      const response = await api<UserPropsResponse>('/user/props', { params: queryParams })

      if (reset) {
        userProps.value.items = response.data.props
      } else {
        userProps.value.items.push(...response.data.props)
      }

      userProps.value.cursor = response.data.pagination.next_cursor
      userProps.value.hasMore = response.data.pagination.has_more
    } catch (err) {
      const normalized = normalizeError(err)
      userProps.value.error = normalized.message
      log.error('fetchUserProps failed:', err)
    } finally {
      userProps.value.loading = false
    }
  }

  /**
   * Fetch currently equipped props.
   * Backend caches for 15 minutes.
   */
  async function fetchEquipped(): Promise<void> {
    if (equippedLoading.value) return

    equippedLoading.value = true

    try {
      const response = await api<EquippedPropsResponse>('/user/props/equipped')
      equipped.value = response.data.equipped
    } catch (err) {
      log.error('fetchEquipped failed:', err)
    } finally {
      equippedLoading.value = false
    }
  }

  // ========================================
  // Transaction Actions
  // ========================================

  /**
   * Purchase a prop.
   */
  async function purchaseProp(propId: number): Promise<boolean> {
    if (isPurchasing.value) return false

    isPurchasing.value = true

    try {
      const response = await api<PropPurchaseResponse>(`/props/${propId}/purchase`, {
        method: 'POST',
      })

      toast.add({
        title: 'Purchase Successful',
        description: `New balance: ${response.data.balance.coins_after.toLocaleString()} coins`,
        color: 'success',
      })

      // Refresh user props to show new purchase
      await fetchUserProps({}, true)

      return true
    } catch (err) {
      const normalized = normalizeError(err)

      // Handle specific error codes
      if (normalized.status === 402) {
        toast.add({
          title: 'Insufficient Balance',
          description: 'You don\'t have enough coins for this purchase.',
          color: 'error',
        })
      } else if (normalized.status === 400) {
        toast.add({
          title: 'Purchase Failed',
          description: normalized.message || 'This prop is not available.',
          color: 'error',
        })
      } else {
        toast.add({
          title: 'Purchase Failed',
          description: normalized.message,
          color: 'error',
        })
      }

      log.error('purchaseProp failed:', err)
      return false
    } finally {
      isPurchasing.value = false
    }
  }

  /**
   * Equip a user prop.
   */
  async function equipProp(userPropId: number): Promise<boolean> {
    if (isEquipping.value !== null) return false

    isEquipping.value = userPropId
    const prop = userProps.value.items.find(p => p.id === userPropId)
    if (!prop) {
      isEquipping.value = null
      return false
    }

    // Optimistic update
    const previousEquipped = equipped.value[prop.type]
    prop.is_equipped = true

    // Auto-unequip previous of same type
    if (previousEquipped) {
      const prevProp = userProps.value.items.find(p => p.id === previousEquipped.id)
      if (prevProp) prevProp.is_equipped = false
    }

    // Update equipped map optimistically
    equipped.value[prop.type] = {
      id: prop.id,
      prop_id: prop.prop_id,
      name: prop.name,
      asset_url: prop.asset_url,
    }

    // Sync auth store optimistically for frame type
    const previousFrame = prop.type === 'frame' ? (authStore.user?.frame ?? null) : null
    if (prop.type === 'frame') {
      authStore.patchProfile({ frame: prop.asset_url })
    }

    try {
      await api<PropEquipResponse>(`/props/${userPropId}/equip`, { method: 'POST' })

      toast.add({
        title: 'Prop Equipped',
        color: 'success',
      })

      return true
    } catch (err) {
      // Rollback on error
      prop.is_equipped = false
      equipped.value[prop.type] = previousEquipped

      if (previousEquipped) {
        const prevProp = userProps.value.items.find(p => p.id === previousEquipped.id)
        if (prevProp) prevProp.is_equipped = true
      }

      // Rollback auth store frame
      if (prop.type === 'frame') {
        authStore.patchProfile({ frame: previousFrame })
      }

      const normalized = normalizeError(err)
      toast.add({
        title: 'Equip Failed',
        description: normalized.message,
        color: 'error',
      })

      log.error('equipProp failed:', err)
      return false
    } finally {
      isEquipping.value = null
    }
  }

  /**
   * Unequip a user prop.
   */
  async function unequipProp(userPropId: number): Promise<boolean> {
    if (isEquipping.value !== null) return false

    isEquipping.value = userPropId
    const prop = userProps.value.items.find(p => p.id === userPropId)
    if (!prop) {
      isEquipping.value = null
      return false
    }

    // Optimistic update
    const previousState = prop.is_equipped
    prop.is_equipped = false
    equipped.value[prop.type] = null

    // Sync auth store optimistically for frame type
    const previousFrame = prop.type === 'frame' ? (authStore.user?.frame ?? null) : null
    if (prop.type === 'frame') {
      authStore.patchProfile({ frame: null })
    }

    try {
      await api(`/props/${userPropId}/unequip`, { method: 'POST' })

      toast.add({
        title: 'Prop Unequipped',
        color: 'neutral',
      })

      return true
    } catch (err) {
      // Rollback on error
      prop.is_equipped = previousState
      if (previousState) {
        equipped.value[prop.type] = {
          id: prop.id,
          prop_id: prop.prop_id,
          name: prop.name,
          asset_url: prop.asset_url,
        }
      }

      // Rollback auth store frame
      if (prop.type === 'frame') {
        authStore.patchProfile({ frame: previousFrame })
      }

      const normalized = normalizeError(err)
      toast.add({
        title: 'Unequip Failed',
        description: normalized.message,
        color: 'error',
      })

      log.error('unequipProp failed:', err)
      return false
    } finally {
      isEquipping.value = null
    }
  }

  // ========================================
  // UI Helpers
  // ========================================

  /**
   * Select a prop for detail view.
   */
  function selectProp(prop: Prop | null): void {
    selectedProp.value = prop
  }

  /**
   * Select a user prop for detail/preview view.
   */
  function selectUserProp(userProp: UserProp | null): void {
    selectedUserProp.value = userProp
  }

  /**
   * Set status filter for user props.
   */
  async function setStatus(status: PropStatus | 'all'): Promise<void> {
    currentStatus.value = status
    await fetchUserProps({}, true)
  }

  /**
   * Reset all state.
   */
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
    }
    currentType.value = undefined
    currentStatus.value = 'active'
    selectedProp.value = null
    selectedUserProp.value = null
    isPurchasing.value = false
    isEquipping.value = null
    lastFetchedAt.value = null
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
    isPurchasing,
    isEquipping,
    lastFetchedAt,

    // Computed
    orderedTypes,
    currentEquipped,
    filteredUserProps,
    needsRefresh,

    // Catalog Actions
    fetchTypes,
    fetchCatalog,
    setType,

    // User Props Actions
    fetchUserProps,
    fetchEquipped,

    // Transaction Actions
    purchaseProp,
    equipProp,
    unequipProp,

    // UI Helpers
    selectProp,
    selectUserProp,
    setStatus,
    reset,
  }
}, {
  // Persist equipped state to avoid flicker on navigation
  persist: {
    pick: ['equipped', 'types'],
  },
})
