// ========================================
// Coin Purchase Composable
// ========================================
// GATE → EXECUTE → REACT pipeline for the native "Buy Coins" flow.
// Each function below is ONE stage — see CLAUDE.md's INTENT/GATE/EXECUTE/REACT rule.
// ========================================

import { createNativePurchasesAdapter } from '~/services/iap/native-purchases-adapter'
import type { StoreBillingAdapter } from '~/services/iap/store-billing-adapter'
import { PurchaseCancelledError } from '~/services/iap/store-billing-adapter'
import { storeFor } from '~/utils/native-platform'
import { createLogger } from '~/utils/logger'
import { formatCurrency as formatCoins } from '~/utils/currency'
import { IAP_RESTORE_BATCH_SIZE } from '~/constants/economy/iapConstants'
import type {
  CoinPack,
  IapRestoreItem,
  IapRestoreResponse,
  IapStore,
  IapVerifyResponse,
  StoreTransaction,
} from '~/types/economy/iap'

const log = createLogger('[useCoinPurchase]')

/** Restore triggers a much noisier flow (empty-pending toast, error toast) when
 *  the user asked for it than when the app does it silently in the background. */
export type RestoreMode = 'auto' | 'manual'

/**
 * `StoreTransaction` → one `restore` request item. Store-specific: the
 * backend's `RestoreStorePurchasesRequest` requires `transaction_id` for
 * apple but `purchase_token` for google — sending `transaction_id` for an
 * Android transaction fails validation even though `tx.id` holds the right
 * value (it's the purchase token there too, see `toStoreTransaction`).
 */
function toRestoreItem(tx: StoreTransaction, iapStore: IapStore): IapRestoreItem {
  if (iapStore === 'google') {
    return { purchase_token: tx.purchaseToken ?? tx.id, product_id: tx.productId }
  }
  return { transaction_id: tx.id, signed_transaction: tx.jws, product_id: tx.productId }
}

