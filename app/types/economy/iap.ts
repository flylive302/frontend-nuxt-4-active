// ========================================
// In-App Purchase (IAP) Types
// ========================================
// Shapes for the native "Buy Coins" flow: backend pack catalog, store
// (StoreKit/Play Billing) products, and the verify round-trip.
// ========================================

export type IapStore = 'apple' | 'google'

/** Backend coin pack shape — `GET /api/v1/iap/packs?store=apple`. */
export interface CoinPack {
  id: number
  store: IapStore
  product_id: string
  name: string
  coins: number
  display_order: number
}

/** Store-native product info (price, currency) resolved via the billing adapter. */
export interface StoreProduct {
  identifier: string
  priceString: string
  currencyCode: string
  price: number
}

/** A pending or completed store transaction, adapter-normalized. */
export interface StoreTransaction {
  /** iOS: transactionId. Android: purchaseToken (used as the id). */
  id: string
  /** iOS StoreKit 2 JWS representation — sent to the backend for verification. */
  jws?: string
  /** Android purchase token — needed separately from `id` for `consumePurchase`. */
  purchaseToken?: string
  productId: string
  /** True while the store itself has not finalized the purchase (e.g. Ask to Buy). */
  pending: boolean
}

export interface IapPurchase {
  id: number
  store: IapStore
  product_id: string
  coins: number
  state: string
  store_transaction_id: string
  failure_reason: string | null
}

export interface IapVerifyResponse {
  outcome: 'credited' | 'already_credited' | string
  purchase: IapPurchase
  balance: number | null
}

export type PurchaseStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'purchasing'
  | 'pending-store'
  | 'success'
  | 'failed'
  | 'unavailable'
