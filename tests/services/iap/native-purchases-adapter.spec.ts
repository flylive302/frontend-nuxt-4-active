// ========================================
// Native Purchases Adapter Tests
// ========================================
// Real StoreBillingAdapter over @capgo/native-purchases. Every adapter method
// dynamic-imports the plugin (see native-purchases-adapter.ts's getPlugin()
// comment: resolving the BARE plugin proxy from an async function makes the
// engine treat it as a thenable and hang forever) — so the mock below is a
// plain object, never a Proxy, matching what getPlugin() wraps it into.
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PurchaseCancelledError, PurchaseNotCompletedError, PurchasePendingError } from '~/services/iap/store-billing-adapter'
import { createNativePurchasesAdapter } from '~/services/iap/native-purchases-adapter'
import { IAP_PURCHASE_SHEET_OPEN_CEILING_MS, IAP_PURCHASE_RESUME_GRACE_MS } from '~/constants/economy/iapConstants'

const {
  mockIsIosNative,
  mockIsBillingSupported,
  mockGetProducts,
  mockPurchaseProduct,
  mockGetPurchases,
  mockAcknowledgePurchase,
  mockConsumePurchase,
  mockAddListener,
  appListeners,
  mockAppAddListener,
  mockAppListenerRemove,
} = vi.hoisted(() => ({
  mockIsIosNative: vi.fn(() => true),
  mockIsBillingSupported: vi.fn(),
  mockGetProducts: vi.fn(),
  mockPurchaseProduct: vi.fn(),
  mockGetPurchases: vi.fn(),
  mockAcknowledgePurchase: vi.fn(),
  mockConsumePurchase: vi.fn(),
  mockAddListener: vi.fn(),
  appListeners: {} as Record<string, Array<() => void>>,
  mockAppAddListener: vi.fn(),
  mockAppListenerRemove: vi.fn(),
}))

