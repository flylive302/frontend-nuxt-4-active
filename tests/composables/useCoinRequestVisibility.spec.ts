// ========================================
// useCoinRequestVisibility Composable Tests
// ========================================
// Fail-closed rule (ticket 08): on Android native, the reseller "claim
// coins" UI may show ONLY once the backend has definitively confirmed
// (404) the Google catalog is off. Loading/error/available must hide it.
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupNuxtMocks, cleanupNuxtMocks } from '../helpers/nuxtMocks'

let isIosNativeMock = vi.fn(() => false)
let storeForMock = vi.fn<() => 'apple' | 'google' | null>(() => null)

vi.mock('~/utils/native-platform', () => ({
  isIosNative: () => isIosNativeMock(),
  storeFor: () => storeForMock(),
}))

let useCoinRequestVisibility: typeof import('~/composables/economy/useCoinRequestVisibility')['useCoinRequestVisibility']
let coinPacksStore: { catalogDisabled: boolean }

beforeEach(async () => {
  isIosNativeMock = vi.fn(() => false)
  storeForMock = vi.fn(() => null)
  coinPacksStore = { catalogDisabled: false }

  setupNuxtMocks({})
  ;(globalThis as Record<string, unknown>).useCoinPacksStore = () => coinPacksStore

  const mod = await import('~/composables/economy/useCoinRequestVisibility')
  useCoinRequestVisibility = mod.useCoinRequestVisibility
})

afterEach(() => {
  cleanupNuxtMocks()
  Reflect.deleteProperty(globalThis, 'useCoinPacksStore')
  vi.restoreAllMocks()
})

describe('useCoinRequestVisibility', () => {
  it('web (storeFor null): always shown', () => {
    storeForMock.mockReturnValue(null)
    const { showCoinRequests } = useCoinRequestVisibility()
    expect(showCoinRequests.value).toBe(true)
  })

  it('iOS native: always hidden, even if catalogDisabled were somehow true', () => {
    isIosNativeMock.mockReturnValue(true)
    storeForMock.mockReturnValue('apple')
    coinPacksStore.catalogDisabled = true
    const { showCoinRequests } = useCoinRequestVisibility()
    expect(showCoinRequests.value).toBe(false)
  })

  it('Android native, catalog status unknown/loading (catalogDisabled false): hidden', () => {
    storeForMock.mockReturnValue('google')
    coinPacksStore.catalogDisabled = false
    const { showCoinRequests } = useCoinRequestVisibility()
    expect(showCoinRequests.value).toBe(false)
  })

  it('Android native, catalog confirmed disabled (404): shown', () => {
    storeForMock.mockReturnValue('google')
    coinPacksStore.catalogDisabled = true
    const { showCoinRequests } = useCoinRequestVisibility()
    expect(showCoinRequests.value).toBe(true)
  })
})
