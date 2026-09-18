// ========================================
// Coin Purchase Composable
// ========================================
// GATE → EXECUTE → REACT pipeline for the native "Buy Coins" flow.
// Each function below is ONE stage — see CLAUDE.md's INTENT/GATE/EXECUTE/REACT rule.
//
// Paid-but-uncredited safety (in-app-purchase/09): every store transaction is
// written to the device's purchase journal before it is sent to the backend,
// and leaves it only when the backend answers `finish: true`. Restore
// re-submits the journal plus the store's own list, so a failed verify is
// retried even after the billing plugin has finished the store transaction.
// ========================================

import { createNativePurchasesAdapter } from '~/services/iap/native-purchases-adapter'
import type { StoreBillingAdapter } from '~/services/iap/store-billing-adapter'
import { PurchaseCancelledError, PurchasePendingError } from '~/services/iap/store-billing-adapter'
import { createPurchaseJournal, type JournalSnapshot, type PurchaseJournal } from '~/services/iap/purchase-journal'
import { storeFor } from '~/utils/native-platform'
import { createLogger } from '~/utils/logger'
import { formatCurrency as formatCoins } from '~/utils/currency'
import { IAP_RESTORE_BATCH_SIZE, IAP_RESTORE_MAX_PER_RUN } from '~/constants/economy/iapConstants'
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

/** Store purchase time in epoch ms; unknown sorts last. */
function purchasedAtMs(tx: StoreTransaction): number {
  const ms = tx.purchasedAt ? Date.parse(tx.purchasedAt) : Number.NaN
  return Number.isNaN(ms) ? 0 : ms
}

/**
 * What one restore run submits: `userId`'s journaled transactions first (the
 * ones a failed verify left behind), then the store's own list minus anything
 * settled or journaled — journaled for anyone: another account's purchase on
 * this device is never re-submitted under this one — newest first, capped.
 */
function restoreCandidates(snapshot: JournalSnapshot, userId: number | null, storeListed: StoreTransaction[]): StoreTransaction[] {
  const mine = snapshot.unsettled.filter(entry => entry.userId === userId).map(entry => entry.tx)
  const seen = new Set([...snapshot.unsettled.map(entry => entry.tx.id), ...snapshot.settledIds])
  const fromStore: StoreTransaction[] = []

  for (const tx of storeListed) {
    if (tx.id === '' || seen.has(tx.id)) continue
    seen.add(tx.id)
    fromStore.push(tx)
  }
  fromStore.sort((a, b) => purchasedAtMs(b) - purchasedAtMs(a))

  return [...mine, ...fromStore].slice(0, IAP_RESTORE_MAX_PER_RUN)
}

