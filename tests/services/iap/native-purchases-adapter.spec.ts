// ========================================
// Native Purchases Adapter Tests
// ========================================
// Real StoreBillingAdapter over @capgo/native-purchases. Every adapter method
// dynamic-imports the plugin (see native-purchases-adapter.ts's getPlugin()
// comment: resolving the BARE plugin proxy from an async function makes the
// engine treat it as a thenable and hang forever) — so the mock below is a
// plain object, never a Proxy, matching what getPlugin() wraps it into.
// ========================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PurchaseCancelledError, PurchasePendingError } from '~/services/iap/store-billing-adapter'
import { createNativePurchasesAdapter } from '~/services/iap/native-purchases-adapter'

const {
  mockIsIosNative,
  mockIsBillingSupported,
  mockGetProducts,
  mockPurchaseProduct,
  mockGetPurchases,
  mockAcknowledgePurchase,
  mockConsumePurchase,
  mockAddListener,
} = vi.hoisted(() => ({
  mockIsIosNative: vi.fn(() => true),
  mockIsBillingSupported: vi.fn(),
  mockGetProducts: vi.fn(),
  mockPurchaseProduct: vi.fn(),
  mockGetPurchases: vi.fn(),
  mockAcknowledgePurchase: vi.fn(),
  mockConsumePurchase: vi.fn(),
  mockAddListener: vi.fn(),
}))

vi.mock('~/utils/native-platform', () => ({
  isIosNative: mockIsIosNative,
}))

vi.mock('@capgo/native-purchases', () => ({
  NativePurchases: {
    isBillingSupported: mockIsBillingSupported,
    getProducts: mockGetProducts,
    purchaseProduct: mockPurchaseProduct,
    getPurchases: mockGetPurchases,
    acknowledgePurchase: mockAcknowledgePurchase,
    consumePurchase: mockConsumePurchase,
    addListener: mockAddListener,
  },
}))

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Lets every already-queued microtask and one macrotask run. */
function flushPending(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockIsIosNative.mockReturnValue(true)
  mockAddListener.mockResolvedValue({ remove: vi.fn() })
})

// ========================================
// purchase()
// ========================================

describe('purchase', () => {
  it('calls purchaseProduct with isConsumable:false and autoAcknowledgePurchases:false', async () => {
    mockPurchaseProduct.mockResolvedValue({ transactionId: 'tx-1', jwsRepresentation: 'jws-1' })
    const adapter = createNativePurchasesAdapter()

    await adapter.purchase('coins_100')

    expect(mockPurchaseProduct).toHaveBeenCalledWith({
      productIdentifier: 'coins_100',
      isConsumable: false,
      autoAcknowledgePurchases: false,
    })
  })

  it('"Transaction pending" rejection → PurchasePendingError', async () => {
    mockPurchaseProduct.mockRejectedValue(new Error('Transaction pending'))
    const adapter = createNativePurchasesAdapter()

    await expect(adapter.purchase('coins_100')).rejects.toBeInstanceOf(PurchasePendingError)
  })

  it('"Purchase is pending" rejection → PurchasePendingError', async () => {
    mockPurchaseProduct.mockRejectedValue(new Error('Purchase is pending'))
    const adapter = createNativePurchasesAdapter()

    await expect(adapter.purchase('coins_100')).rejects.toBeInstanceOf(PurchasePendingError)
  })

  it('"User cancelled" rejection → PurchaseCancelledError', async () => {
    mockPurchaseProduct.mockRejectedValue(new Error('User cancelled the purchase'))
    const adapter = createNativePurchasesAdapter()

    await expect(adapter.purchase('coins_100')).rejects.toBeInstanceOf(PurchaseCancelledError)
  })

  it('iOS: id comes from transactionId; purchaseDate maps to purchasedAt', async () => {
    mockIsIosNative.mockReturnValue(true)
    mockPurchaseProduct.mockResolvedValue({
      transactionId: 'tx-ios-1',
      jwsRepresentation: 'jws-1',
      purchaseDate: '2026-01-01T00:00:00Z',
    })
    const adapter = createNativePurchasesAdapter()

    const tx = await adapter.purchase('coins_100')

    expect(tx.id).toBe('tx-ios-1')
    expect(tx.purchasedAt).toBe('2026-01-01T00:00:00Z')
  })

  it('Android: id comes from purchaseToken, not transactionId', async () => {
    mockIsIosNative.mockReturnValue(false)
    mockPurchaseProduct.mockResolvedValue({ purchaseToken: 'token-android-1', purchaseState: '1' })
    const adapter = createNativePurchasesAdapter()

    const tx = await adapter.purchase('coins_100')

    expect(tx.id).toBe('token-android-1')
  })

  it('Android purchaseState "2" → pending true', async () => {
    mockIsIosNative.mockReturnValue(false)
    mockPurchaseProduct.mockResolvedValue({ purchaseToken: 'token-1', purchaseState: '2' })
    const adapter = createNativePurchasesAdapter()

    const tx = await adapter.purchase('coins_100')

    expect(tx.pending).toBe(true)
  })

  it('Android purchaseState "1" → pending false', async () => {
    mockIsIosNative.mockReturnValue(false)
    mockPurchaseProduct.mockResolvedValue({ purchaseToken: 'token-1', purchaseState: '1' })
    const adapter = createNativePurchasesAdapter()

    const tx = await adapter.purchase('coins_100')

    expect(tx.pending).toBe(false)
  })
})

