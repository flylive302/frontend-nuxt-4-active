// ========================================
// useCoinPurchase Composable Tests
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
} from '../helpers/nuxtMocks'
import { FakeStoreBillingAdapter } from '~/services/iap/fake-store-billing-adapter'
import type { CoinPack, StoreProduct } from '~/types/economy/iap'

vi.mock('~/utils/native-platform', () => ({
  storeFor: () => 'apple',
  isIosNative: () => true,
}))

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

// ========================================
// Fixtures
// ========================================

const PACK: CoinPack = {
  id: 1,
  store: 'apple',
  product_id: 'coins_100',
  name: '100 Coins',
  coins: 100,
  display_order: 1,
}

const PRODUCT: StoreProduct = {
  identifier: 'coins_100',
  priceString: '$0.99',
  currencyCode: 'USD',
  price: 0.99,
}

// ========================================
// Mock Factories
// ========================================

function createMockCoinPacksStore() {
  return {
    packs: [] as CoinPack[],
    products: {} as Record<string, StoreProduct>,
    status: 'idle' as string,
    activeProductId: null as string | null,
    lastError: null as string | null,
    lastPurchase: null as unknown,
    packsWithPrices: [] as Array<{ pack: CoinPack; product: StoreProduct }>,
    setPacks: vi.fn(),
    setProducts: vi.fn(),
    setStatus: vi.fn(),
    setActiveProductId: vi.fn(),
    setError: vi.fn(),
    setLastPurchase: vi.fn(),
  }
}

function createMockAuthStore() {
  return { patchBalance: vi.fn() }
}

function createMockToast() {
  return { add: vi.fn() }
}

function makeApiError(status: number, message = 'error') {
  const err = new Error(message) as Error & { response: { status: number } }
  err.response = { status }
  return err
}

function createMockApiModule() {
  return {
    api: vi.fn(),
    normalizeError: vi.fn((e: unknown) => {
      const err = e as { response?: { status?: number }; message?: string }
      return { status: err?.response?.status, message: err?.message ?? 'Unknown error' }
    }),
  }
}

// ========================================
// Test State
// ========================================

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

// ========================================
// load()
// ========================================

describe('load', () => {
  it('lists packs with prices when backend 200 and store returns products', async () => {
    mockApiModule.api.mockResolvedValue({ status: 'ok', data: { store: 'apple', packs: [PACK] } })
    const adapter = new FakeStoreBillingAdapter({ products: [PRODUCT] })

    const { load } = useCoinPurchase(adapter)
    await load()

    expect(coinPacksStore.setPacks).toHaveBeenCalledWith([PACK])
    expect(coinPacksStore.setProducts).toHaveBeenCalledWith([PRODUCT])
    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('ready')
  })

  it('treats a 404 as unavailable, not an error', async () => {
    mockApiModule.api.mockRejectedValue(makeApiError(404))
    const adapter = new FakeStoreBillingAdapter()
    const listProductsSpy = vi.spyOn(adapter, 'listProducts')

    const { load } = useCoinPurchase(adapter)
    await load()

    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('unavailable')
    expect(listProductsSpy).not.toHaveBeenCalled()
  })
})

// ========================================
// buy()
// ========================================

