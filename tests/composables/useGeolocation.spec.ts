// ========================================
// useGeolocation Composable Tests
// ========================================
// nuxt-4.5-native-bff/01 — `detectCountry` used to be identical on every
// platform; native relied on `native-api-shim.client.ts` globally swapping
// `$fetch` to reach geojs.io directly. That shim is deleted (broke on Nuxt
// ≥4.5), so native now branches inside the composable itself. These tests
// pin both branches: web still hits the `/api/detect-country` BFF route
// unchanged, native calls geojs.io with the shim's old timeout/remap/never-
// throw contract.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NATIVE_GEOJS_COUNTRY_URL, NATIVE_GEOJS_TIMEOUT_MS } from '~/constants/nativeBff'
import { useGeolocation } from '~/composables/shared/useGeolocation'

// `useGeolocation` is imported statically above; `warn` must come from
// `vi.hoisted` (not a bare `const warn = vi.fn()`) because `vi.mock`/
// `vi.hoisted` are hoisted above every import in this file, including that
// one — a plain `const` would still be in its temporal dead zone when the
// mocked `createLogger()` runs at that module's top level.
const { mockIsNativePlatform, warn } = vi.hoisted(() => ({
  mockIsNativePlatform: vi.fn(() => false),
  warn: vi.fn(),
}))

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mockIsNativePlatform },
}))

let fetchMock: ReturnType<typeof vi.fn>

describe('useGeolocation.detectCountry', () => {
  beforeEach(() => {
    warn.mockClear()
    mockIsNativePlatform.mockReturnValue(false)
    fetchMock = vi.fn()
    ;(globalThis as Record<string, unknown>).$fetch = fetchMock
  })

  afterEach(() => {
    Reflect.deleteProperty(globalThis, '$fetch')
  })

  describe('on web', () => {
    it('calls the /api/detect-country BFF route with no extra options and returns its country_code', async () => {
      fetchMock.mockResolvedValueOnce({ country_code: 'FR' })

      const code = await useGeolocation().detectCountry()

      expect(code).toBe('FR')
      expect(fetchMock).toHaveBeenCalledWith('/api/detect-country')
    })

    it('warns and resolves to null when the BFF call fails', async () => {
      fetchMock.mockRejectedValueOnce(new Error('boom'))

      const code = await useGeolocation().detectCountry()

      expect(code).toBeNull()
      expect(warn).toHaveBeenCalledTimes(1)
    })
  })

  describe('on native', () => {
    beforeEach(() => {
      mockIsNativePlatform.mockReturnValue(true)
    })

    it('calls geojs.io directly with the shim timeout and uppercases the remapped country', async () => {
      fetchMock.mockResolvedValueOnce({ country: 'us' })

      const code = await useGeolocation().detectCountry()

      expect(code).toBe('US')
      expect(fetchMock).toHaveBeenCalledWith(NATIVE_GEOJS_COUNTRY_URL, { timeout: NATIVE_GEOJS_TIMEOUT_MS })
    })

    it('never throws — a failed geojs call resolves to null with no warn', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'))

      const code = await useGeolocation().detectCountry()

      expect(code).toBeNull()
      expect(warn).not.toHaveBeenCalled()
    })

    it('treats a missing country in the geojs response as null', async () => {
      fetchMock.mockResolvedValueOnce({ country: null })

      const code = await useGeolocation().detectCountry()

      expect(code).toBeNull()
    })
  })
})