vi.mock('@capacitor/app', () => ({
  App: { addListener: mockAppAddListener },
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

/** Fires a Capacitor App lifecycle event at every listener still registered. */
function fireApp(event: 'pause' | 'resume'): void {
  for (const fn of appListeners[event] ?? []) fn()
}

beforeEach(() => {
  vi.clearAllMocks()
  mockIsIosNative.mockReturnValue(true)
  mockAddListener.mockResolvedValue({ remove: vi.fn() })
  for (const key of Object.keys(appListeners)) Reflect.deleteProperty(appListeners, key)
  mockAppAddListener.mockImplementation((event: string, fn: () => void) => {
    ;(appListeners[event] ??= []).push(fn)
    return Promise.resolve({
      remove: () => {
        mockAppListenerRemove(event)
        appListeners[event] = (appListeners[event] ?? []).filter(l => l !== fn)
      },
    })
  })
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

// ========================================
// Android: "Purchase is not purchased" (bug 2)
// ========================================
// The plugin's onPurchasesUpdated rejects USER_CANCELED, ITEM_ALREADY_OWNED and
// every other non-OK Play result with this one text — not a "failed" outcome.

describe('purchase — "Purchase is not purchased"', () => {
  it('Android → PurchaseNotCompletedError', async () => {
    mockIsIosNative.mockReturnValue(false)
    mockPurchaseProduct.mockRejectedValue(new Error('Purchase is not purchased'))
    const adapter = createNativePurchasesAdapter()

    await expect(adapter.purchase('coins_100')).rejects.toBeInstanceOf(PurchaseNotCompletedError)
  })

  it('iOS → passed through untouched (not an iOS plugin message)', async () => {
    mockIsIosNative.mockReturnValue(true)
    mockPurchaseProduct.mockRejectedValue(new Error('Purchase is not purchased'))
    const adapter = createNativePurchasesAdapter()

    const outcome = adapter.purchase('coins_100')
    await expect(outcome).rejects.toThrow('Purchase is not purchased')
    await expect(outcome).rejects.not.toBeInstanceOf(PurchaseNotCompletedError)
  })
})

// ========================================
// Android purchase hang guard (bug 1)
// ========================================
// launchBillingFlow's non-OK result is only logged by the plugin, so a purchase
// call can hang and hold the shared billing queue. Fake timers are scoped to
// this block; every deferred is settled so the module-level queue is clean.

describe('purchase — Android hang guard', () => {
  beforeEach(() => {
    // Only the guard's own timers — faking more stalls the plugin's dynamic import.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    mockIsIosNative.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** Lets the dynamic import and queue hops finish without moving the fake clock. */
  async function flush(): Promise<void> {
    await new Promise<void>(resolve => setImmediate(resolve))
    await new Promise<void>(resolve => setImmediate(resolve))
  }

  /** Waits (real time, Date is not faked) until purchaseProduct was invoked — the guard is armed right after. */
  async function untilPurchaseStarted(times = 1): Promise<void> {
    const deadline = Date.now() + 4000
    while (mockPurchaseProduct.mock.calls.length < times && Date.now() < deadline) await flush()
    expect(mockPurchaseProduct).toHaveBeenCalledTimes(times)
    await flush()
  }

  it('ceiling: an unsettled call rejects PurchaseNotCompletedError and releases the queue', async () => {
    const hung = deferred<Record<string, string>>()
    mockPurchaseProduct.mockReturnValue(hung.promise)
    mockIsBillingSupported.mockResolvedValue({ isBillingSupported: true })
    const adapter = createNativePurchasesAdapter()

    const purchase = adapter.purchase('coins_100')
    const outcome = expect(purchase).rejects.toBeInstanceOf(PurchaseNotCompletedError)
    const next = adapter.isSupported()
    await untilPurchaseStarted()

    await vi.advanceTimersByTimeAsync(IAP_PURCHASE_SHEET_OPEN_CEILING_MS - 1)
    expect(mockIsBillingSupported).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await outcome
    await expect(next).resolves.toBe(true)
    expect(mockIsBillingSupported).toHaveBeenCalledTimes(1)

    // A late plugin settle after the release is harmless (no unhandled rejection).
    hung.reject(new Error('Purchase is not purchased'))
    await flush()
  })

  it('once the sheet opened (pause), the ceiling never fires — a user may take minutes to pay', async () => {
    const call = deferred<Record<string, string>>()
    mockPurchaseProduct.mockReturnValue(call.promise)
    const adapter = createNativePurchasesAdapter()
    let settled = false

    const purchase = adapter.purchase('coins_100')
    purchase.then(() => { settled = true }, () => { settled = true })
    await untilPurchaseStarted()

    fireApp('pause') // sheet opened
    await vi.advanceTimersByTimeAsync(IAP_PURCHASE_SHEET_OPEN_CEILING_MS * 20)
    expect(settled).toBe(false)

    call.resolve({ purchaseToken: 'token-1', purchaseState: '1' })
    await expect(purchase).resolves.toEqual(expect.objectContaining({ id: 'token-1' }))
  })

  it('a late SUCCESS after the release is dropped, not returned to anyone', async () => {
    const hung = deferred<Record<string, string>>()
    mockPurchaseProduct.mockReturnValue(hung.promise)
    const adapter = createNativePurchasesAdapter()

    const purchase = adapter.purchase('coins_100')
    const outcome = expect(purchase).rejects.toBeInstanceOf(PurchaseNotCompletedError)
    await untilPurchaseStarted()
    await vi.advanceTimersByTimeAsync(IAP_PURCHASE_SHEET_OPEN_CEILING_MS)
    await outcome

    hung.resolve({ purchaseToken: 'late-token', purchaseState: '1' })
    await flush()
    await expect(purchase).rejects.toBeInstanceOf(PurchaseNotCompletedError)
  })

  it('resume: released IAP_PURCHASE_RESUME_GRACE_MS after the app resumes with the call still open', async () => {
    const hung = deferred<Record<string, string>>()
    mockPurchaseProduct.mockReturnValue(hung.promise)
    const adapter = createNativePurchasesAdapter()

    const purchase = adapter.purchase('coins_100')
    const outcome = expect(purchase).rejects.toBeInstanceOf(PurchaseNotCompletedError)
    await untilPurchaseStarted()

    fireApp('pause') // sheet opened
    await vi.advanceTimersByTimeAsync(60_000) // user taking their time — not released
    fireApp('resume') // sheet gone
    await vi.advanceTimersByTimeAsync(IAP_PURCHASE_RESUME_GRACE_MS)
    await outcome

    hung.reject(new Error('Purchase is not purchased'))
    await flush()
  })

  it('a pause inside the grace window cancels the resume countdown', async () => {
    const call = deferred<Record<string, string>>()
    mockPurchaseProduct.mockReturnValue(call.promise)
    const adapter = createNativePurchasesAdapter()
    let settled = false

    const purchase = adapter.purchase('coins_100')
    purchase.then(() => { settled = true }, () => { settled = true })
    await untilPurchaseStarted()

    fireApp('resume')
    await vi.advanceTimersByTimeAsync(IAP_PURCHASE_RESUME_GRACE_MS - 1)
    fireApp('pause') // sheet (re)opened
    await vi.advanceTimersByTimeAsync(IAP_PURCHASE_RESUME_GRACE_MS * 3)
    expect(settled).toBe(false)

    call.resolve({ purchaseToken: 'token-1', purchaseState: '1' })
    await expect(purchase).resolves.toEqual(expect.objectContaining({ id: 'token-1' }))
  })

  it('a call that settles normally removes its listeners and never releases later', async () => {
    mockPurchaseProduct.mockResolvedValue({ purchaseToken: 'token-1', purchaseState: '1' })
    const adapter = createNativePurchasesAdapter()

    await expect(adapter.purchase('coins_100')).resolves.toEqual(expect.objectContaining({ id: 'token-1' }))
    await flush()

    expect(mockAppListenerRemove).toHaveBeenCalledWith('resume')
    expect(mockAppListenerRemove).toHaveBeenCalledWith('pause')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a shell without the App plugin still gets the ceiling', async () => {
    mockAppAddListener.mockRejectedValue(new Error('"App" plugin is not implemented on android'))
    const hung = deferred<Record<string, string>>()
    mockPurchaseProduct.mockReturnValue(hung.promise)
    const adapter = createNativePurchasesAdapter()

    const purchase = adapter.purchase('coins_100')
    const outcome = expect(purchase).rejects.toBeInstanceOf(PurchaseNotCompletedError)
    await untilPurchaseStarted()
    await vi.advanceTimersByTimeAsync(IAP_PURCHASE_SHEET_OPEN_CEILING_MS)
    await outcome

    hung.reject(new Error('late'))
    await flush()
  })

  it('iOS: no guard — the call is awaited as is', async () => {
    mockIsIosNative.mockReturnValue(true)
    const call = deferred<Record<string, string>>()
    mockPurchaseProduct.mockReturnValue(call.promise)
    const adapter = createNativePurchasesAdapter()
    let settled = false

    const purchase = adapter.purchase('coins_100')
    purchase.then(() => { settled = true }, () => { settled = true })
    await untilPurchaseStarted()
    await vi.advanceTimersByTimeAsync(IAP_PURCHASE_SHEET_OPEN_CEILING_MS * 2)

    expect(settled).toBe(false)
    expect(mockAppAddListener).not.toHaveBeenCalled()

    call.resolve({ transactionId: 'tx-ios' })
    await expect(purchase).resolves.toEqual(expect.objectContaining({ id: 'tx-ios' }))
  })
})
