// ========================================
// Coin Packs Store
// ========================================
// State + setters ONLY. API calls + billing adapter calls live in
// `useCoinPurchase` (app/composables/economy/useCoinPurchase.ts).
// ========================================

import { defineStore } from 'pinia'
import type { CoinPack, IapPurchase, PurchaseStatus, StoreProduct } from '~/types/economy/iap'

export const useCoinPacksStore = defineStore('coinPacks', () => {
  // ========================================
  // State
  // ========================================

  const packs = ref<CoinPack[]>([])
  const products = ref<Record<string, StoreProduct>>({})
  const status = ref<PurchaseStatus>('idle')
  const activeProductId = ref<string | null>(null)
  const lastError = ref<string | null>(null)
  const lastPurchase = ref<IapPurchase | null>(null)

  // ========================================
  // Computed
  // ========================================

  /** Packs joined to their resolved store product, only when the store returned one, sorted for display. */
  const packsWithPrices = computed(() =>
    packs.value
      .filter(pack => products.value[pack.product_id] !== undefined)
      .map(pack => ({ pack, product: products.value[pack.product_id]! }))
      .sort((a, b) => a.pack.display_order - b.pack.display_order),
  )

  // ========================================
  // Setters
  // ========================================

  function setPacks(value: CoinPack[]): void {
    packs.value = value
  }

  function setProducts(value: StoreProduct[]): void {
    products.value = Object.fromEntries(value.map(p => [p.identifier, p]))
  }

  function setStatus(value: PurchaseStatus): void {
    status.value = value
  }

  function setActiveProductId(value: string | null): void {
    activeProductId.value = value
  }

  function setError(message: string | null): void {
    lastError.value = message
  }

  function setLastPurchase(purchase: IapPurchase | null): void {
    lastPurchase.value = purchase
  }

  return {
    packs,
    products,
    status,
    activeProductId,
    lastError,
    lastPurchase,
    packsWithPrices,
    setPacks,
    setProducts,
    setStatus,
    setActiveProductId,
    setError,
    setLastPurchase,
  }
})
