// ========================================
// Transaction Constants
// ========================================
// Static values and configuration maps.
// No imports from stores or composables.
// ========================================

import type { TransactionType, TransactionTypeFilter } from '~/types/economy/wallet'

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
}

// ========================================
// Filter Configuration
// ========================================

export interface FilterTab {
  label: string
  value: TransactionTypeFilter
}

/**
 * Available filter tabs for transaction history page.
 */
export const FILTER_TABS: FilterTab[] = [
  { label: 'All', value: 'all' },
  { label: 'Coin Transfer', value: 'coin_transfer' },
  { label: 'Gifts', value: 'gift' },
  { label: 'Room Commission', value: 'room_commission' },
  { label: 'Agency Income', value: 'agency_income' },
  { label: 'Diamonds', value: 'diamonds' },
]
