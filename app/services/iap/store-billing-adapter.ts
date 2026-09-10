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

export interface StoreBillingAdapter {
  isSupported(): Promise<boolean>
  listProducts(ids: string[]): Promise<StoreProduct[]>
  purchase(productId: string): Promise<StoreTransaction>
  finish(tx: StoreTransaction): Promise<void>
  pendingTransactions(): Promise<StoreTransaction[]>
  /** Returns an unsubscribe function. */
  onTransactionUpdated(cb: (tx: StoreTransaction) => void): () => void
}
