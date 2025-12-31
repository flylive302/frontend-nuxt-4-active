// ========================================
// Wallet & Transaction Types
// ========================================

// ========================================
// Balance Types
// ========================================

/**
 * Represents a change in balance (before/after/total).
 * Used for displaying balance changes in transaction history.
 */
export interface BalanceChange {
  before: string
  after: string
  change: string // API returns 'change', not 'total'
}

/**
 * Collection of all possible balance changes in a transaction.
 */
export interface BalanceChanges {
  coins?: BalanceChange | null
  diamonds?: BalanceChange | null
  wealth_xp?: BalanceChange | null
  charm_xp?: BalanceChange | null
}

// ========================================
// User Types (for transaction participants)
// ========================================

/**
 * Minimal user info for transaction participants.
 */
export interface TransactionUser {
  id: number
  name: string
  signature?: string
  avatar_url?: string | null
}

// ========================================
// Transaction Types
// ========================================

/**
 * All possible transaction types from the API.
 */
export type TransactionType =
  | 'coin_purchase'
  | 'gift_send'
  | 'gift_receive'
  | 'room_commission'
  | 'agency_income'
  | 'transfer'
  | 'reward_claim'
  | 'target_refund'
  | 'system_reward'
  | 'system_generation'

/**
 * Filter options for transaction history.
 */
export type TransactionTypeFilter = 'all' | 'coins' | 'diamonds' | 'gifts'

/**
 * Additional metadata attached to transactions.
 */
export interface TransactionMetadata {
  gift_id?: number
  gift_name?: string
  quantity?: number
  room_id?: number
  room_name?: string
  [key: string]: unknown
}

/**
 * Single transaction record from API.
 */
export interface Transaction {
  id: string
  type: TransactionType
  timestamp: string // ISO 8601
  title: string
  description: string
  thumbnail_url?: string
  initiator?: TransactionUser
  concerned_party?: TransactionUser | null
  balance_changes: BalanceChanges
  metadata: TransactionMetadata
}

/**
 * Transactions grouped by date from API.
 */
export interface TransactionsByDate {
  date: string // YYYY-MM-DD
  date_formatted: string // e.g., "29 December, 2025"
  transactions: Transaction[]
}

/**
 * Transaction summary statistics.
 */
export interface TransactionSummary {
  total_sent: string
  total_received: string
  total_transactions: number
  by_type: Partial<Record<TransactionType, number>>
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
  per_page?: number // max 50
  cursor?: string
  date_from?: string // YYYY-MM-DD
  date_to?: string // YYYY-MM-DD
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

// ========================================
// Display Helpers
// ========================================

/**
 * Human-readable labels for transaction types.
 */
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  coin_purchase: 'Coins Purchased',
  gift_send: 'Gift Sent',
  gift_receive: 'Gift Received',
  room_commission: 'Room Commission',
  agency_income: 'Agency Income',
  transfer: 'Transfer',
  reward_claim: 'Reward Claimed',
  target_refund: 'Target Refund',
  system_reward: 'System Reward',
  system_generation: 'Coin Generation',
}

/**
 * Colors for transaction types (Tailwind classes).
 */
export const TRANSACTION_TYPE_COLORS: Record<TransactionType, string> = {
  coin_purchase: 'text-green-500',
  gift_send: 'text-red-500',
  gift_receive: 'text-green-500',
  room_commission: 'text-blue-500',
  agency_income: 'text-purple-500',
  transfer: 'text-gray-500',
  reward_claim: 'text-yellow-500',
  target_refund: 'text-orange-500',
  system_reward: 'text-yellow-500',
  system_generation: 'text-green-500',
}

// ========================================
// Legacy Types (for backward compatibility)
// ========================================

/**
 * @deprecated Use Transaction instead. Kept for backward compatibility.
 */
export interface WalletTransaction {
  time: string
  title: string
  thumbnail: string
  itemsInvolved?: string
  initiator: string
  concerned: string
  coins: BalanceChange
  diamonds?: BalanceChange | null
  wealthXp?: BalanceChange | null
  charmXp?: BalanceChange | null
}

/**
 * @deprecated Use TransactionsByDate instead. Kept for backward compatibility.
 */
export interface TransactionDay {
  date: string
  transactions: WalletTransaction[]
}
