// ========================================
// VIP Level & Status Types
// ========================================

// ========================================
// Privilege Types
// ========================================

/**
 * VIP privilege identifiers matching backend VipPrivilege enum.
 */
export type VipPrivilege =
  | 'badge'
  | 'frame'
  | 'mice_wave'
  | 'entry_slide'
  | 'mice_logo'
  | 'data_card'
  | 'colourful_name'
  | 'chat_bubble'
  | 'anti_mute'
  | 'anti_kick'
  | 'forbid_tracking'
  | 'vip_gifts'
  | 'mall_discount'

// ========================================
// VIP Level Types
// ========================================

/**
 * VIP level from API.
 * Returned by: GET /api/v1/vip/levels
 */
export interface VipLevel {
  id: number
  level: number
  name: string
  color: string
  price: number
  duration_days: number
  discount_percentage: number
  privileges: VipPrivilege[]
  props: VipProp[]
  is_active: boolean
}

/**
 * Prop granted with a VIP level.
 */
export interface VipProp {
  id: number
  name: string
  type: string
  thumbnail_url: string | null
  asset_url: string | null
}

// ========================================
// VIP Status Types
// ========================================

/**
 * Current user's VIP status.
 * Returned by: GET /api/v1/vip/status
 */
export interface VipStatus {
  is_vip: boolean
  vip_level: number
  vip_level_id: number | null
  vip_expires_at: string | null
  privileges: VipPrivilege[]
  vip_level_details: {
    id: number
    name: string
    color: string
    discount_percentage: number
  } | null
}

// ========================================
// API Response Types
// ========================================

/**
 * API response wrapper for VIP endpoints.
 */
export interface VipApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

/**
 * Purchase/Gift VIP result from API.
 */
export interface VipPurchaseResult {
  vip_level: number
  vip_expires_at: string
  recipient_id?: number
}

// ========================================
// Socket Event Payload Types
// ========================================

/**
 * Payload for vip.updated socket event.
 */
export interface VipUpdatedPayload {
  vip_level: number
  vip_level_id: number | null
  vip_expires_at: string | null
  privileges: VipPrivilege[]
}

/**
 * Payload for vip.gifted socket event.
 */
export interface VipGiftedPayload {
  vip_level: number
  sender_id: number
  sender_name: string
  sender_avatar: string | null
  vip_expires_at: string | null
}

// ========================================
// Display Helpers
// ========================================

/**
 * Human-readable labels for VIP privileges.
 */
export const VIP_PRIVILEGE_LABELS: Record<VipPrivilege, string> = {
  badge: 'VIP Badge',
  frame: 'Profile Frame',
  mice_wave: 'Mic Wave Effect',
  entry_slide: 'Entry Slide',
  mice_logo: 'Mic Logo',
  data_card: 'Data Card',
  colourful_name: 'Colourful Name',
  chat_bubble: 'Chat Bubble',
  anti_mute: 'Anti-Mute Protection',
  anti_kick: 'Anti-Kick Protection',
  forbid_tracking: 'Forbid Tracking',
  vip_gifts: 'VIP Exclusive Gifts',
  mall_discount: 'Mall Discount',
}

/**
 * Icons for VIP privileges (Nuxt UI icon names).
 */
export const VIP_PRIVILEGE_ICONS: Record<VipPrivilege, string> = {
  badge: 'i-heroicons-shield-check',
  frame: 'https://ik.imagekit.io/flylive/vip/icons/exclusive-headwear-active.png',
  mice_wave: 'i-heroicons-signal',
  entry_slide: 'i-heroicons-sparkles',
  mice_logo: 'i-heroicons-microphone',
  data_card: 'i-heroicons-identification',
  colourful_name: 'i-heroicons-paint-brush',
  chat_bubble: 'i-heroicons-chat-bubble-left-ellipsis',
  anti_mute: 'i-heroicons-speaker-wave',
  anti_kick: 'i-heroicons-shield-exclamation',
  forbid_tracking: 'i-heroicons-eye-slash',
  vip_gifts: 'i-heroicons-gift',
  mall_discount: 'i-heroicons-tag',
}
