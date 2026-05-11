/**
 * TypeScript types for Coin Request API
 */

// ========================================
// Status & Type Definitions
// ========================================

export type CoinRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired'

export type CoinRequestType = 'grant'

// ========================================
// Entity Types
// ========================================

/**
 * User info embedded in coin request responses
 */
export interface CoinRequestUser {
  id: number
  name: string
  avatar: string | null
}

/**
 * Full coin request object from API
 */
export interface CoinRequest {
  id: number
  user: CoinRequestUser
  reviewer: CoinRequestUser
  amount: string
  approved_amount: string | null
  final_amount: string
  was_adjusted: boolean
  type: {
    value: CoinRequestType
    label: string
  }
  status: {
    value: CoinRequestStatus
    label: string
    color: string
    is_final: boolean
  }
  message: string | null
  admin_note: string | null
  processor: {
    id: number
    name: string
  } | null
  processed_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

// ========================================
// Request Payloads
// ========================================

/**
 * Payload for creating a new coin grant request.
 * Backend automatically uses the user's default reviewer.
 */
export interface CreateCoinRequestPayload {
  amount: number
  message?: string
}

// ========================================
// API Response Types
// ========================================

/**
 * Standard API response wrapper
 * Note: Backend returns status: "success" not success: boolean
 */
export interface CoinRequestApiResponse<T> {
  status: string  // "success" or error status
  message: string
  data: T
  meta?: {
    timestamp: string
    correlation_id: string
  }
}

/**
 * Paginated API response for listing requests
 * Note: Backend returns status: "success" not success: boolean
 */
export interface CoinRequestPaginatedResponse<T> {
  status: string  // "success" or error status
  message: string
  data: T[]
  meta: {
    current_page: number
    from: number
    last_page: number
    per_page: number
    to: number
    total: number
  }
}

// ========================================
// UI Helpers
// ========================================

/**
 * Status colors for UI badges
 */
export const STATUS_COLORS = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  cancelled: 'neutral',
  expired: 'neutral'
} as const

/**
 * Type colors for UI badges
 */
export const TYPE_COLORS: Record<CoinRequestType, string> = {
  grant: 'success',
}
