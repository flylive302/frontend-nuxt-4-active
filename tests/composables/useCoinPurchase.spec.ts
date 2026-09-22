// ========================================
// useCoinPurchase Composable Tests
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
} from '../helpers/nuxtMocks'
import { FakeStoreBillingAdapter } from '~/services/iap/fake-store-billing-adapter'
import { createPurchaseJournal, type JournalStorage } from '~/services/iap/purchase-journal'
import type { CoinPack, StoreProduct, StoreTransaction } from '~/types/economy/iap'

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
    isRestoring: false,
    catalogDisabled: false,
    packsWithPrices: [] as Array<{ pack: CoinPack; product: StoreProduct }>,
    setPacks: vi.fn(),
    setProducts: vi.fn(),
    setStatus: vi.fn(),
    setActiveProductId: vi.fn(),
    setError: vi.fn(),
    setLastPurchase: vi.fn(),
    setRestoring: vi.fn(function (this: { isRestoring: boolean }, value: boolean) {
      this.isRestoring = value
    }),
    setCatalogDisabled: vi.fn(function (this: { catalogDisabled: boolean }, value: boolean) {
      this.catalogDisabled = value
    }),
  }
}

function createMockAuthStore() {
  return {
    token: 'test-token' as string | null,
    user: { id: 7 } as { id: number } | null,
  }
}

function createMockBalanceStore() {
  return {
    patch: vi.fn(),
    apply: vi.fn(),
  }
}

function createMockToast() {
  return { add: vi.fn() }
}

/**
 * `meta` mirrors `ApiResponse::error()`'s envelope — on a real error response
 * `data` is null and everything (outcome/purchase/balance/finish/error_code)
 * lives under `meta` instead (see `normalizeFetchError.ts`).
 */
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

/** In-memory `localStorage` double for the purchase journal — `environment: 'node'` has no global to stub. */
function createMemoryStorage(): JournalStorage {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
  }
}

/** Minimal StoreTransaction fixture for journal-integration tests. */
function makeTx(id: string, overrides: Partial<StoreTransaction> = {}): StoreTransaction {
  return { id, jws: `jws-${id}`, productId: 'coins_100', pending: false, ...overrides }
}

// ========================================
// Test State
// ========================================

let useCoinPurchase: typeof import('~/composables/economy/useCoinPurchase')['useCoinPurchase']
let coinPacksStore: ReturnType<typeof createMockCoinPacksStore>
let authStore: ReturnType<typeof createMockAuthStore>
let balanceStore: ReturnType<typeof createMockBalanceStore>
let mockToast: ReturnType<typeof createMockToast>
let mockApiModule: ReturnType<typeof createMockApiModule>

beforeEach(async () => {
  coinPacksStore = createMockCoinPacksStore()
  authStore = createMockAuthStore()
  balanceStore = createMockBalanceStore()
  mockToast = createMockToast()
  mockApiModule = createMockApiModule()

  setupNuxtMocks({})
  ;(globalThis as Record<string, unknown>).useCoinPacksStore = () => coinPacksStore
  ;(globalThis as Record<string, unknown>).useAuthStore = () => authStore
  ;(globalThis as Record<string, unknown>).useBalanceStore = () => balanceStore
  ;(globalThis as Record<string, unknown>).useToast = () => mockToast
  ;(globalThis as Record<string, unknown>).useApi = () => mockApiModule

  const mod = await import('~/composables/economy/useCoinPurchase')
  useCoinPurchase = mod.useCoinPurchase
})

