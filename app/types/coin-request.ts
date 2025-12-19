/**
 * TypeScript types for Coin Request API
 * @see docs/Backend-Team/new-feature-implementation-complete-guide.md
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

export type CoinRequestType = 'cash' | 'credit'

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
 * Proof image attached to a coin request
 */
export interface CoinRequestProof {
  url: string
  file_id: string
  uploaded_at: string
}

/**
 * Full coin request object from API
 */
export interface CoinRequest {
  id: number
  user: CoinRequestUser
  reseller: CoinRequestUser
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
  proofs: CoinRequestProof[] | null
  credit_days: number | null
  is_repaid: boolean
  repaid_at: string | null
  is_repayment_due: boolean
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
 * Payload for creating a new coin request
 * Note: reseller_id is optional - backend uses user's default reseller
 */
export interface CreateCoinRequestPayload {
  amount: number
  message?: string
  proofs?: File[]
  reseller_id?: number
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
export const STATUS_COLORS: Record<CoinRequestStatus, string> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  cancelled: 'neutral',
  expired: 'neutral'
}

/**
 * Type colors for UI badges
 */
export const TYPE_COLORS: Record<CoinRequestType, string> = {
  cash: 'success',
  credit: 'info'
}
