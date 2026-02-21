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
  | 'chat_bubble'
  | 'entrance_effect'
  | 'nameplate'
  | 'anti_mute'
  | 'anti_kick'
  | 'mall_discount'
  | 'priority_support'
  | 'custom_room_theme'
  | 'exclusive_gifts'
  | 'profile_highlight'

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
// Recharge Progress Types
// ========================================

/**
 * Recharge target within an event.
 */
export interface RechargeTarget {
  threshold: number
  vip_level: number
  vip_name: string
  time_window_hours: number
  claimed: boolean
}

/**
 * Next unclaimed recharge target.
 */
export interface RechargeNextTarget {
  threshold: number
  remaining: number
  total_recharged: number
  vip_level: number
  vip_name: string
  time_window_hours: number
  window_started_at: string
  window_expires_at: string
}

/**
 * Recharge progress response.
 * Returned by: GET /api/v1/vip/recharge-progress
 */
export interface RechargeProgress {
  has_active_event: boolean
  event_name: string | null
  event_ends_at: string | null
  total_recharged: number
  targets: RechargeTarget[]
  next_target: RechargeNextTarget | null
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
  chat_bubble: 'Chat Bubble',
  entrance_effect: 'Entrance Effect',
  nameplate: 'Nameplate',
  anti_mute: 'Anti-Mute Protection',
  anti_kick: 'Anti-Kick Protection',
  mall_discount: 'Mall Discount',
  priority_support: 'Priority Support',
  custom_room_theme: 'Custom Room Theme',
  exclusive_gifts: 'Exclusive Gifts',
  profile_highlight: 'Profile Highlight',
}

/**
 * Icons for VIP privileges (Nuxt UI icon names).
 */
export const VIP_PRIVILEGE_ICONS: Record<VipPrivilege, string> = {
  badge: 'i-heroicons-shield-check',
  frame: 'i-heroicons-photo',
  chat_bubble: 'i-heroicons-chat-bubble-left-ellipsis',
  entrance_effect: 'i-heroicons-sparkles',
  nameplate: 'i-heroicons-identification',
  anti_mute: 'i-heroicons-speaker-wave',
  anti_kick: 'i-heroicons-shield-exclamation',
  mall_discount: 'i-heroicons-tag',
  priority_support: 'i-heroicons-lifebuoy',
  custom_room_theme: 'i-heroicons-paint-brush',
  exclusive_gifts: 'i-heroicons-gift',
  profile_highlight: 'i-heroicons-star',
}
