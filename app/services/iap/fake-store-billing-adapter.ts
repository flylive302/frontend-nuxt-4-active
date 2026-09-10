// ========================================
// Fake Store Billing Adapter — test double
// ========================================
// In-memory StoreBillingAdapter for composable/unit tests. Scripted
// behaviours let a test drive purchase(), finish(), and the
// transactionUpdated listener without the real Capacitor plugin.
// ========================================

import { PurchaseCancelledError, type StoreBillingAdapter } from './store-billing-adapter'
import type { StoreProduct, StoreTransaction } from '~/types/economy/iap'

export type FakePurchaseResult = 'ok' | 'cancel' | 'pending' | 'error'

export interface FakeStoreBillingAdapterOptions {
  products?: StoreProduct[]
  purchaseResult?: FakePurchaseResult
  supported?: boolean
  pendingTransactions?: StoreTransaction[]
}

export class FakeStoreBillingAdapter implements StoreBillingAdapter {
  products: StoreProduct[]
  purchaseResult: FakePurchaseResult
  supported: boolean
  finished: string[] = []
  private pending: StoreTransaction[]
  private listeners: Array<(tx: StoreTransaction) => void> = []
  private txCounter = 0

  constructor(options: FakeStoreBillingAdapterOptions = {}) {
    this.products = options.products ?? []
    this.purchaseResult = options.purchaseResult ?? 'ok'
    this.supported = options.supported ?? true
    this.pending = options.pendingTransactions ?? []
  }

  async isSupported(): Promise<boolean> {
    return this.supported
  }

  async listProducts(ids: string[]): Promise<StoreProduct[]> {
    return this.products.filter(p => ids.includes(p.identifier))
  }

  async purchase(productId: string): Promise<StoreTransaction> {
    if (this.purchaseResult === 'cancel') throw new PurchaseCancelledError()
    if (this.purchaseResult === 'error') throw new Error('purchase failed')

    this.txCounter += 1
    const tx: StoreTransaction = {
      id: `tx-${this.txCounter}`,
      jws: `jws-${this.txCounter}`,
      purchaseToken: `token-${this.txCounter}`,
      productId,
      pending: this.purchaseResult === 'pending',
    }
    return tx
  }

  async finish(tx: StoreTransaction): Promise<void> {
    this.finished.push(tx.id)
  }

  async pendingTransactions(): Promise<StoreTransaction[]> {
    return this.pending
  }

  onTransactionUpdated(cb: (tx: StoreTransaction) => void): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb)
    }
  }

  /** Test helper — simulates the native `transactionUpdated` event firing. */
  emitTransactionUpdated(tx: StoreTransaction): void {
    for (const listener of this.listeners) listener(tx)
  }
}
