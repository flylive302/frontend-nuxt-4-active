// ========================================
// Native Purchases Adapter — @capgo/native-purchases
// ========================================
// Real StoreBillingAdapter over the Capacitor plugin. Every method imports
// the plugin dynamically so a web bundle never pulls it in at load time.
// ========================================

import { App } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'
import { isIosNative } from '~/utils/native-platform'
import { createLogger } from '~/utils/logger'
import { IAP_PURCHASE_SHEET_OPEN_CEILING_MS, IAP_PURCHASE_RESUME_GRACE_MS } from '~/constants/economy/iapConstants'
import {
  PurchaseCancelledError,
  PurchaseNotCompletedError,
  PurchasePendingError,
  type StoreBillingAdapter,
} from './store-billing-adapter'
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

/**
 * Android only. The plugin's `onPurchasesUpdated` rejects EVERY non-OK Play
 * result — USER_CANCELED, ITEM_ALREADY_OWNED, ERROR, … — with this one text and
 * no code, so a cancel cannot be told apart from a real failure.
 */
function isNotPurchasedError(error: unknown): boolean {
  return /purchase is not purchased/i.test(errorMessage(error))
}

// ========================================
// Serial billing queue
// ========================================
// Android: the plugin keeps ONE shared BillingClient, and every billing method
// (isBillingSupported, getProducts, getPurchases, purchaseProduct,
// consumePurchase, acknowledgePurchase) starts by closing any existing client
// and building a new one. The Play query's callback fires after the method's
// executor task has returned, so two overlapping plugin calls cut each other
// off: `getProducts` rejects, `getPurchases` resolves an EMPTY list. Every
// billing call therefore runs through this one FIFO chain — a call starts only
// after the previous one settled (resolved or rejected).
//
// Module-level on purpose: `useCoinPurchase()` builds a fresh adapter on every
// call, so an instance-level chain would not serialize across callers.

let billingQueueTail: Promise<void> = Promise.resolve()

function runSerialized<T>(task: () => Promise<T>): Promise<T> {
  const result = billingQueueTail.then(task)
  // The tail swallows the outcome so one rejection never breaks the chain;
  // the caller still gets the untouched `result` (value or error).
  billingQueueTail = result.then(() => undefined, () => undefined)
  return result
}

// ========================================
// Android purchase hang guard
// ========================================
// The plugin only logs `launchBillingFlow`'s result: when Play refuses to open
// the sheet (already owned, billing unavailable, …) the purchase call may never
// settle, and it holds the billing queue — Restore and the pack list wait
// behind it until the app restarts. So the queue slot is released, and the
// caller gets `PurchaseNotCompletedError`, when either:
//   - `IAP_PURCHASE_SHEET_OPEN_CEILING_MS` passed with no `pause` — the sheet
//     never opened, so no resume will come either. The first `pause` stops
//     this ceiling for good: a visible sheet is never timed out;
//   - the app activity resumed (Play sheet gone) and the call is still open
//     `IAP_PURCHASE_RESUME_GRACE_MS` later — another `pause` (sheet back on
//     top) cancels that countdown.
// Capacitor's `pause`/`resume` are the main activity's onPause/onResume, which
// the sheet's overlay activity (ProxyBillingActivity) triggers.
// A release never loses money: the purchase is not consumed (isConsumable:
// false), so Play keeps listing it and restore credits it (the backend credits
// a token once). The plugin's late settle is only logged — no second verify.
// Android only: iOS settles every purchase call, and the plugin finishes iOS
// transactions itself, so a dropped late success there could be lost.

function settleOrRelease<T>(call: Promise<T>): Promise<T> {
  let released = false
  let settled = false
  let ceilingTimer: ReturnType<typeof setTimeout> | undefined
  let graceTimer: ReturnType<typeof setTimeout> | undefined
  const handles: Array<Promise<PluginListenerHandle | undefined>> = []

  function track(event: string, handle: Promise<PluginListenerHandle>): void {
    // An older shell without the App plugin rejects — the ceiling still holds.
    handles.push(handle.catch((error: unknown) => {
      log.debug(`App ${event} listener unavailable`, error)
      return undefined
    }))
  }

  const release = new Promise<never>((_, reject) => {
    const releaseWith = (reason: string) => {
      if (settled || released) return
      released = true
      log.warn(`Purchase call unsettled — releasing the billing queue (${reason})`)
      reject(new PurchaseNotCompletedError())
    }
    ceilingTimer = setTimeout(() => releaseWith('ceiling'), IAP_PURCHASE_SHEET_OPEN_CEILING_MS)
    track('resume', App.addListener('resume', () => {
      clearTimeout(graceTimer)
      if (settled) return
      graceTimer = setTimeout(() => releaseWith('resumed'), IAP_PURCHASE_RESUME_GRACE_MS)
    }))
    track('pause', App.addListener('pause', () => {
      clearTimeout(ceilingTimer)
      clearTimeout(graceTimer)
    }))
  })

  call.then(
    () => { if (released) log.info('Purchase call resolved after release — restore credits it') },
    () => { if (released) log.info('Purchase call rejected after release') },
  )

  return Promise.race([call, release]).finally(() => {
    settled = true
    clearTimeout(ceilingTimer)
    clearTimeout(graceTimer)
    for (const handle of handles) void handle.then(h => h?.remove())
  })
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
    isSupported(): Promise<boolean> {
      return runSerialized(async () => {
        const { plugin } = await getPlugin()
        const { isBillingSupported } = await plugin.isBillingSupported()
        return isBillingSupported
      })
    },

    async listProducts(ids: string[]): Promise<StoreProduct[]> {
      if (ids.length === 0) return []
      return runSerialized(async () => {
        const { plugin } = await getPlugin()
        const { products } = await plugin.getProducts({ productIdentifiers: ids })
        return (products as NativeProduct[]).map(p => ({
          identifier: p.identifier,
          priceString: p.priceString,
          currencyCode: p.currencyCode,
          price: p.price,
        }))
      })
    },

    purchase(productId: string): Promise<StoreTransaction> {
      return runSerialized(async () => {
        const { plugin } = await getPlugin()
        const ios = isIosNative()
        try {
          const call = plugin.purchaseProduct({
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
          const tx = ios ? await call : await settleOrRelease(call)
          return toStoreTransaction(tx as NativeTransaction)
        } catch (error) {
          if (error instanceof PurchaseNotCompletedError) throw error
          if (isCancelError(error)) throw new PurchaseCancelledError()
          if (isPendingError(error)) throw new PurchasePendingError()
          if (!ios && isNotPurchasedError(error)) throw new PurchaseNotCompletedError()
          throw error
        }
      })
    },

    finish(tx: StoreTransaction): Promise<void> {
      return runSerialized(async () => {
        const { plugin } = await getPlugin()
        if (isIosNative()) {
          await plugin.acknowledgePurchase({ purchaseToken: tx.id })
        } else {
          await plugin.consumePurchase({ purchaseToken: tx.purchaseToken ?? tx.id })
        }
      })
    },

    pendingTransactions(): Promise<StoreTransaction[]> {
      return runSerialized(async () => {
        const { plugin } = await getPlugin()
        const { purchases } = await plugin.getPurchases({ onlyCurrentEntitlements: false })
        return (purchases as NativeTransaction[]).map(toStoreTransaction)
      })
    },

    // Not a billing call (it only registers a JS listener) — deliberately NOT
    // queued, so it can never be blocked behind a long-running purchase.
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
