// ========================================
// Native Purchases Adapter — @capgo/native-purchases
// ========================================
// Real StoreBillingAdapter over the Capacitor plugin. Every method imports
// the plugin dynamically so a web bundle never pulls it in at load time.
// ========================================

import { isIosNative } from '~/utils/native-platform'
import { createLogger } from '~/utils/logger'
import { PurchaseCancelledError, PurchasePendingError, type StoreBillingAdapter } from './store-billing-adapter'
import type { StoreProduct, StoreTransaction } from '~/types/economy/iap'

const log = createLogger('[NativePurchases]')

/**
 * Play Billing's client-side `Purchase.PurchaseState.PENDING` (1 = PURCHASED,
 * 0 = UNSPECIFIED) — not the server API's 0/1/2. StoreKit sends no purchaseState.
 */
const ANDROID_PURCHASE_STATE_PENDING = '2'

// ========================================
// Shape of what the plugin returns (per src/definitions.ts)
// ========================================

interface NativeProduct {
  identifier: string
  title?: string
  description?: string
  price: number
  priceString: string
  currencyCode: string
}

interface NativeTransaction {
  transactionId?: string
  jwsRepresentation?: string
  purchaseToken?: string
  purchaseState?: string
  productIdentifier?: string
  purchaseDate?: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isCancelError(error: unknown): boolean {
  return /cancel/i.test(errorMessage(error))
}

/** iOS rejects "Transaction pending", Android "Purchase is pending". */
function isPendingError(error: unknown): boolean {
  return /pending/i.test(errorMessage(error))
}

function toStoreTransaction(t: NativeTransaction): StoreTransaction {
  const id = isIosNative() ? (t.transactionId ?? '') : (t.purchaseToken ?? '')
  return {
    id,
    jws: t.jwsRepresentation,
    purchaseToken: t.purchaseToken,
    productId: t.productIdentifier ?? '',
    pending: t.purchaseState === ANDROID_PURCHASE_STATE_PENDING,
    purchasedAt: t.purchaseDate,
  }
}

export function createNativePurchasesAdapter(): StoreBillingAdapter {
  // Returns the plugin WRAPPED, never bare. A Capacitor plugin is a Proxy that
  // answers every property with a native-method wrapper — including `then`. An
  // async function resolving to the bare proxy makes the engine treat it as a
  // thenable and call `NativePurchases.then()`, which rejects "not implemented"
  // without ever settling the outer promise: every `await getPlugin()` hangs.
  async function getPlugin() {
    const { NativePurchases } = await import('@capgo/native-purchases')
    return { plugin: NativePurchases }
  }

  return {
    async isSupported(): Promise<boolean> {
      const { plugin } = await getPlugin()
      const { isBillingSupported } = await plugin.isBillingSupported()
      return isBillingSupported
    },

    async listProducts(ids: string[]): Promise<StoreProduct[]> {
      if (ids.length === 0) return []
      const { plugin } = await getPlugin()
      const { products } = await plugin.getProducts({ productIdentifiers: ids })
      return (products as NativeProduct[]).map(p => ({
        identifier: p.identifier,
        priceString: p.priceString,
        currencyCode: p.currencyCode,
        price: p.price,
      }))
    },

    async purchase(productId: string): Promise<StoreTransaction> {
      const { plugin } = await getPlugin()
      try {
        const tx = await plugin.purchaseProduct({
          productIdentifier: productId,
          // Deliberately false although the packs are consumables. On Android
          // the plugin consumes a purchase flagged consumable the moment Play
          // reports it (PurchaseActionDecider: isConsumable → CONSUME, which
          // ignores autoAcknowledgePurchases) — before the backend has
          // verified it, and the backend refuses a consumed token as
          // `already_consumed`: paid, never credited. The backend consumes
          // after crediting; `finish()` consumes on the device. iOS ignores it.
          isConsumable: false,
          autoAcknowledgePurchases: false,
        })
        return toStoreTransaction(tx as NativeTransaction)
      } catch (error) {
        if (isCancelError(error)) throw new PurchaseCancelledError()
        if (isPendingError(error)) throw new PurchasePendingError()
        throw error
      }
    },

    async finish(tx: StoreTransaction): Promise<void> {
      const { plugin } = await getPlugin()
      if (isIosNative()) {
        await plugin.acknowledgePurchase({ purchaseToken: tx.id })
      } else {
        await plugin.consumePurchase({ purchaseToken: tx.purchaseToken ?? tx.id })
      }
    },

    async pendingTransactions(): Promise<StoreTransaction[]> {
      const { plugin } = await getPlugin()
      const { purchases } = await plugin.getPurchases({ onlyCurrentEntitlements: false })
      return (purchases as NativeTransaction[]).map(toStoreTransaction)
    },

    onTransactionUpdated(cb: (tx: StoreTransaction) => void): () => void {
      let handle: { remove: () => void } | undefined
      // Registered on every native launch (plugins/iap-restore.client.ts), so a
      // shell without the billing plugin (every store build before IAP) must
      // not reject unhandled: Capacitor rejects `addListener` as UNIMPLEMENTED.
      getPlugin()
        .then(({ plugin }) => plugin.addListener('transactionUpdated', (t: NativeTransaction) => {
          cb(toStoreTransaction(t))
        }))
        .then((h) => { handle = h })
        .catch((error: unknown) => log.debug('transactionUpdated listener unavailable', error))
      return () => { handle?.remove() }
    },
  }
}
