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
import type { CoinPack, IapStore, IapVerifyResponse, StoreTransaction } from '~/types/economy/iap'

const log = createLogger('[useCoinPurchase]')

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
      // Always release the store transaction once the backend owns it.
      await adapter.finish(tx)

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

      if (err.status === 422) {
        // Backend rejected verification — finish so the store stops nagging.
        try {
          await adapter.finish(tx)
        } catch (finishError) {
          log.warn('Failed to finish rejected transaction', finishError)
        }
        store.setStatus('failed')
        store.setError('Could not verify your purchase.')
        toast.add({ title: 'Purchase failed', description: 'Could not verify your purchase.', color: 'error' })
        return
      }

      if (err.status === 409) {
        // Daily cap — keep the transaction unfinished so it retries tomorrow.
        store.setStatus('failed')
        store.setError('Daily limit reached. Coins will arrive tomorrow.')
        toast.add({ title: 'Limit reached', description: 'Coins will arrive tomorrow.', color: 'warning' })
        return
      }

      // 503 or anything else — keep unfinished, allow retry later.
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
  // EXECUTE — restore/replay unfinished transactions
  // ========================================

  async function restorePending(): Promise<void> {
    const pending = await adapter.pendingTransactions()
    for (const tx of pending) {
      await verify(tx)
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