/** Splits `items` into chunks of at most `size` — the backend's `restore` caps at 20/call. */
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export function useCoinPurchase(adapter: StoreBillingAdapter = createNativePurchasesAdapter()) {
  const store = useCoinPacksStore()
  const authStore = useAuthStore()
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // GATE + EXECUTE — load packs and store products
  // ========================================

  async function load(): Promise<void> {
    const iapStore = storeFor()
    if (!iapStore) {
      store.setStatus('unavailable')
      return
    }

    store.setStatus('loading')
    store.setError(null)

    try {
      // An older native shell without the billing plugin (OTA'd web bundle)
      // rejects here — that is "unavailable", never an error to show.
      const supported = await adapter.isSupported().catch(() => false)
      if (!supported) {
        store.setStatus('unavailable')
        return
      }

      const response = await api<{ status: string; data: { store: IapStore; packs: CoinPack[] } }>(
        `/iap/packs?store=${iapStore}`,
      )
      const packs = response.data.packs
      store.setPacks(packs)

      const products = await adapter.listProducts(packs.map(p => p.product_id))
      store.setProducts(products)

      store.setStatus(products.length > 0 ? 'ready' : 'unavailable')
    } catch (error) {
      const err = normalizeError(error)
      if (err.status === 404) {
        store.setStatus('unavailable')
        return
      }
      log.warn('Failed to load coin packs', error)
      store.setStatus('failed')
      store.setError(err.message)
    }
  }

  // ========================================
  // Helpers
  // ========================================

  /** `adapter.finish()` never throws into a caller — a plugin/store failure
   *  here must not block the balance update or the caller's own error handling. */
  async function finishQuietly(tx: StoreTransaction): Promise<void> {
    try {
      await adapter.finish(tx)
    } catch (error) {
      log.warn('Failed to finish transaction', error)
    }
  }

  // ========================================
  // EXECUTE — verify a store transaction against the backend
  // ========================================

  async function verify(tx: StoreTransaction): Promise<void> {
    const iapStore = storeFor()
    if (!iapStore) return

    try {
      const response = await api<{ data: IapVerifyResponse }>(`/iap/${iapStore}/verify`, {
        method: 'POST',
        body: {
          transaction_id: tx.id,
          signed_transaction: tx.jws,
          product_id: tx.productId,
        },
      })

      const { data } = response
      // Only release the store transaction once the backend confirms it is
      // settled either way — a row still pending (e.g. replayed under the
      // daily cap) must stay unfinished so the store retries it later.
      if (data.finish) await finishQuietly(tx)

      if (data.outcome !== 'credited') {
        // Replay of a transaction the backend already settled (restore on
        // launch, duplicate update event): nothing new for the user.
        if (store.status === 'pending-store' || store.status === 'purchasing') store.setStatus('ready')
        return
      }

      if (data.balance !== null && data.balance !== undefined) {
        authStore.patchBalance({ coins: String(data.balance) })
      }
      store.setLastPurchase(data.purchase)
      store.setStatus('success')
      toast.add({ title: 'Coins added', description: `+${formatCoins(data.purchase.coins)} coins`, color: 'success' })
    } catch (error) {
      const err = normalizeError(error)
      // The error envelope carries the same `finish` flag under `meta`
      // (`data` is null on an error response) — missing it means "keep unfinished".
      if (err.meta?.finish === true) await finishQuietly(tx)

      if (err.status === 422) {
        store.setStatus('failed')
        store.setError('Could not verify your purchase.')
        toast.add({ title: 'Purchase failed', description: 'Could not verify your purchase.', color: 'error' })
        return
      }

      if (err.status === 409) {
        // Daily cap — kept unfinished above so it retries tomorrow.
        store.setStatus('failed')
        store.setError('Daily limit reached. Coins will arrive tomorrow.')
        toast.add({ title: 'Limit reached', description: 'Coins will arrive tomorrow.', color: 'warning' })
        return
      }

      // 503 or anything else — kept unfinished above, allow retry later.
      log.warn('Verify failed, leaving transaction unfinished', error)
      store.setStatus('failed')
      store.setError(err.message || 'Could not verify your purchase. Please try again.')
      toast.add({ title: 'Purchase failed', description: 'Please try again later.', color: 'error' })
    } finally {
      store.setActiveProductId(null)
    }
  }

  // ========================================
  // GATE + EXECUTE — buy a pack
  // ========================================

  async function buy(productId: string): Promise<void> {
    if (store.status !== 'ready' && store.status !== 'failed' && store.status !== 'success') return

    store.setStatus('purchasing')
    store.setActiveProductId(productId)
    store.setError(null)

    try {
      const tx = await adapter.purchase(productId)

      if (tx.pending) {
        store.setStatus('pending-store')
        toast.add({ title: 'Waiting for approval', description: 'Ask to Buy or a similar approval is pending.', color: 'info' })
        return
      }

      await verify(tx)
    } catch (error) {
      store.setActiveProductId(null)
      if (error instanceof PurchaseCancelledError) {
        store.setStatus('ready')
        toast.add({ title: 'Purchase cancelled', color: 'neutral' })
        return
      }
      log.warn('Purchase failed', error)
      store.setStatus('failed')
      store.setError('Could not start the purchase.')
      toast.add({ title: 'Purchase failed', description: 'Could not start the purchase.', color: 'error' })
    }
  }

  // ========================================
  // GATE + EXECUTE — batch-restore unfinished/undelivered transactions
  // ========================================

  /**
   * Re-submits every device transaction the store still has outstanding
   * against `POST /iap/{store}/restore`, so a crash or network drop right
   * after payment (before `verify()` ran) still credits the user.
   *
   * `mode: 'auto'` — app boot/login/foreground triggers: silent unless at
   * least one pack was newly credited, never throws.
   * `mode: 'manual'` — the panel's "Restore purchases" link: tells the user
   * when there was nothing to restore or the request failed.
   */
  async function restorePending(mode: RestoreMode = 'manual'): Promise<void> {
    const iapStore = storeFor()
    if (!iapStore) return

    // GATE — one restore run at a time; a second trigger (e.g. foreground
    // firing while the manual link is already restoring) is a no-op. Set
    // BEFORE any `await` — two calls landing in the same tick (boot +
    // panel-mount `'auto'`, or foreground + panel-mount) must not both pass.
    if (store.isRestoring) return
    // GATE — `buy()`'s own `verify()` call owns this transaction while the
    // StoreKit/Play sheet is up (foreground fires mid-buy() on iOS, since the
    // sheet itself backgrounds/foregrounds the app). Does NOT cover
    // 'pending-store' (Ask to Buy) — that can sit for days, nothing is
    // actually in flight, and a `/restore` submit of an unfinalized tx just
    // comes back `finish: false`; blocking the manual link there would give
    // the user silent nothing for as long as approval is pending.
    if (store.status === 'purchasing') return
    store.setRestoring(true)

    try {
      const supported = await adapter.isSupported().catch(() => false)
      if (!supported) return

      const pending = await adapter.pendingTransactions()
      if (pending.length === 0) {
        if (mode === 'manual') {
          toast.add({ title: 'No purchases to restore', color: 'info' })
        }
        return
      }

      let creditedCount = 0
      let latestBalance: number | null = null

      for (const batch of chunk(pending, IAP_RESTORE_BATCH_SIZE)) {
        const response = await api<{ data: IapRestoreResponse }>(`/iap/${iapStore}/restore`, {
          method: 'POST',
          body: { transactions: batch.map(tx => toRestoreItem(tx, iapStore)) },
        })

        if (response.data.balance !== null && response.data.balance !== undefined) {
          latestBalance = response.data.balance
        }

        for (const result of response.data.results) {
          if (result.finish) {
            const tx = batch.find(t => t.id === result.transaction_id)
            if (tx) await finishQuietly(tx)
          }
          if (result.outcome === 'credited') creditedCount += 1
        }
      }

      if (latestBalance !== null) {
        authStore.patchBalance({ coins: String(latestBalance) })
      }

      if (creditedCount > 0) {
        toast.add({
          title: 'Purchases restored',
          description: `${creditedCount} coin pack${creditedCount > 1 ? 's' : ''} added`,
          color: 'success',
        })
      }
    } catch (error) {
      const err = normalizeError(error)
      // Store flag off (feature not enabled for this build) — not a user-facing error.
      if (err.status === 404) return

      log.warn('Restore failed', error)
      if (mode === 'manual') {
        toast.add({ title: 'Could not restore purchases', description: 'Please try again later.', color: 'error' })
      }
    } finally {
      store.setRestoring(false)
    }
  }

  // ========================================
  // REACT — subscribe to native transaction updates
  // ========================================

  function start(): () => void {
    return adapter.onTransactionUpdated(tx => {
      verify(tx).catch(error => log.warn('Failed to verify updated transaction', error))
    })
  }

  return { load, buy, verify, restorePending, start }
}
