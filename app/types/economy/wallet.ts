// ========================================
// Wallet & Transaction Types (API v2)
// ========================================

// ========================================
// Balance & XP Types
// ========================================

/**
 * Represents a balance snapshot with before/after values.
 */
export interface BalanceSnapshot {
  before: number
  after: number
}

/**
 * Current user's balance changes in a transaction.
 */
export interface MyBalance {
  coins: BalanceSnapshot | null
  diamonds: BalanceSnapshot | null
}

/**
 * Current user's XP changes in a transaction.
 */
export interface MyXP {
  wealth: BalanceSnapshot | null
  charm: BalanceSnapshot | null
}

/**
 * Transaction amount from current user's perspective.
 */
export interface TransactionAmount {
  value: number // Negative = spent, Positive = gained
  currency: 'coins' | 'diamonds'
  formatted: string // Pre-formatted with sign
}

// ========================================
// User Types
// ========================================

/**
 * Other party in the transaction (identity only, no balance/XP).
 */
export interface OtherParty {
  id: number
  name: string
  signature: string
  avatar_url: string | null
}

// ========================================
// Transaction Types
// ========================================

/**
 * Current user's role in the transaction.
 */
export type TransactionRole = 'initiator' | 'beneficiary'

/**
 * Transaction status.
 */
export type TransactionStatus = 'pending' | 'completed' | 'failed'

/**
 * All possible transaction types from the API.
 */
export type TransactionType =
  | 'gift'
  | 'room_commission'
  | 'coin_transfer'
  | 'diamond_exchange'
  | 'system_reward'
  | 'system_generation'
  | 'agency_income'
  | 'reward_claim'
  | 'target_refund'
  | 'owner_bonus'
  | 'prop_purchase'
  | 'prop_gift'
  | 'vip_purchase'
  | 'vip_gift'

/**
 * Filter options for transaction history.
 */
export type TransactionTypeFilter =
  | 'all'
  | 'coins'
  | 'diamonds'
  | 'gift'
  | 'room_commission'
  | 'agency_income'
  | 'coin_transfer'

/**
 * Additional metadata attached to transactions.
 */
export interface TransactionMetadata {
  gift_id?: number
  gift_name?: string
  quantity?: number
  room_id?: number
  room_name?: string
  diamonds_deducted?: number
  coins_received?: number
  exchange_rate?: number
  [key: string]: unknown
}

/**
 * Single transaction record from API (v2 - perspective-aware).
 */
export interface Transaction {
  id: string
  type: TransactionType
  timestamp: string // ISO 8601
  title: string
  description: string
  thumbnail_url?: string
  status: TransactionStatus
  my_role: TransactionRole
  amount: TransactionAmount
  my_balance: MyBalance | null
  my_xp: MyXP | null
  other_party: OtherParty | null
  metadata: TransactionMetadata
}

/**
 * Transactions grouped by date from API.
 */
export interface TransactionsByDate {
  date: string // YYYY-MM-DD
  date_formatted: string // e.g., "10 January, 2026"
  transactions: Transaction[]
}

/**
 * Transaction summary statistics (matches backend response shape).
 */
export interface TransactionSummary {
  coins: {
    total_earned: number
    total_spent: number
    transaction_count: number
  }
  diamonds: {
    total_earned: number
    transaction_count: number
  }
  gifts: {
    total_sent: number
    total_received: number
  }
}

// ========================================
// API Request/Response Types
// ========================================

/**
 * Parameters for fetching transactions.
 */
export interface GetTransactionsParams {
  type?: TransactionTypeFilter
  page?: number
  per_page?: number
  cursor?: string
  date_from?: string
  date_to?: string
  sort?: 'newest' | 'oldest'
}

/**
 * Pagination metadata from API.
 */
export interface TransactionPagination {
  current_page: number
  per_page: number
  total_pages?: number
  total_transactions?: number
  has_more: boolean
  next_cursor?: string
}

/**
 * API response for transaction list.
 */
export interface TransactionsResponse {
  success: true
  data: {
    transactions_by_date: TransactionsByDate[]
    pagination: TransactionPagination
  }
}

/**
 * API response for transaction summary.
 */
export interface TransactionSummaryResponse {
  success: true
  data: TransactionSummary
}
