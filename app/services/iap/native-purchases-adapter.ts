// ========================================
// Native Purchases Adapter — @capgo/native-purchases
// ========================================
// Real StoreBillingAdapter over the Capacitor plugin. Every method imports
// the plugin dynamically so a web bundle never pulls it in at load time.
// ========================================

import { isIosNative } from '~/utils/native-platform'
import { PurchaseCancelledError, type StoreBillingAdapter } from './store-billing-adapter'
import type { StoreProduct, StoreTransaction } from '~/types/economy/iap'

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
}

function isCancelError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /cancel/i.test(message)
}

function toStoreTransaction(t: NativeTransaction): StoreTransaction {
  const id = isIosNative() ? (t.transactionId ?? '') : (t.purchaseToken ?? '')
  return {
    id,
    jws: t.jwsRepresentation,
    purchaseToken: t.purchaseToken,
    productId: t.productIdentifier ?? '',
    pending: t.purchaseState === '0',
  }
}

export function createNativePurchasesAdapter(): StoreBillingAdapter {
  async function getPlugin() {
    const { NativePurchases } = await import('@capgo/native-purchases')
    return NativePurchases
  }

  return {
    async isSupported(): Promise<boolean> {
      const plugin = await getPlugin()
      const { isBillingSupported } = await plugin.isBillingSupported()
      return isBillingSupported
    },

    async listProducts(ids: string[]): Promise<StoreProduct[]> {
      if (ids.length === 0) return []
      const plugin = await getPlugin()
      const { products } = await plugin.getProducts({ productIdentifiers: ids })
      return (products as NativeProduct[]).map(p => ({
        identifier: p.identifier,
        priceString: p.priceString,
        currencyCode: p.currencyCode,
        price: p.price,
      }))
    },

    async purchase(productId: string): Promise<StoreTransaction> {
      const plugin = await getPlugin()
      try {
        const tx = await plugin.purchaseProduct({
          productIdentifier: productId,
          isConsumable: true,
          autoAcknowledgePurchases: false,
        })
        return toStoreTransaction(tx as NativeTransaction)
      } catch (error) {
        if (isCancelError(error)) throw new PurchaseCancelledError()
        throw error
      }
    },

    async finish(tx: StoreTransaction): Promise<void> {
      const plugin = await getPlugin()
      if (isIosNative()) {
        await plugin.acknowledgePurchase({ purchaseToken: tx.id })
      } else {
        await plugin.consumePurchase({ purchaseToken: tx.purchaseToken ?? tx.id })
      }
    },

    async pendingTransactions(): Promise<StoreTransaction[]> {
      const plugin = await getPlugin()
      const { purchases } = await plugin.getPurchases({ onlyCurrentEntitlements: false })
      return (purchases as NativeTransaction[]).map(toStoreTransaction)
    },

    onTransactionUpdated(cb: (tx: StoreTransaction) => void): () => void {
      let handle: { remove: () => void } | undefined
      getPlugin().then(plugin => {
        plugin.addListener('transactionUpdated', (t: NativeTransaction) => {
          cb(toStoreTransaction(t))
        }).then(h => { handle = h })
      })
      return () => { handle?.remove() }
    },
  }
}
