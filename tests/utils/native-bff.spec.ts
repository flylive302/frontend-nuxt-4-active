import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bffUrl } from '~/utils/native-bff'

// `bffUrl` replaces `native-api-shim.client.ts` (the
// global `$fetch` swap that broke once Nuxt's auto-imported `$fetch` froze its
// binding at module-eval time). These tests pin its web/native truth table.
const { mockIsNativePlatform } = vi.hoisted(() => ({
  mockIsNativePlatform: vi.fn(() => false),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mockIsNativePlatform },
}))

const API_BASE = 'https://api.flylive.example/api/v1'

describe('bffUrl', () => {
  beforeEach(() => {
    mockIsNativePlatform.mockReset()
  })

  describe('on web', () => {
    beforeEach(() => {
      mockIsNativePlatform.mockReturnValue(false)
    })

    it('returns the rooms route unchanged', () => {
      expect(bffUrl('/api/rooms', API_BASE)).toBe('/api/rooms')
    })

    it('returns the banners route unchanged', () => {
      expect(bffUrl('/api/banners', API_BASE)).toBe('/api/banners')
    })
  })

  describe('on native', () => {
    beforeEach(() => {
      mockIsNativePlatform.mockReturnValue(true)
    })

    it('resolves rooms to an absolute apiBase URL', () => {
      expect(bffUrl('/api/rooms', API_BASE)).toBe(`${API_BASE}/rooms`)
    })

    it('resolves banners to an absolute apiBase URL', () => {
      expect(bffUrl('/api/banners', API_BASE)).toBe(`${API_BASE}/event-banners`)
    })
  })
})
