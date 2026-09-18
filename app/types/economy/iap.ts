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
  /** Store purchase date (ISO 8601) when the store reports one — restore submits newest first. */
  purchasedAt?: string
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
  /**
   * Whether the device transaction should be finished/acknowledged/consumed.
   * `true` for a row that is settled either way (credited, already-settled
   * replay, or a rejected purchase the store should stop nagging about);
   * `false` while the row is still being retried (daily cap, transient
   * failure) — finishing it there would silently drop the user's paid coins.
   */
  finish: boolean
}

/**
 * One item of `POST /iap/{store}/restore`'s `transactions` array.
 * Per `RestoreStorePurchasesRequest::rules()`, the required fields differ
 * by store: apple validates `transaction_id` (+ optional `signed_transaction`
 * / `product_id`); google requires BOTH `purchase_token` and `product_id`.
 */
export interface IapRestoreItem {
  transaction_id?: string
  signed_transaction?: string
  purchase_token?: string
  product_id?: string
}

/** Per-transaction outcome in a restore response, matched back to the device
 *  transaction via `transaction_id` (echoes what was sent). */
export interface IapRestoreResult {
  transaction_id: string
  outcome: string
  finish: boolean
  purchase: IapPurchase | null
}

export interface IapRestoreResponse {
  results: IapRestoreResult[]
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
