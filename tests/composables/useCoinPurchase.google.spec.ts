// ========================================
// useCoinPurchase Composable Tests — Google (Android) path
// ========================================
// Separate file from useCoinPurchase.spec.ts because `storeFor`/`isIosNative`
// are mocked per-file (vi.mock is hoisted) — this file exercises the Android
// branch (`purchase_token`/`product_id`, no `transaction_id`/`signed_transaction`).
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
} from '../helpers/nuxtMocks'
import { FakeStoreBillingAdapter } from '~/services/iap/fake-store-billing-adapter'
import type { StoreProduct } from '~/types/economy/iap'

vi.mock('~/utils/native-platform', () => ({
  storeFor: () => 'google',
  isIosNative: () => false,
  isAndroidNative: () => true,
}))

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

function createMockCoinPacksStore() {
  return {
    packs: [] as unknown[],
    products: {} as Record<string, StoreProduct>,
    status: 'idle' as string,
    activeProductId: null as string | null,
    lastError: null as string | null,
    lastPurchase: null as unknown,
    isRestoring: false,
    catalogDisabled: false,
    packsWithPrices: [] as Array<{ pack: unknown; product: StoreProduct }>,
    setPacks: vi.fn(),
    setProducts: vi.fn(),
    setStatus: vi.fn(),
    setActiveProductId: vi.fn(),
    setError: vi.fn(),
    setLastPurchase: vi.fn(),
    setRestoring: vi.fn(),
    setCatalogDisabled: vi.fn(function (this: { catalogDisabled: boolean }, value: boolean) {
      this.catalogDisabled = value
    }),
  }
}

function createMockAuthStore() {
  return { patchBalance: vi.fn() }
}

function createMockToast() {
  return { add: vi.fn() }
}

function makeApiError(status: number, message = 'error', meta?: Record<string, unknown>) {
  const err = new Error(message) as Error & { response: { status: number; _data?: { meta?: Record<string, unknown> } } }
  err.response = { status, _data: meta ? { meta } : undefined }
  return err
}

function createMockApiModule() {
  return {
    api: vi.fn(),
    normalizeError: vi.fn((e: unknown) => {
      const err = e as { response?: { status?: number; _data?: { meta?: Record<string, unknown> } }; message?: string }
      return {
        status: err?.response?.status,
        message: err?.message ?? 'Unknown error',
        meta: err?.response?._data?.meta,
      }
    }),
  }
}

let useCoinPurchase: typeof import('~/composables/economy/useCoinPurchase')['useCoinPurchase']
let coinPacksStore: ReturnType<typeof createMockCoinPacksStore>
let authStore: ReturnType<typeof createMockAuthStore>
let mockToast: ReturnType<typeof createMockToast>
let mockApiModule: ReturnType<typeof createMockApiModule>

beforeEach(async () => {
  coinPacksStore = createMockCoinPacksStore()
  authStore = createMockAuthStore()
  mockToast = createMockToast()
  mockApiModule = createMockApiModule()

  setupNuxtMocks({})
  ;(globalThis as Record<string, unknown>).useCoinPacksStore = () => coinPacksStore
  ;(globalThis as Record<string, unknown>).useAuthStore = () => authStore
  ;(globalThis as Record<string, unknown>).useToast = () => mockToast
  ;(globalThis as Record<string, unknown>).useApi = () => mockApiModule

  const mod = await import('~/composables/economy/useCoinPurchase')
  useCoinPurchase = mod.useCoinPurchase
})

afterEach(() => {
  cleanupNuxtMocks()
  Reflect.deleteProperty(globalThis, 'useCoinPacksStore')
  Reflect.deleteProperty(globalThis, 'useAuthStore')
  Reflect.deleteProperty(globalThis, 'useToast')
  Reflect.deleteProperty(globalThis, 'useApi')
  vi.restoreAllMocks()
})