// ========================================
// pendingTransactions()
// ========================================

describe('pendingTransactions', () => {
  it('maps purchaseDate to purchasedAt', async () => {
    mockIsIosNative.mockReturnValue(true)
    mockGetPurchases.mockResolvedValue({
      purchases: [{ transactionId: 'tx-1', purchaseDate: '2026-02-01T00:00:00Z', productIdentifier: 'coins_100' }],
    })
    const adapter = createNativePurchasesAdapter()

    const [tx] = await adapter.pendingTransactions()

    expect(tx!.id).toBe('tx-1')
    expect(tx!.purchasedAt).toBe('2026-02-01T00:00:00Z')
  })
})

// ========================================
// onTransactionUpdated()
// ========================================

describe('onTransactionUpdated', () => {
  it('forwards native updates as StoreTransactions', async () => {
    const cb = vi.fn()
    const adapter = createNativePurchasesAdapter()

    adapter.onTransactionUpdated(cb)
    await vi.waitFor(() => expect(mockAddListener).toHaveBeenCalled())
    const nativeListener = mockAddListener.mock.calls[0]![1] as (t: Record<string, string>) => void
    nativeListener({ transactionId: 'tx-9', jwsRepresentation: 'jws-9', productIdentifier: 'coins_100' })

    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ id: 'tx-9', jws: 'jws-9', productId: 'coins_100' }))
  })

  it('swallows UNIMPLEMENTED from a shell without the billing plugin (no unhandled rejection)', async () => {
    mockAddListener.mockRejectedValue(new Error('"NativePurchases.addListener()" is not implemented on android'))
    const adapter = createNativePurchasesAdapter()

    const stop = adapter.onTransactionUpdated(vi.fn())
    await vi.waitFor(() => expect(mockAddListener).toHaveBeenCalled())
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(() => stop()).not.toThrow()
  })
})

// ========================================
// Serialized billing calls
// ========================================
// Android's plugin shares ONE BillingClient and every billing method closes it
// first, so overlapping calls cut each other off (getProducts rejects,
// getPurchases resolves an empty list). The adapter runs every billing call
// through one module-level FIFO chain. Every deferred below is settled before
// its test ends — a hung call would block the shared queue for later tests.

