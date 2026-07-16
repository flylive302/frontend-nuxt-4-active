// ========================================
// Diamond Exchange Page Composable Tests
// ========================================
// Covers the GATE (agency membership) → EXECUTE (concurrent agency-check +
// exchange-info fetch) → REACT (toast/redirect) pipeline for the exchange
// page's open() orchestration.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import type { ExchangeInfo } from '~/types/economy/exchange'

// ── Vue reactivity as Nuxt auto-imports ──────────────────────
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('reactive', reactive)

// ========================================
// Deferred promise helper
// ========================================

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function makeExchangeInfo(overrides: Partial<ExchangeInfo> = {}): ExchangeInfo {
  return {
    coins_per_diamond: 1750,
    is_enabled: true,
    user_coins_balance: '100',
    user_diamonds_balance: 10,
    ...overrides,
  }
}

// ========================================
// Test doubles
// ========================================

function stubDependencies(options: {
  isAgencyMember: boolean
  fetchUserAgency: ReturnType<typeof vi.fn>
  fetchExchangeInfo: ReturnType<typeof vi.fn>
}) {
  const agencyStore = reactive({ isAgencyMember: options.isAgencyMember })
  const toastAdd = vi.fn()
  const navigateTo = vi.fn().mockResolvedValue(undefined)

  ;(globalThis as Record<string, unknown>).useAgencyStore = () => agencyStore
  ;(globalThis as Record<string, unknown>).useAgencyMembership = () => ({
    fetchUserAgency: options.fetchUserAgency,
  })
  ;(globalThis as Record<string, unknown>).useDiamondExchangeApi = () => ({
    fetchExchangeInfo: options.fetchExchangeInfo,
    submitExchange: vi.fn(),
    normalizeError: (e: unknown) => ({ message: e instanceof Error ? e.message : String(e) }),
  })
  ;(globalThis as Record<string, unknown>).useToast = () => ({ add: toastAdd })
  ;(globalThis as Record<string, unknown>).navigateTo = navigateTo

  return { agencyStore, toastAdd, navigateTo }
}

afterEach(() => {
  for (const key of ['useAgencyStore', 'useAgencyMembership', 'useDiamondExchangeApi', 'useToast', 'navigateTo']) {
    Reflect.deleteProperty(globalThis, key)
  }
  vi.resetModules()
})

beforeEach(() => {
  vi.resetModules()
})

// ========================================
// EXECUTE: concurrency
// ========================================

describe('EXECUTE: concurrent requests', () => {
  it('has both the agency check and exchange-info fetch in flight before either resolves', async () => {
    const agencyDeferred = createDeferred<undefined>()
    const infoDeferred = createDeferred<ExchangeInfo>()
    const fetchUserAgency = vi.fn(() => agencyDeferred.promise)
    const fetchExchangeInfo = vi.fn(() => infoDeferred.promise)

    stubDependencies({ isAgencyMember: false, fetchUserAgency, fetchExchangeInfo })

    const { useDiamondExchangePage } = await import('~/composables/economy/useDiamondExchangePage')
    const { open, isLoading, exchangeInfo } = useDiamondExchangePage()

    // Do not await — both calls should fire synchronously before any await.
    open().catch(() => {})

    expect(fetchUserAgency).toHaveBeenCalledTimes(1)
    expect(fetchExchangeInfo).toHaveBeenCalledTimes(1)
    // Neither has settled yet.
    expect(isLoading.value).toBe(true)
    expect(exchangeInfo.value).toBeNull()

    // Cleanup: settle both so the test doesn't leave a dangling promise.
    agencyDeferred.resolve(undefined)
    infoDeferred.resolve(makeExchangeInfo())
    await Promise.resolve()
    await Promise.resolve()
  })
})

// ========================================
// GATE + REACT: non-agency redirect
// ========================================

describe('GATE: non-agency member redirect', () => {
  it('redirects to /profile with an access-denied toast, exactly as before', async () => {
    const fetchUserAgency = vi.fn().mockResolvedValue(undefined)
    const fetchExchangeInfo = vi.fn().mockResolvedValue(makeExchangeInfo())

    const { toastAdd, navigateTo } = stubDependencies({
      isAgencyMember: false, // stays false — fetchUserAgency resolves but doesn't grant membership
      fetchUserAgency,
      fetchExchangeInfo,
    })

    const { useDiamondExchangePage } = await import('~/composables/economy/useDiamondExchangePage')
    const { open } = useDiamondExchangePage()

    await open()

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Access Denied',
        description: 'Only agency members can convert diamonds to coins.',
        color: 'error',
      })
    )
    expect(navigateTo).toHaveBeenCalledWith('/profile')
  })

  it('suppresses the failed-fetch toast when exchange-info settles late after redirect', async () => {
    const agencyDeferred = createDeferred<undefined>()
    const infoDeferred = createDeferred<ExchangeInfo>()
    const fetchUserAgency = vi.fn(() => agencyDeferred.promise)
    const fetchExchangeInfo = vi.fn(() => infoDeferred.promise)

    const { toastAdd, navigateTo } = stubDependencies({
      isAgencyMember: false,
      fetchUserAgency,
      fetchExchangeInfo,
    })

    const { useDiamondExchangePage } = await import('~/composables/economy/useDiamondExchangePage')
    const { open } = useDiamondExchangePage()

    const openPromise = open()

    // Agency result lands first — still not a member — redirect fires.
    agencyDeferred.resolve(undefined)
    await openPromise

    expect(navigateTo).toHaveBeenCalledWith('/profile')
    toastAdd.mockClear()

    // Exchange-info request settles (rejects) AFTER the redirect — must be harmless.
    infoDeferred.reject(new Error('network error'))
    await Promise.resolve()
    await Promise.resolve()

    expect(toastAdd).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Failed to load exchange info' })
    )
  })
})

// ========================================
// EXECUTE: form-ready state for agency members
// ========================================

describe('EXECUTE: agency member success path', () => {
  it('reveals the form (isLoading=false, exchangeInfo set) once exchange info resolves', async () => {
    const info = makeExchangeInfo({ user_diamonds_balance: 42 })
    const fetchExchangeInfo = vi.fn().mockResolvedValue(info)
    const agencyStore = reactive({ isAgencyMember: false })

    // fetchUserAgency flips membership on resolution, mirroring the real store.
    const fetchUserAgency = vi.fn(async () => {
      agencyStore.isAgencyMember = true
    })

    ;(globalThis as Record<string, unknown>).useAgencyStore = () => agencyStore
    ;(globalThis as Record<string, unknown>).useAgencyMembership = () => ({ fetchUserAgency })
    ;(globalThis as Record<string, unknown>).useDiamondExchangeApi = () => ({
      fetchExchangeInfo,
      submitExchange: vi.fn(),
      normalizeError: (e: unknown) => ({ message: e instanceof Error ? e.message : String(e) }),
    })
    ;(globalThis as Record<string, unknown>).useToast = () => ({ add: vi.fn() })
    const navigateTo = vi.fn().mockResolvedValue(undefined)
    ;(globalThis as Record<string, unknown>).navigateTo = navigateTo

    const { useDiamondExchangePage } = await import('~/composables/economy/useDiamondExchangePage')
    const { open, isLoading, exchangeInfo } = useDiamondExchangePage()

    await open()

    expect(isLoading.value).toBe(false)
    expect(exchangeInfo.value).toEqual(info)
    expect(navigateTo).not.toHaveBeenCalled()
  })
})
