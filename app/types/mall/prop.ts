// ========================================
// Prop Types
// ========================================

// ========================================
// Enums
// ========================================

/**
 * Prop type categories.
 */
export type PropType = 'frame' | 'signature' | 'room_theme' | 'chat_bubble' | 'entry_animation' | 'data_card' | 'mice_wave'

/**
 * Prop status for user-owned props.
 */
export type PropStatus = 'active' | 'expired'

/**
 * Source of how user obtained the prop.
 */
export type PropSourceType = 'purchase' | 'gift' | 'reward'

// ========================================
// Catalog Types
// ========================================

/**
 * Prop type category with count.
 * Note: API returns 'label' not 'name'. Icon is derived from PROP_TYPE_ICONS.
 */
export interface PropTypeInfo {
  type: PropType
  label: string
  count: number
}

/**
 * Prop from catalog (GET /api/v1/props).
 */
export interface Prop {
  id: number
  name: string
  description: string | null
  type: PropType
  thumbnail_url: string
  asset_url: string
  price: number
  duration_days: number | null
  is_purchasable: boolean
  is_giftable: boolean
  is_available: boolean
  inventory_count: number | null
  vip_level_required: number
  signature_value: string | null
  metadata: Record<string, unknown> | null
}

// ========================================
// User Prop Types
// ========================================

/**
 * User's owned prop (GET /api/v1/user/props).
 */
export interface UserProp {
  id: number
  prop_id: number
  type: PropType
  name: string
  thumbnail_url: string
  asset_url: string
  purchased_at: string
  expires_at: string | null
  is_equipped: boolean
  source_type: PropSourceType
  days_remaining: number | null
  is_valid: boolean
}

/**
 * Equipped prop info (from GET /api/v1/user/props/equipped).
 */
export interface EquippedProp {
  id: number
  prop_id: number
  name: string
  asset_url: string
}

/**
 * Map of equipped props by type.
 */
export interface EquippedPropsMap {
  frame: EquippedProp | null
  signature: EquippedProp | null
  room_theme: EquippedProp | null
  chat_bubble: EquippedProp | null
  entry_animation: EquippedProp | null
  data_card: EquippedProp | null
  mice_wave: EquippedProp | null
}

// ========================================
// API Request/Response Types
// ========================================

/**
 * Cursor-based pagination metadata.
 */
export interface PropPagination {
  next_cursor: string | null
  prev_cursor: string | null
  has_more: boolean
  per_page: number
}

/**
 * Parameters for fetching catalog props.
 */
export interface GetPropsParams {
  type?: PropType
  per_page?: number
  cursor?: string
}

/**
 * Parameters for fetching user props.
 */
export interface GetUserPropsParams {
  type?: PropType
  status?: PropStatus | 'all'
  per_page?: number
  cursor?: string
}

/**
 * API response for props catalog.
 */
export interface PropListResponse {
  status: 'success'
  message: string
  data: {
    props: Prop[]
    pagination: PropPagination
  }
}

/**
 * API response for prop types.
 */
export interface PropTypesResponse {
  status: 'success'
  message: string
  data: {
    types: PropTypeInfo[]
  }
}

/**
 * API response for single prop.
 */
export interface PropShowResponse {
  status: 'success'
  message: string
  data: {
    prop: Prop
  }
}

/**
 * API response for user props.
 */
export interface UserPropsResponse {
  status: 'success'
  message: string
  data: {
    props: UserProp[]
    pagination: PropPagination
  }
}

/**
 * API response for equipped props.
 */
export interface EquippedPropsResponse {
  status: 'success'
  message: string
  data: {
    equipped: EquippedPropsMap
  }
}

/**
 * API response for purchase.
 */
export interface PropPurchaseResponse {
  status: 'success'
  message: string
  data: {
    user_prop_id: number
    transaction_id: number
    balance: {
      coins_before: number
      coins_after: number
    }
  }
}

/**
 * API response for equip.
 */
export interface PropEquipResponse {
  status: 'success'
  message: string
  data: {
    equipped_prop_id: number
    type: PropType
  }
}

/**
 * API response for unequip.
 */
export interface PropUnequipResponse {
  status: 'success'
  message: string
  data: null
}

// ========================================
// Store State Types
// ========================================

/**
 * Catalog pagination state.
 */
export interface CatalogState {
  items: Prop[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}

/**
 * User props pagination state.
 */
export interface UserPropsState {
  items: UserProp[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}
