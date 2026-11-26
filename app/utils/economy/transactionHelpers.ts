// ========================================
// Transaction Helper Functions (Pure Utils)
// ========================================
// No reactivity, no store imports — pure functions only.
// ========================================

import {
  RARE_ID_LABEL_SUFFIXES,
  STORE_PURCHASE_LABELS,
  STORE_REFUND_LABELS,
  TRANSACTION_TYPE_LABELS,
} from '~/constants/economy/transactionConstants'
import type { IapStore } from '~/types/economy/iap'
import type { RareIdTransactionType, Transaction } from '~/types/economy/wallet'

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

/**
 * Resolve which store a `store_purchase` / `store_refund` transaction ran
 * through. Prefers `metadata.store` (the enum value); falls back to parsing
 * `metadata.channel` (`iap_apple` / `iap_google`) for older rows that only
 * set the channel. Returns `null` when neither is present or recognized.
 */
function resolveIapStore(transaction: Transaction): IapStore | null {
  const { store, channel } = transaction.metadata

  if (store === 'apple' || store === 'google') return store
  if (channel === 'iap_apple') return 'apple'
  if (channel === 'iap_google') return 'google'
  return null
}

/** True for the four Rare ID auction ledger types. */
export function isRareIdTransaction(
  transaction: Transaction,
): transaction is Transaction & { type: RareIdTransactionType } {
  return transaction.type in RARE_ID_LABEL_SUFFIXES
}

/**
 * Rare ID from `metadata.rare_id`, or null when absent/blank. Kept as a string:
 * Rare IDs can carry significant leading zeros.
 */
function resolveRareId(transaction: Transaction): string | null {
  const { rare_id: rareId } = transaction.metadata
  if (typeof rareId === 'string' && rareId.trim() !== '') return rareId.trim()
  if (typeof rareId === 'number') return String(rareId)
  return null
}

/**
 * Type-to-label lookup, store-aware for `store_purchase` / `store_refund`
 * (e.g. "Coin pack (App Store)", "Refunded by Google Play"). Every other
 * type falls back to the flat TRANSACTION_TYPE_LABELS map.
 */
export function getTransactionLabel(transaction: Transaction): string {
  const store = resolveIapStore(transaction)

  if (transaction.type === 'store_purchase' && store) return STORE_PURCHASE_LABELS[store]
  if (transaction.type === 'store_refund' && store) return STORE_REFUND_LABELS[store]

  if (isRareIdTransaction(transaction)) {
    const rareId = resolveRareId(transaction)
    if (rareId) return `Rare ID ${rareId} ${RARE_ID_LABEL_SUFFIXES[transaction.type]}`
  }

  return TRANSACTION_TYPE_LABELS[transaction.type] ?? 'Transaction'
}

/**
 * Primary line of an activity row. Store rows: store-specific label. Rare ID
 * auction rows: the backend description (names the Rare ID), else a label built
 * from `metadata.rare_id` — never the backend title, which omits the ID. Every
 * other type: description, then title, then the type label.
 */
export function getTransactionHeadline(transaction: Transaction): string {
  if (transaction.type === 'store_purchase' || transaction.type === 'store_refund') {
    return getTransactionLabel(transaction)
  }
  if (isRareIdTransaction(transaction)) return transaction.description || getTransactionLabel(transaction)

  return transaction.description
    || transaction.title
    || TRANSACTION_TYPE_LABELS[transaction.type]
    || 'Transaction'
}
