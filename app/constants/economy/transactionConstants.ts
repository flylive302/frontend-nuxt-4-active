// ========================================
// Transaction Constants
// ========================================
// Static values and configuration maps.
// No imports from stores or composables.
// ========================================

import type { IapStore } from '~/types/economy/iap'
import type { RareIdTransactionType, TransactionType, TransactionTypeFilter } from '~/types/economy/wallet'

// ========================================
// Display Labels
// ========================================

/**
 * Human-readable labels for transaction types.
 */
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  gift: 'Gift',
  room_commission: 'Room Commission',
  coin_transfer: 'Coin Transfer',
  diamond_exchange: 'Diamond Exchange',
  system_reward: 'System Reward',
  system_generation: 'Coin Generation',
  agency_income: 'Agency Income',
  reward_claim: 'Reward Claimed',
  target_refund: 'Target Refund',
  owner_bonus: 'Owner Bonus',
  prop_purchase: 'Prop Purchase',
  prop_gift: 'Prop Gift',
  vip_purchase: 'VIP Purchase',
  vip_gift: 'VIP Gift',
  store_purchase: 'Coin Pack',
  store_refund: 'Store Refund',
  game_bet: 'Game Bet',
  game_win: 'Game Win',
  lucky_payout: 'Lucky Cashback',
  rare_id_entry_fee: 'Rare ID Auction Entry',
  rare_id_bid_hold: 'Rare ID Bid Held',
  rare_id_bid_refund: 'Rare ID Bid Refund',
  rare_id_entry_refund: 'Rare ID Entry Refund',
  manual_adjustment: 'Balance Adjustment',
  diamond_deduction: 'Diamonds Sold',
  diamond_to_coin_conversion: 'Diamonds Converted',
  diamond_handover: 'Diamond Handover',
}

// ========================================
// Store-specific labels (store_purchase / store_refund)
// ========================================
// TRANSACTION_TYPE_LABELS above is generic ("Coin Pack", "Store Refund") and
// has no way to name the store. These are looked up by `transaction.metadata.store`
// in getTransactionLabel() (utils/economy/transactionHelpers.ts) so history rows
// can say which store sold or refunded the coins.

/** Labels for `store_purchase`, keyed by `metadata.store`. */
export const STORE_PURCHASE_LABELS: Record<IapStore, string> = {
  apple: 'Coin pack (App Store)',
  google: 'Coin pack (Google Play)',
}

/** Labels for `store_refund`, keyed by `metadata.store`. */
export const STORE_REFUND_LABELS: Record<IapStore, string> = {
  apple: 'Refunded by App Store',
  google: 'Refunded by Google Play',
}

// ========================================
// Rare ID auction labels (rare_id_*)
// ========================================
// The backend's stored `description` already names the Rare ID. These are the
// fallback when it is empty: getTransactionLabel() builds
// "Rare ID <metadata.rare_id> <suffix>" so the row still names the Rare ID.

/** Suffix after "Rare ID <id>", keyed by transaction type. */
export const RARE_ID_LABEL_SUFFIXES: Record<RareIdTransactionType, string> = {
  rare_id_entry_fee: 'auction entry fee',
  rare_id_bid_hold: 'bid',
  rare_id_bid_refund: 'bid refund',
  rare_id_entry_refund: 'entry fee refund',
}

// ========================================
// Display Colors
// ========================================

/**
 * Colors for transaction types (Tailwind classes).
 */
export const TRANSACTION_TYPE_COLORS: Record<TransactionType, string> = {
  gift: 'text-pink-500',
  room_commission: 'text-blue-500',
  coin_transfer: 'text-green-500',
  diamond_exchange: 'text-secondary-100',
  system_reward: 'text-yellow-500',
  system_generation: 'text-green-500',
  agency_income: 'text-purple-500',
  reward_claim: 'text-yellow-500',
  target_refund: 'text-orange-500',
  owner_bonus: 'text-amber-500',
  prop_purchase: 'text-indigo-500',
  prop_gift: 'text-indigo-400',
  vip_purchase: 'text-amber-600',
  vip_gift: 'text-amber-400',
  store_purchase: 'text-emerald-400',
  store_refund: 'text-rose-400',
  game_bet: 'text-violet-400',
  game_win: 'text-violet-300',
  lucky_payout: 'text-yellow-400',
  rare_id_entry_fee: 'text-fuchsia-400',
  rare_id_bid_hold: 'text-fuchsia-400',
  rare_id_bid_refund: 'text-fuchsia-300',
  rare_id_entry_refund: 'text-fuchsia-300',
  manual_adjustment: 'text-neutral-400',
  diamond_deduction: 'text-secondary-200',
  diamond_to_coin_conversion: 'text-secondary-200',
  diamond_handover: 'text-secondary-200',
}

// ========================================
// Filter Configuration
// ========================================

export interface FilterTab {
  label: string
  value: TransactionTypeFilter
  icon: string
  /** Shown in the empty state when the tab has no rows. */
  emptyHint: string
}

/**
 * Filter tabs for the activity page, ordered by how often users look for
 * them. Buckets are user intent ("what came in / what I spent"), not raw
 * ledger types — the backend maps each bucket to the real transaction types.
 */
export const FILTER_TABS: FilterTab[] = [
  { label: 'All', value: 'all', icon: 'i-lucide-list', emptyHint: 'Your coin activity will appear here.' },
  { label: 'Received', value: 'received', icon: 'i-lucide-arrow-down-left', emptyHint: 'Gifts, transfers and earnings you receive show up here.' },
  { label: 'Sent', value: 'sent', icon: 'i-lucide-arrow-up-right', emptyHint: 'Gifts and coins you send show up here.' },
  { label: 'Purchases', value: 'purchases', icon: 'i-lucide-shopping-bag', emptyHint: 'Coin packs, VIP and props you buy show up here.' },
  { label: 'Games', value: 'games', icon: 'i-lucide-gamepad-2', emptyHint: 'Game bets and wins show up here.' },
  { label: 'Diamonds', value: 'diamonds', icon: 'i-lucide-gem', emptyHint: 'Diamond exchanges and sales show up here.' },
]