afterEach(() => {
  cleanupNuxtMocks()
  Reflect.deleteProperty(globalThis, 'useCoinPacksStore')
  Reflect.deleteProperty(globalThis, 'useAuthStore')
  Reflect.deleteProperty(globalThis, 'useBalanceStore')
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

  it('treats a 404 as unavailable, not an error, and marks the catalog definitively disabled', async () => {
    mockApiModule.api.mockRejectedValue(makeApiError(404))
    const adapter = new FakeStoreBillingAdapter()
    const listProductsSpy = vi.spyOn(adapter, 'listProducts')

    const { load } = useCoinPurchase(adapter)
    await load()

    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('unavailable')
    expect(coinPacksStore.setCatalogDisabled).toHaveBeenLastCalledWith(true)
    expect(listProductsSpy).not.toHaveBeenCalled()
  })

  it('a network/5xx error does NOT mark the catalog disabled (fail closed for the reseller UI)', async () => {
    mockApiModule.api.mockRejectedValue(makeApiError(503))

    const { load } = useCoinPurchase(new FakeStoreBillingAdapter())
    await load()

    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('failed')
    expect(coinPacksStore.setCatalogDisabled).not.toHaveBeenCalledWith(true)
  })

  it('an unsupported device (shell without the billing plugin) marks the catalog disabled', async () => {
    const adapter = new FakeStoreBillingAdapter({ supported: false })

    const { load } = useCoinPurchase(adapter)
    await load()

    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('unavailable')
    expect(coinPacksStore.setCatalogDisabled).toHaveBeenLastCalledWith(true)
  })

  it('resets catalogDisabled at the start of every load (a later success clears a prior 404)', async () => {
    mockApiModule.api.mockResolvedValue({ status: 'ok', data: { store: 'apple', packs: [PACK] } })
    const adapter = new FakeStoreBillingAdapter({ products: [PRODUCT] })

    const { load } = useCoinPurchase(adapter)
    await load()

    expect(coinPacksStore.setCatalogDisabled).toHaveBeenCalledWith(false)
  })
})

// ========================================
// buy()
// ========================================