export function useCoinPurchase(
  adapter: StoreBillingAdapter = createNativePurchasesAdapter(),
  journal: PurchaseJournal = createPurchaseJournal(),
) {
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
    // Reset every load — only a fresh, definitive 404 below may flip this
    // back on; any other path (including this one re-running) must not
    // leave a stale "confirmed disabled" signal behind.
    store.setCatalogDisabled(false)

    try {
      // An older native shell without the billing plugin (OTA'd web bundle)
      // rejects here — that is "unavailable", never an error to show. It is
      // also definitive: this device can never buy in-store, so the reseller
      // path must stay reachable (Android builds shipped before ticket 08).
      const supported = await adapter.isSupported().catch(() => false)
      if (!supported) {
        store.setStatus('unavailable')
        store.setCatalogDisabled(true)
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
        // Definitive: the backend has no catalog for this store (flag off).
        store.setStatus('unavailable')
        store.setCatalogDisabled(true)
        return
      }
      // Network/5xx/anything else — NOT a confirmed-disabled signal. Leave
      // `catalogDisabled` false so a transient failure can never make the
      // reseller "claim coins" UI appear on native.
      log.warn('Failed to load coin packs', error)
      store.setStatus('failed')
      store.setError(err.message)
    }
  }

  // ========================================
  // Helpers
  // ========================================

  /** Journal a store transaction for the signed-in buyer — before any network call can fail. */
  function remember(tx: StoreTransaction): void {
    const iapStore = storeFor()
    const userId = authStore.user?.id
    if (!iapStore || !userId || !tx.id) return
    journal.record(iapStore, userId, tx)
  }

  /** `adapter.finish()` never throws into a caller — a plugin/store failure
   *  here must not block the balance update or the caller's own error handling. */
  async function finishQuietly(tx: StoreTransaction): Promise<void> {
    try {
      await adapter.finish(tx)
    } catch (error) {
      log.warn('Failed to finish transaction', error)
    }
  }

  /** The backend settled `tx` for good (`finish: true`): drop it from the journal, then finish it at the store. */
  async function release(tx: StoreTransaction): Promise<void> {
    const iapStore = storeFor()
    if (iapStore) journal.settle(iapStore, tx.id)
    await finishQuietly(tx)
  }

  // ========================================
  // EXECUTE — verify a store transaction against the backend
  // ========================================

  async function verify(tx: StoreTransaction): Promise<void> {
    const iapStore = storeFor()
    if (!iapStore) return

    try {
      // Same field shape `restorePending` sends per-transaction — verify and
      // restore both validate against `RestoreStorePurchasesRequest`'s rules.
      const response = await api<{ data: IapVerifyResponse }>(`/iap/${iapStore}/verify`, {
        method: 'POST',
        body: toRestoreItem(tx, iapStore),
      })

      const { data } = response
      // Only release the store transaction once the backend confirms it is
      // settled either way — a row still pending (e.g. replayed under the
      // daily cap) must stay unfinished (and journaled) so it is retried.
      if (data.finish) await release(tx)

      if (data.outcome === 'pending_store') {
        // Google reports the purchase itself is still pending approval
        // (e.g. a pending payment method) — nothing credited yet, `finish`
        // is false above so the device keeps the purchase and re-submits it
        // later (restore-on-foreground). Same UI as the pre-purchase
        // pending-store state, never an error toast.
        store.setStatus('pending-store')
        return
      }

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
      if (err.meta?.finish === true) await release(tx)

      if (err.status === 422) {
        store.setStatus('failed')
        store.setError('Could not verify your purchase.')
        toast.add({ title: 'Purchase failed', description: 'Could not verify your purchase.', color: 'error' })
        return
      }

      if (err.status === 409 && err.meta?.error_code === 'in_progress') {
        // A concurrent verify of this same transaction (buy() and the store's
        // update event can overlap) holds the backend's lock and settles it;
        // the journal keeps it until then. Nothing to tell the user.
        if (store.status === 'pending-store' || store.status === 'purchasing') store.setStatus('ready')
        return
      }

      if (err.status === 409) {
        // Daily cap — kept unfinished above so it retries tomorrow.
        store.setStatus('failed')
        store.setError('Daily limit reached. Coins will arrive tomorrow.')
        toast.add({ title: 'Limit reached', description: 'Coins will arrive tomorrow.', color: 'warning' })
        return
      }

      // 503, network drop, anything else — the store has the payment and the
      // journal keeps the transaction, so restore credits it later. Say so:
      // "try again" here reads as "buy again".
      log.warn('Verify failed, leaving transaction unfinished', error)
      store.setStatus('failed')
      store.setError('Payment received. Your coins will be added automatically.')
      toast.add({ title: 'Coins on the way', description: 'Payment received. Your coins will be added automatically.', color: 'warning' })
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
      remember(tx)

      if (tx.pending) {
        store.setStatus('pending-store')
        toast.add({ title: 'Waiting for approval', description: 'Your purchase needs approval before it can complete.', color: 'info' })
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
      if (error instanceof PurchasePendingError) {
        store.setStatus('pending-store')
        toast.add({ title: 'Waiting for approval', description: 'Your purchase needs approval before it can complete.', color: 'info' })
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
   * Re-submits every transaction the backend has not settled — this user's
   * journal plus the store's own list — against `POST /iap/{store}/restore`,
   * so a crash, network drop or failed verify after payment still credits
   * the user.
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

      const storeListed = await adapter.pendingTransactions().catch((error: unknown) => {
        // The journal alone still covers what this device bought.
        log.warn('Failed to list store transactions', error)
        return [] as StoreTransaction[]
      })
      const snapshot = journal.snapshot(iapStore)
      const candidates = restoreCandidates(snapshot, authStore.user?.id ?? null, storeListed)
      if (candidates.length === 0) {
        if (mode === 'manual') {
          toast.add({ title: 'No purchases to restore', color: 'info' })
        }
        return
      }

      // iOS: the plugin finishes every unfinished transaction itself at app
      // launch, so only a journaled one (bought this session) can still need
      // a store finish; "finishing" the rest would rescan the whole StoreKit
      // history for nothing. Android: the list holds only unconsumed purchases.
      const journaledIds = new Set(snapshot.unsettled.map(entry => entry.tx.id))
      let creditedCount = 0
      let unsettledCount = 0
      let latestBalance: number | null = null

      for (const batch of chunk(candidates, IAP_RESTORE_BATCH_SIZE)) {
        const response = await api<{ data: IapRestoreResponse }>(`/iap/${iapStore}/restore`, {
          method: 'POST',
          body: { transactions: batch.map(tx => toRestoreItem(tx, iapStore)) },
        })

        if (response.data.balance !== null && response.data.balance !== undefined) {
          latestBalance = response.data.balance
        }

        for (const result of response.data.results) {
          const tx = batch.find(t => t.id === result.transaction_id)
          if (result.finish) {
            journal.settle(iapStore, tx?.id ?? result.transaction_id)
            if (tx && (iapStore === 'google' || journaledIds.has(tx.id))) await finishQuietly(tx)
          } else {
            unsettledCount += 1
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
      } else if (mode === 'manual') {
        toast.add(unsettledCount > 0
          ? { title: 'Purchase still processing', description: 'Your coins will be added automatically.', color: 'info' }
          : { title: 'No purchases to restore', color: 'info' })
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

  /**
   * App-wide listener (registered once by `plugins/iap-restore.client.ts`) for
   * transactions the store delivers outside `buy()`: Ask to Buy approvals,
   * interrupted purchases, unfinished transactions re-delivered at launch.
   * On iOS the plugin has already FINISHED the transaction before this fires,
   * so the journal is the only record left — write it before anything can fail.
   */
  function start(): () => void {
    return adapter.onTransactionUpdated(tx => {
      remember(tx)
      // Signed out: nothing to credit it to yet — the journal/store list
      // brings it back on the next signed-in restore.
      if (!authStore.token) return
      verify(tx).catch(error => log.warn('Failed to verify updated transaction', error))
    })
  }

  return { load, buy, verify, restorePending, start }
}