describe('buy', () => {
  beforeEach(() => {
    coinPacksStore.status = 'ready'
  })

  it('purchase ok: verifies, applies balance, finishes tx, status success', async () => {
    mockApiModule.api.mockResolvedValue({ data: { outcome: 'credited', purchase: { id: 1, store: 'apple', product_id: 'coins_100', coins: 100, state: 'credited', store_transaction_id: 'tx-1', failure_reason: null }, balance: 500 } })
    const adapter = new FakeStoreBillingAdapter({ purchaseResult: 'ok' })
    const finishSpy = vi.spyOn(adapter, 'finish')

    const { buy } = useCoinPurchase(adapter)
    await buy('coins_100')

    expect(mockApiModule.api).toHaveBeenCalledWith('/iap/apple/verify', expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({ transaction_id: 'tx-1', signed_transaction: 'jws-1' }),
    }))
    expect(authStore.patchBalance).toHaveBeenCalledWith({ coins: '500' })
    expect(finishSpy).toHaveBeenCalled()
    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('success')
  })

  it('cancel: no verify call, back to ready, toast shown', async () => {
    const adapter = new FakeStoreBillingAdapter({ purchaseResult: 'cancel' })

    const { buy } = useCoinPurchase(adapter)
    await buy('coins_100')

    expect(mockApiModule.api).not.toHaveBeenCalled()
    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('ready')
    expect(mockToast.add).toHaveBeenCalled()
  })

  it('pending: status pending-store, no verify; transactionUpdated later triggers verify + finish', async () => {
    mockApiModule.api.mockResolvedValue({ data: { outcome: 'credited', purchase: { id: 1, store: 'apple', product_id: 'coins_100', coins: 100, state: 'credited', store_transaction_id: 'tx-1', failure_reason: null }, balance: 500 } })
    const adapter = new FakeStoreBillingAdapter({ purchaseResult: 'pending' })
    const finishSpy = vi.spyOn(adapter, 'finish')

    const { buy, start } = useCoinPurchase(adapter)
    start()
    await buy('coins_100')

    expect(mockApiModule.api).not.toHaveBeenCalled()
    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('pending-store')

    adapter.emitTransactionUpdated({ id: 'tx-1', jws: 'jws-1', productId: 'coins_100', pending: false })
    await vi.waitFor(() => expect(mockApiModule.api).toHaveBeenCalled())
    expect(finishSpy).toHaveBeenCalled()
  })

  it('verify 422: finish called, status failed', async () => {
    mockApiModule.api.mockRejectedValue(makeApiError(422))
    const adapter = new FakeStoreBillingAdapter({ purchaseResult: 'ok' })
    const finishSpy = vi.spyOn(adapter, 'finish')

    const { buy } = useCoinPurchase(adapter)
    await buy('coins_100')

    expect(finishSpy).toHaveBeenCalled()
    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('failed')
  })

  it('verify 503: finish NOT called, status failed', async () => {
    mockApiModule.api.mockRejectedValue(makeApiError(503))
    const adapter = new FakeStoreBillingAdapter({ purchaseResult: 'ok' })
    const finishSpy = vi.spyOn(adapter, 'finish')

    const { buy } = useCoinPurchase(adapter)
    await buy('coins_100')

    expect(finishSpy).not.toHaveBeenCalled()
    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('failed')
  })
})

// ========================================
// restorePending()
// ========================================

describe('restorePending', () => {
  it('re-submits each pending transaction for verification', async () => {
    mockApiModule.api.mockResolvedValue({ data: { outcome: 'credited', purchase: { id: 1, store: 'apple', product_id: 'coins_100', coins: 100, state: 'credited', store_transaction_id: 'tx-1', failure_reason: null }, balance: 500 } })
    const pending = [
      { id: 'tx-1', jws: 'jws-1', productId: 'coins_100', pending: false },
      { id: 'tx-2', jws: 'jws-2', productId: 'coins_200', pending: false },
    ]
    const adapter = new FakeStoreBillingAdapter({ pendingTransactions: pending })

    const { restorePending } = useCoinPurchase(adapter)
    await restorePending()

    expect(mockApiModule.api).toHaveBeenCalledTimes(2)
    expect(mockApiModule.api).toHaveBeenNthCalledWith(1, '/iap/apple/verify', expect.objectContaining({
      body: expect.objectContaining({ transaction_id: 'tx-1' }),
    }))
    expect(mockApiModule.api).toHaveBeenNthCalledWith(2, '/iap/apple/verify', expect.objectContaining({
      body: expect.objectContaining({ transaction_id: 'tx-2' }),
    }))
  })

  it('finishes a replayed, already-settled transaction silently', async () => {
    const adapter = new FakeStoreBillingAdapter({ products: [PRODUCT], purchaseResult: 'ok' })
    mockApiModule.api.mockResolvedValue({ data: { outcome: 'already_credited', purchase: { id: 1, store: 'apple', product_id: 'coins_100', coins: 100, state: 'credited', store_transaction_id: 'tx-1', failure_reason: null }, balance: 500 } })
    const { verify } = useCoinPurchase(adapter)

    await verify({ id: 'tx-1', jws: 'jws', productId: 'coins_100', pending: false })

    expect(adapter.finished).toContain('tx-1')
    expect(mockToast.add).not.toHaveBeenCalled()
    expect(authStore.patchBalance).not.toHaveBeenCalled()
  })
})