describe('buy', () => {
  beforeEach(() => {
    coinPacksStore.status = 'ready'
  })

  it('journals the transaction before calling verify', async () => {
    const journal = createPurchaseJournal(createMemoryStorage())
    let journaledBeforeVerify = false
    mockApiModule.api.mockImplementation(async (url: string) => {
      if (url === '/iap/apple/verify') {
        journaledBeforeVerify = journal.snapshot('apple').unsettled.some(entry => entry.tx.id === 'tx-1')
      }
      return { data: { outcome: 'credited', finish: true, purchase: { id: 1, store: 'apple', product_id: 'coins_100', coins: 100, state: 'credited', store_transaction_id: 'tx-1', failure_reason: null }, balance: 500 } }
    })
    const adapter = new FakeStoreBillingAdapter({ purchaseResult: 'ok' })

    const { buy } = useCoinPurchase(adapter, journal)
    await buy('coins_100')

    expect(journaledBeforeVerify).toBe(true)
  })

  it('purchase ok: verifies, applies balance, finishes tx, status success', async () => {
    mockApiModule.api.mockResolvedValue({ data: { outcome: 'credited', finish: true, purchase: { id: 1, store: 'apple', product_id: 'coins_100', coins: 100, state: 'credited', store_transaction_id: 'tx-1', failure_reason: null }, balance: 500 } })
    const adapter = new FakeStoreBillingAdapter({ purchaseResult: 'ok' })
    const finishSpy = vi.spyOn(adapter, 'finish')

    const { buy } = useCoinPurchase(adapter)
    await buy('coins_100')

    expect(mockApiModule.api).toHaveBeenCalledWith('/iap/apple/verify', expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({ transaction_id: 'tx-1', signed_transaction: 'jws-1' }),
    }))
    expect(balanceStore.patch).toHaveBeenCalledWith({ coins: '500' })
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
    mockApiModule.api.mockResolvedValue({ data: { outcome: 'credited', finish: true, purchase: { id: 1, store: 'apple', product_id: 'coins_100', coins: 100, state: 'credited', store_transaction_id: 'tx-1', failure_reason: null }, balance: 500 } })
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

  it('purchaseResult "deferred": PurchasePendingError → pending-store + "Waiting for approval" toast, no API call', async () => {
    const adapter = new FakeStoreBillingAdapter({ purchaseResult: 'deferred' })

    const { buy } = useCoinPurchase(adapter)
    await buy('coins_100')

    expect(mockApiModule.api).not.toHaveBeenCalled()
    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('pending-store')
    expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'Waiting for approval' }))
  })

  it('verify 422: finish=true in the error meta → finish called, status failed', async () => {
    mockApiModule.api.mockRejectedValue(makeApiError(422, 'error', { finish: true }))
    const adapter = new FakeStoreBillingAdapter({ purchaseResult: 'ok' })
    const finishSpy = vi.spyOn(adapter, 'finish')

    const { buy } = useCoinPurchase(adapter)
    await buy('coins_100')

    expect(finishSpy).toHaveBeenCalled()
    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('failed')
  })

  it('verify 409 (daily cap): finish=false in the error meta → finish NOT called, status failed', async () => {
    mockApiModule.api.mockRejectedValue(makeApiError(409, 'error', { finish: false }))
    const adapter = new FakeStoreBillingAdapter({ purchaseResult: 'ok' })
    const finishSpy = vi.spyOn(adapter, 'finish')

    const { buy } = useCoinPurchase(adapter)
    await buy('coins_100')

    expect(finishSpy).not.toHaveBeenCalled()
    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('failed')
  })

  it('verify 503: no finish in the error meta → treated as false, finish NOT called', async () => {
    mockApiModule.api.mockRejectedValue(makeApiError(503))
    const adapter = new FakeStoreBillingAdapter({ purchaseResult: 'ok' })
    const finishSpy = vi.spyOn(adapter, 'finish')

    const { buy } = useCoinPurchase(adapter)
    await buy('coins_100')

    expect(finishSpy).not.toHaveBeenCalled()
    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('failed')
  })

  it('verify 200 outcome pending_store: status set to pending-store, not finished, no error toast', async () => {
    mockApiModule.api.mockResolvedValue({ data: { outcome: 'pending_store', finish: false, purchase: { id: 1, store: 'apple', product_id: 'coins_100', coins: 100, state: 'pending', store_transaction_id: 'tx-1', failure_reason: null }, balance: null } })
    const adapter = new FakeStoreBillingAdapter({ purchaseResult: 'ok' })
    const finishSpy = vi.spyOn(adapter, 'finish')

    const { buy } = useCoinPurchase(adapter)
    await buy('coins_100')

    expect(finishSpy).not.toHaveBeenCalled()
    expect(coinPacksStore.setStatus).toHaveBeenLastCalledWith('pending-store')
    expect(mockToast.add).not.toHaveBeenCalled()
    expect(balanceStore.patch).not.toHaveBeenCalled()
  })

  it('verify 200 already_pending (finish: false): NOT finished, no success toast/balance patch', async () => {
    mockApiModule.api.mockResolvedValue({ data: { outcome: 'already_pending', finish: false, purchase: { id: 1, store: 'apple', product_id: 'coins_100', coins: 100, state: 'pending', store_transaction_id: 'tx-1', failure_reason: null }, balance: null } })
    const adapter = new FakeStoreBillingAdapter({ purchaseResult: 'ok' })
    const finishSpy = vi.spyOn(adapter, 'finish')

    const { buy } = useCoinPurchase(adapter)
    await buy('coins_100')

    expect(finishSpy).not.toHaveBeenCalled()
    expect(mockToast.add).not.toHaveBeenCalled()
    expect(balanceStore.patch).not.toHaveBeenCalled()
  })
})

// ========================================
// restorePending()
// ========================================