describe('buy (google)', () => {
  beforeEach(() => {
    coinPacksStore.status = 'ready'
  })

  it('verify body carries purchase_token/product_id, never transaction_id/signed_transaction', async () => {
    mockApiModule.api.mockResolvedValue({
      data: {
        outcome: 'credited',
        finish: true,
        purchase: { id: 1, store: 'google', product_id: 'coins_100', coins: 100, state: 'credited', store_transaction_id: 'token-1', failure_reason: null },
        balance: 500,
      },
    })
    const adapter = new FakeStoreBillingAdapter({ purchaseResult: 'ok' })
    const finishSpy = vi.spyOn(adapter, 'finish')

    const { buy } = useCoinPurchase(adapter)
    await buy('coins_100')

    expect(mockApiModule.api).toHaveBeenCalledWith('/iap/google/verify', expect.objectContaining({
      method: 'POST',
      body: { purchase_token: 'token-1', product_id: 'coins_100' },
    }))
    const body = mockApiModule.api.mock.calls[0]![1].body as Record<string, unknown>
    expect(body).not.toHaveProperty('transaction_id')
    expect(body).not.toHaveProperty('signed_transaction')
    expect(finishSpy).toHaveBeenCalled()
    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('success')
  })

  it('outcome pending_store: keeps the transaction unfinished and sets pending-store status', async () => {
    mockApiModule.api.mockResolvedValue({
      data: {
        outcome: 'pending_store',
        finish: false,
        purchase: { id: 1, store: 'google', product_id: 'coins_100', coins: 100, state: 'pending', store_transaction_id: 'token-1', failure_reason: null },
        balance: null,
      },
    })
    const adapter = new FakeStoreBillingAdapter({ purchaseResult: 'ok' })
    const finishSpy = vi.spyOn(adapter, 'finish')

    const { buy } = useCoinPurchase(adapter)
    await buy('coins_100')

    expect(finishSpy).not.toHaveBeenCalled()
    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('pending-store')
    expect(mockToast.add).not.toHaveBeenCalled()
  })

  it('finish:true finishes via the adapter (consumePurchase path, per adapter.finish contract)', async () => {
    mockApiModule.api.mockResolvedValue({
      data: {
        outcome: 'credited',
        finish: true,
        purchase: { id: 1, store: 'google', product_id: 'coins_100', coins: 100, state: 'credited', store_transaction_id: 'token-1', failure_reason: null },
        balance: 500,
      },
    })
    const adapter = new FakeStoreBillingAdapter({ purchaseResult: 'ok' })
    const finishSpy = vi.spyOn(adapter, 'finish')

    const { buy } = useCoinPurchase(adapter)
    await buy('coins_100')

    expect(finishSpy).toHaveBeenCalledWith(expect.objectContaining({ purchaseToken: 'token-1' }))
  })

  it('daily cap (409): finish NOT called, transaction retried later', async () => {
    mockApiModule.api.mockRejectedValue(makeApiError(409, 'error', { finish: false }))
    const adapter = new FakeStoreBillingAdapter({ purchaseResult: 'ok' })
    const finishSpy = vi.spyOn(adapter, 'finish')

    const { buy } = useCoinPurchase(adapter)
    await buy('coins_100')

    expect(finishSpy).not.toHaveBeenCalled()
    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('failed')
  })
})

describe('load (google) — 404 marks the catalog definitively disabled', () => {
  it('404 → status unavailable, catalogDisabled true', async () => {
    mockApiModule.api.mockRejectedValue(makeApiError(404))
    const { load } = useCoinPurchase(new FakeStoreBillingAdapter())
    await load()

    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('unavailable')
    expect(coinPacksStore.setCatalogDisabled).toHaveBeenLastCalledWith(true)
  })
})

describe('restorePending (google)', () => {
  it('natively finishes (consumes) a store-listed finish:true item even when it is not journaled', async () => {
    mockApiModule.api.mockResolvedValue({
      data: {
        results: [{ transaction_id: 'token-1', outcome: 'credited', finish: true, purchase: { id: 1, store: 'google', product_id: 'coins_100', coins: 100, state: 'credited', store_transaction_id: 'token-1', failure_reason: null } }],
        balance: 800,
      },
    })
    const pending = [{ id: 'token-1', purchaseToken: 'token-1', productId: 'coins_100', pending: false }]
    const adapter = new FakeStoreBillingAdapter({ pendingTransactions: pending })
    const finishSpy = vi.spyOn(adapter, 'finish')

    // No journal injected — default (node env, no localStorage) is a no-op, so
    // this item is definitely NOT journaled; google finishes it anyway.
    const { restorePending } = useCoinPurchase(adapter)
    await restorePending('manual')

    expect(finishSpy).toHaveBeenCalledTimes(1)
    expect(adapter.finished).toEqual(['token-1'])
  })
})
