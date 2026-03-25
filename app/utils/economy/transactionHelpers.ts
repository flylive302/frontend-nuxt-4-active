// ========================================
// Transaction Helper Functions (Pure Utils)
// ========================================
// No reactivity, no store imports — pure functions only.
// ========================================

import type { Transaction } from '~/types/economy/wallet'

/**
 * Check if transaction is positive (user gained) or negative (user spent).
 */
export function isPositiveTransaction(transaction: Transaction): boolean {
  return transaction.amount.value >= 0
}

/**
 * Get the display name for the other party, or fallback.
 */
export function getOtherPartyDisplay(transaction: Transaction): string {
  if (!transaction.other_party) return 'System'
  return transaction.other_party.signature || transaction.other_party.name
}