describe('restorePending', () => {
  const PENDING = [
    { id: 'tx-1', jws: 'jws-1', productId: 'coins_100', pending: false },
    { id: 'tx-2', jws: 'jws-2', productId: 'coins_200', pending: false },
  ]

  it('batches through /restore, settles finish:true results, one toast, balance patched — a non-journaled apple item is NOT natively finished', async () => {
    mockApiModule.api.mockResolvedValue({
      data: {
        results: [
          { transaction_id: 'tx-1', outcome: 'credited', finish: true, purchase: { id: 1, store: 'apple', product_id: 'coins_100', coins: 100, state: 'credited', store_transaction_id: 'tx-1', failure_reason: null } },
          { transaction_id: 'tx-2', outcome: 'daily_cap_exceeded', finish: false, purchase: null },
        ],
        balance: 700,
      },
    })
    const journal = createPurchaseJournal(createMemoryStorage())
    const adapter = new FakeStoreBillingAdapter({ pendingTransactions: PENDING })
    const finishSpy = vi.spyOn(adapter, 'finish')

    const { restorePending } = useCoinPurchase(adapter, journal)
    await restorePending('manual')

    expect(mockApiModule.api).toHaveBeenCalledTimes(1)
    expect(mockApiModule.api).toHaveBeenCalledWith('/iap/apple/restore', expect.objectContaining({
      method: 'POST',
      body: { transactions: [
        { transaction_id: 'tx-1', signed_transaction: 'jws-1', product_id: 'coins_100' },
        { transaction_id: 'tx-2', signed_transaction: 'jws-2', product_id: 'coins_200' },
      ] },
    }))
    // Neither item was journaled (both came straight from the store list) — on
    // apple only a journaled transaction gets natively finished by restore.
    expect(finishSpy).not.toHaveBeenCalled()
    expect(adapter.finished).toEqual([])
    expect(journal.snapshot('apple').settledIds.has('tx-1')).toBe(true)
    expect(journal.snapshot('apple').settledIds.has('tx-2')).toBe(false)
    expect(balanceStore.patch).toHaveBeenCalledWith({ coins: '700' })
    expect(mockToast.add).toHaveBeenCalledTimes(1)
    expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'Purchases restored' }))
  })

  it('finishes a journaled finish:true item natively after restore (apple)', async () => {
    mockApiModule.api.mockResolvedValue({
      data: {
        results: [
          { transaction_id: 'tx-1', outcome: 'credited', finish: true, purchase: { id: 1, store: 'apple', product_id: 'coins_100', coins: 100, state: 'credited', store_transaction_id: 'tx-1', failure_reason: null } },
        ],
        balance: 700,
      },
    })
    const journal = createPurchaseJournal(createMemoryStorage())
    journal.record('apple', 7, makeTx('tx-1'))
    const adapter = new FakeStoreBillingAdapter({ pendingTransactions: [] })
    const finishSpy = vi.spyOn(adapter, 'finish')

    const { restorePending } = useCoinPurchase(adapter, journal)
    await restorePending('manual')

    expect(finishSpy).toHaveBeenCalledTimes(1)
    expect(adapter.finished).toEqual(['tx-1'])
    expect(journal.snapshot('apple').unsettled).toHaveLength(0)
    expect(journal.snapshot('apple').settledIds.has('tx-1')).toBe(true)
  })

  it('chunks batches of 21 into a 20 + 1 pair', async () => {
    mockApiModule.api.mockResolvedValue({ data: { results: [], balance: null } })
    const manyPending = Array.from({ length: 21 }, (_, i) => ({
      id: `tx-${i}`,
      jws: `jws-${i}`,
      productId: 'coins_100',
      pending: false,
    }))
    const adapter = new FakeStoreBillingAdapter({ pendingTransactions: manyPending })

    const { restorePending } = useCoinPurchase(adapter)
    await restorePending('auto')

    expect(mockApiModule.api).toHaveBeenCalledTimes(2)
    const firstBody = mockApiModule.api.mock.calls[0]![1].body as { transactions: unknown[] }
    const secondBody = mockApiModule.api.mock.calls[1]![1].body as { transactions: unknown[] }
    expect(firstBody.transactions).toHaveLength(20)
    expect(secondBody.transactions).toHaveLength(1)
  })

  it('two concurrent calls in the same tick: only one runs (isRestoring guard set before any await)', async () => {
    mockApiModule.api.mockResolvedValue({ data: { results: [], balance: null } })
    const adapter = new FakeStoreBillingAdapter({ pendingTransactions: PENDING })

    const { restorePending } = useCoinPurchase(adapter)
    const first = restorePending('auto')
    const second = restorePending('auto')
    await Promise.all([first, second])

    expect(mockApiModule.api).toHaveBeenCalledTimes(1)
  })

  it('skips while a purchase is already in flight (buy() owns that verify)', async () => {
    coinPacksStore.status = 'purchasing'
    const adapter = new FakeStoreBillingAdapter({ pendingTransactions: PENDING })

    const { restorePending } = useCoinPurchase(adapter)
    await restorePending('manual')

    expect(mockApiModule.api).not.toHaveBeenCalled()
    expect(mockToast.add).not.toHaveBeenCalled()
  })

  it('empty pending: no API call', async () => {
    const adapter = new FakeStoreBillingAdapter({ pendingTransactions: [] })

    const { restorePending } = useCoinPurchase(adapter)
    await restorePending('auto')

    expect(mockApiModule.api).not.toHaveBeenCalled()
    expect(mockToast.add).not.toHaveBeenCalled()
  })

  it('manual restore with nothing pending: toast "No purchases to restore"', async () => {
    const adapter = new FakeStoreBillingAdapter({ pendingTransactions: [] })

    const { restorePending } = useCoinPurchase(adapter)
    await restorePending('manual')

    expect(mockApiModule.api).not.toHaveBeenCalled()
    expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'No purchases to restore' }))
  })

  it('404 (store flag off): silent no-op, no toast even in manual mode', async () => {
    mockApiModule.api.mockRejectedValue(makeApiError(404))
    const adapter = new FakeStoreBillingAdapter({ pendingTransactions: PENDING })

    const { restorePending } = useCoinPurchase(adapter)
    await restorePending('manual')

    expect(mockToast.add).not.toHaveBeenCalled()
  })

  it('auto mode swallows errors silently (fire-and-forget)', async () => {
    mockApiModule.api.mockRejectedValue(makeApiError(500))
    const adapter = new FakeStoreBillingAdapter({ pendingTransactions: PENDING })

    const { restorePending } = useCoinPurchase(adapter)
    await expect(restorePending('auto')).resolves.toBeUndefined()

    expect(mockToast.add).not.toHaveBeenCalled()
  })

  it('finishes a replayed, already-settled transaction silently (verify direct)', async () => {
    const adapter = new FakeStoreBillingAdapter({ products: [PRODUCT], purchaseResult: 'ok' })
    mockApiModule.api.mockResolvedValue({ data: { outcome: 'already_credited', finish: true, purchase: { id: 1, store: 'apple', product_id: 'coins_100', coins: 100, state: 'credited', store_transaction_id: 'tx-1', failure_reason: null }, balance: 500 } })
    const { verify } = useCoinPurchase(adapter)

    await verify({ id: 'tx-1', jws: 'jws', productId: 'coins_100', pending: false })

    expect(adapter.finished).toContain('tx-1')
    expect(mockToast.add).not.toHaveBeenCalled()
    expect(balanceStore.patch).not.toHaveBeenCalled()
  })

  it('buy + verify 503 keeps the journal entry; a later auto restore (empty store list) submits and credits it', async () => {
    coinPacksStore.status = 'ready'
    const journal = createPurchaseJournal(createMemoryStorage())
    mockApiModule.api.mockRejectedValueOnce(makeApiError(503))
    const adapter = new FakeStoreBillingAdapter({ purchaseResult: 'ok', pendingTransactions: [] })

    const { buy, restorePending } = useCoinPurchase(adapter, journal)
    await buy('coins_100')

    expect(journal.snapshot('apple').unsettled.map(entry => entry.tx.id)).toEqual(['tx-1'])
    expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'Coins on the way' }))

    mockToast.add.mockClear()
    mockApiModule.api.mockResolvedValueOnce({
      data: {
        results: [{ transaction_id: 'tx-1', outcome: 'credited', finish: true, purchase: { id: 1, store: 'apple', product_id: 'coins_100', coins: 100, state: 'credited', store_transaction_id: 'tx-1', failure_reason: null } }],
        balance: 600,
      },
    })

    await restorePending('auto')

    expect(journal.snapshot('apple').unsettled).toHaveLength(0)
    expect(journal.snapshot('apple').settledIds.has('tx-1')).toBe(true)
    expect(adapter.finished).toContain('tx-1')
    expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'Purchases restored' }))
  })

  it('skips a store-listed id that is already settled; all settled + manual → "No purchases to restore"', async () => {
    const journal = createPurchaseJournal(createMemoryStorage())
    journal.settle('apple', 'tx-1')
    const adapter = new FakeStoreBillingAdapter({ pendingTransactions: [makeTx('tx-1')] })

    const { restorePending } = useCoinPurchase(adapter, journal)
    await restorePending('manual')

    expect(mockApiModule.api).not.toHaveBeenCalled()
    expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'No purchases to restore' }))
  })

  it('cross-account: a journal entry for another user is skipped, and so is the same id from the store list', async () => {
    const journal = createPurchaseJournal(createMemoryStorage())
    journal.record('apple', 99, makeTx('tx-1'))
    const adapter = new FakeStoreBillingAdapter({ pendingTransactions: [makeTx('tx-1')] })

    const { restorePending } = useCoinPurchase(adapter, journal)
    await restorePending('manual')

    expect(mockApiModule.api).not.toHaveBeenCalled()
    expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'No purchases to restore' }))
  })

  it('sends the 20 newest store-listed items first, 40 of 50 submitted over exactly 2 calls', async () => {
    mockApiModule.api.mockResolvedValue({ data: { results: [], balance: null } })
    const journal = createPurchaseJournal(createMemoryStorage())
    const items = Array.from({ length: 50 }, (_, i) =>
      makeTx(`tx-${i}`, { purchasedAt: new Date(2026, 0, 1, 0, 0, i).toISOString() }))
    const adapter = new FakeStoreBillingAdapter({ pendingTransactions: items })

    const { restorePending } = useCoinPurchase(adapter, journal)
    await restorePending('auto')

    expect(mockApiModule.api).toHaveBeenCalledTimes(2)
    const firstBody = mockApiModule.api.mock.calls[0]![1].body as { transactions: { transaction_id: string }[] }
    const secondBody = mockApiModule.api.mock.calls[1]![1].body as { transactions: { transaction_id: string }[] }
    expect(firstBody.transactions).toHaveLength(20)
    expect(secondBody.transactions).toHaveLength(20)
    expect(firstBody.transactions.map(t => t.transaction_id)).toEqual(
      Array.from({ length: 20 }, (_, k) => `tx-${49 - k}`),
    )
    expect(secondBody.transactions.map(t => t.transaction_id)).toEqual(
      Array.from({ length: 20 }, (_, k) => `tx-${29 - k}`),
    )
  })

  it('submits journaled items before store-listed ones', async () => {
    mockApiModule.api.mockResolvedValue({ data: { results: [], balance: null } })
    const journal = createPurchaseJournal(createMemoryStorage())
    journal.record('apple', 7, makeTx('tx-journaled'))
    const adapter = new FakeStoreBillingAdapter({
      pendingTransactions: [makeTx('tx-store', { purchasedAt: new Date().toISOString() })],
    })

    const { restorePending } = useCoinPurchase(adapter, journal)
    await restorePending('auto')

    const body = mockApiModule.api.mock.calls[0]![1].body as { transactions: { transaction_id: string }[] }
    expect(body.transactions.map(t => t.transaction_id)).toEqual(['tx-journaled', 'tx-store'])
  })

  it('finish:false keeps the journal entry; manual mode toasts "Purchase still processing"', async () => {
    const journal = createPurchaseJournal(createMemoryStorage())
    journal.record('apple', 7, makeTx('tx-1'))
    mockApiModule.api.mockResolvedValue({
      data: { results: [{ transaction_id: 'tx-1', outcome: 'daily_cap_exceeded', finish: false, purchase: null }], balance: null },
    })
    const adapter = new FakeStoreBillingAdapter({ pendingTransactions: [] })

    const { restorePending } = useCoinPurchase(adapter, journal)
    await restorePending('manual')

    expect(journal.snapshot('apple').unsettled.map(entry => entry.tx.id)).toEqual(['tx-1'])
    expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'Purchase still processing' }))
  })

  it('manual, all results finish:true but none newly credited → "No purchases to restore"', async () => {
    const journal = createPurchaseJournal(createMemoryStorage())
    journal.record('apple', 7, makeTx('tx-1'))
    mockApiModule.api.mockResolvedValue({
      data: { results: [{ transaction_id: 'tx-1', outcome: 'already_credited', finish: true, purchase: null }], balance: null },
    })
    const adapter = new FakeStoreBillingAdapter({ pendingTransactions: [] })

    const { restorePending } = useCoinPurchase(adapter, journal)
    await restorePending('manual')

    expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'No purchases to restore' }))
    expect(mockToast.add).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Purchases restored' }))
  })

  it('adapter.pendingTransactions() rejecting: restore still submits journaled items', async () => {
    const journal = createPurchaseJournal(createMemoryStorage())
    journal.record('apple', 7, makeTx('tx-1'))
    mockApiModule.api.mockResolvedValue({
      data: { results: [{ transaction_id: 'tx-1', outcome: 'credited', finish: true, purchase: null }], balance: 500 },
    })
    const adapter = new FakeStoreBillingAdapter()
    vi.spyOn(adapter, 'pendingTransactions').mockRejectedValue(new Error('store unavailable'))

    const { restorePending } = useCoinPurchase(adapter, journal)
    await restorePending('auto')

    expect(mockApiModule.api).toHaveBeenCalledTimes(1)
    const body = mockApiModule.api.mock.calls[0]![1].body as { transactions: { transaction_id: string }[] }
    expect(body.transactions.map(t => t.transaction_id)).toEqual(['tx-1'])
  })
})