describe('serialized billing calls', () => {
  it('does not invoke the second plugin method until the first plugin promise settles', async () => {
    const purchases = deferred<{ purchases: unknown[] }>()
    mockGetPurchases.mockReturnValue(purchases.promise)
    mockGetProducts.mockResolvedValue({ products: [] })
    const adapter = createNativePurchasesAdapter()

    const pending = adapter.pendingTransactions()
    const products = adapter.listProducts(['coins_100'])
    await vi.waitFor(() => expect(mockGetPurchases).toHaveBeenCalledTimes(1))
    await flushPending()

    expect(mockGetProducts).not.toHaveBeenCalled()

    purchases.resolve({ purchases: [] })
    await pending
    await products

    expect(mockGetProducts).toHaveBeenCalledTimes(1)
    expect(mockGetPurchases.mock.invocationCallOrder[0]!)
      .toBeLessThan(mockGetProducts.mock.invocationCallOrder[0]!)
  })

  it('a rejected call does not block the next one, and each caller gets its own outcome', async () => {
    const purchases = deferred<{ purchases: unknown[] }>()
    mockGetPurchases.mockReturnValue(purchases.promise)
    mockIsBillingSupported.mockResolvedValue({ isBillingSupported: true })
    const adapter = createNativePurchasesAdapter()

    const first = adapter.pendingTransactions()
    const firstOutcome = expect(first).rejects.toThrow('play query failed')
    const second = adapter.isSupported()
    await vi.waitFor(() => expect(mockGetPurchases).toHaveBeenCalledTimes(1))
    await flushPending()

    expect(mockIsBillingSupported).not.toHaveBeenCalled()

    purchases.reject(new Error('play query failed'))
    await firstOutcome

    await expect(second).resolves.toBe(true)
    expect(mockIsBillingSupported).toHaveBeenCalledTimes(1)
  })

  it('serializes calls made through two separately created adapters (one shared queue)', async () => {
    const purchases = deferred<{ purchases: unknown[] }>()
    mockGetPurchases.mockReturnValue(purchases.promise)
    mockGetProducts.mockResolvedValue({ products: [] })
    const restoreAdapter = createNativePurchasesAdapter()
    const panelAdapter = createNativePurchasesAdapter()

    const restore = restoreAdapter.pendingTransactions()
    const panel = panelAdapter.listProducts(['coins_100'])
    await vi.waitFor(() => expect(mockGetPurchases).toHaveBeenCalledTimes(1))
    await flushPending()

    expect(mockGetProducts).not.toHaveBeenCalled()

    purchases.resolve({ purchases: [] })
    await restore
    await panel

    expect(mockGetProducts).toHaveBeenCalledTimes(1)
  })

  it('runs three overlapping calls strictly in the order they were started', async () => {
    const supported = deferred<{ isBillingSupported: boolean }>()
    const products = deferred<{ products: unknown[] }>()
    mockIsBillingSupported.mockReturnValue(supported.promise)
    mockGetProducts.mockReturnValue(products.promise)
    mockGetPurchases.mockResolvedValue({ purchases: [] })
    const adapter = createNativePurchasesAdapter()

    const a = adapter.isSupported()
    const b = adapter.listProducts(['coins_100'])
    const c = adapter.pendingTransactions()
    await vi.waitFor(() => expect(mockIsBillingSupported).toHaveBeenCalledTimes(1))
    await flushPending()
    expect(mockGetProducts).not.toHaveBeenCalled()
    expect(mockGetPurchases).not.toHaveBeenCalled()

    supported.resolve({ isBillingSupported: true })
    await a
    await vi.waitFor(() => expect(mockGetProducts).toHaveBeenCalledTimes(1))
    await flushPending()
    expect(mockGetPurchases).not.toHaveBeenCalled()

    products.resolve({ products: [] })
    await b
    await c

    expect(mockGetPurchases).toHaveBeenCalledTimes(1)
  })

  it('keeps the cancel mapping when purchase() waits behind another call', async () => {
    const purchases = deferred<{ purchases: unknown[] }>()
    mockGetPurchases.mockReturnValue(purchases.promise)
    mockPurchaseProduct.mockRejectedValue(new Error('User cancelled the purchase'))
    const adapter = createNativePurchasesAdapter()

    const pending = adapter.pendingTransactions()
    const purchase = adapter.purchase('coins_100')
    const purchaseOutcome = expect(purchase).rejects.toBeInstanceOf(PurchaseCancelledError)
    await vi.waitFor(() => expect(mockGetPurchases).toHaveBeenCalledTimes(1))
    await flushPending()

    expect(mockPurchaseProduct).not.toHaveBeenCalled()

    purchases.resolve({ purchases: [] })
    await pending
    await purchaseOutcome
  })

  it('never queues the transactionUpdated listener behind a billing call', async () => {
    const purchase = deferred<Record<string, string>>()
    mockPurchaseProduct.mockReturnValue(purchase.promise)
    const adapter = createNativePurchasesAdapter()

    const inFlight = adapter.purchase('coins_100')
    await vi.waitFor(() => expect(mockPurchaseProduct).toHaveBeenCalledTimes(1))
    adapter.onTransactionUpdated(vi.fn())

    await vi.waitFor(() => expect(mockAddListener).toHaveBeenCalledTimes(1))

    purchase.resolve({ transactionId: 'tx-1' })
    await inFlight
  })
})
