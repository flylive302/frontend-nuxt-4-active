// ========================================
// Store Billing Adapter — interface
// ========================================
// EXECUTE-stage boundary between `useCoinPurchase` and the native store SDK.
// Lets the composable stay testable (fake adapter) and keeps the real
// `@capgo/native-purchases` import out of anything that touches the web
// bundle (see native-purchases-adapter.ts).
// ========================================

import type { StoreProduct, StoreTransaction } from '~/types/economy/iap'

/** Thrown by `purchase()` when the user dismisses/cancels the store sheet. */
export class PurchaseCancelledError extends Error {
  constructor(message = 'Purchase cancelled') {
    super(message)
    this.name = 'PurchaseCancelledError'
  }
}

/**
 * Thrown by `purchase()` when the store accepted the order but has not charged
 * yet (Ask to Buy, a slow payment method). The transaction arrives later —
 * `onTransactionUpdated` on iOS, the store's pending list on Android.
 */
export class PurchasePendingError extends Error {
  constructor(message = 'Purchase pending') {
    super(message)
    this.name = 'PurchasePendingError'
  }
}

/**
 * Thrown by `purchase()` when the store gave no usable outcome: Android's
 * billing plugin rejects cancel, already-owned and every other Play failure
 * with the same text, and a purchase call that never settles is released after
 * a hang guard (see native-purchases-adapter.ts). Nothing was credited here;
 * the caller resets the UI and runs restore, which credits anything Play does
 * hold (the backend credits a token once).
 */
export class PurchaseNotCompletedError extends Error {
  constructor(message = 'Purchase not completed') {
    super(message)
    this.name = 'PurchaseNotCompletedError'
  }
}

export interface StoreBillingAdapter {
  isSupported(): Promise<boolean>
  listProducts(ids: string[]): Promise<StoreProduct[]>
  purchase(productId: string): Promise<StoreTransaction>
  finish(tx: StoreTransaction): Promise<void>
  pendingTransactions(): Promise<StoreTransaction[]>
  /** Returns an unsubscribe function. */
  onTransactionUpdated(cb: (tx: StoreTransaction) => void): () => void
}