// ========================================
// verify() — concurrent-verify race
// ========================================

describe('verify', () => {
  it('409 in_progress: silent, resets purchasing status to ready, does not finish, journal keeps the tx', async () => {
    const journal = createPurchaseJournal(createMemoryStorage())
    journal.record('apple', 7, makeTx('tx-1'))
    mockApiModule.api.mockRejectedValue(makeApiError(409, 'error', { error_code: 'in_progress' }))
    const adapter = new FakeStoreBillingAdapter()
    const finishSpy = vi.spyOn(adapter, 'finish')
    coinPacksStore.status = 'purchasing'

    const { verify } = useCoinPurchase(adapter, journal)
    await verify(makeTx('tx-1'))

    expect(mockToast.add).not.toHaveBeenCalled()
    expect(coinPacksStore.setStatus).toHaveBeenCalledWith('ready')
    expect(finishSpy).not.toHaveBeenCalled()
    expect(journal.snapshot('apple').unsettled.map(entry => entry.tx.id)).toEqual(['tx-1'])
  })
})

// ========================================
// start() — app-wide transactionUpdated listener
// ========================================

describe('start', () => {
  it('journals the emitted update, then verifies it when signed in', async () => {
    const journal = createPurchaseJournal(createMemoryStorage())
    mockApiModule.api.mockResolvedValue({ data: { outcome: 'credited', finish: true, purchase: { id: 1, store: 'apple', product_id: 'coins_100', coins: 100, state: 'credited', store_transaction_id: 'tx-1', failure_reason: null }, balance: 500 } })
    const adapter = new FakeStoreBillingAdapter()

    const { start } = useCoinPurchase(adapter, journal)
    start()
    adapter.emitTransactionUpdated(makeTx('tx-1'))

    // Journaled synchronously, before the (unawaited) verify's network call settles.
    expect(journal.snapshot('apple').unsettled.map(entry => entry.tx.id)).toEqual(['tx-1'])

    await vi.waitFor(() => expect(journal.snapshot('apple').settledIds.has('tx-1')).toBe(true))
    expect(mockApiModule.api).toHaveBeenCalled()
  })

  it('with no auth token, journals the update but does not verify it', async () => {
    authStore.token = null
    const journal = createPurchaseJournal(createMemoryStorage())
    const adapter = new FakeStoreBillingAdapter()

    const { start } = useCoinPurchase(adapter, journal)
    start()
    adapter.emitTransactionUpdated(makeTx('tx-1'))

    expect(journal.snapshot('apple').unsettled.map(entry => entry.tx.id)).toEqual(['tx-1'])
    expect(mockApiModule.api).not.toHaveBeenCalled()
  })
})
