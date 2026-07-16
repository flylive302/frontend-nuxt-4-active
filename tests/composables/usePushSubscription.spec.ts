// ========================================
// usePushSubscription Tests
// ========================================
// Web Push was dropped with the PWA layer (ADR 0020): on web, register() and
// unregister() must be silent no-ops (no API calls, no service worker access).
// Native FCM registration is exercised at the API-call boundary.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePushSubscription } from '~/composables/notification/usePushSubscription'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

const { mockIsNativePlatform, mockApi } = vi.hoisted(() => ({
  mockIsNativePlatform: vi.fn(() => false),
  mockApi: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: mockIsNativePlatform,
    getPlatform: vi.fn(() => 'android'),
  },
}))

vi.mock('@capacitor/device', () => ({
  Device: { getId: vi.fn(async () => ({ identifier: 'device-1' })) },
}))

vi.mock('@capacitor/app', () => ({
  App: { getInfo: vi.fn(async () => ({ version: '3.1.4' })) },
}))

const { mockPushNotifications } = vi.hoisted(() => ({
  mockPushNotifications: {
    requestPermissions: vi.fn(async () => ({ receive: 'granted' })),
    register: vi.fn(async () => undefined),
    addListener: vi.fn(),
  },
}))

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: mockPushNotifications,
}))

vi.stubGlobal('useApi', () => ({ api: mockApi }))

describe('usePushSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsNativePlatform.mockReturnValue(false)
  })

  describe('on web (PWA removed, ADR 0020)', () => {
    it('register() is a no-op — no API call, no push registration', async () => {
      await expect(usePushSubscription().register()).resolves.toBeUndefined()

      expect(mockApi).not.toHaveBeenCalled()
      expect(mockPushNotifications.requestPermissions).not.toHaveBeenCalled()
    })

    it('unregister() is a no-op — no API call', async () => {
      await expect(usePushSubscription().unregister()).resolves.toBeUndefined()

      expect(mockApi).not.toHaveBeenCalled()
    })
  })

  describe('on native (FCM)', () => {
    it('register() requests permission and registers via FCM', async () => {
      mockIsNativePlatform.mockReturnValue(true)
      mockPushNotifications.addListener.mockImplementation(
        (event: string, cb: (token: { value: string }) => void) => {
          if (event === 'registration') cb({ value: 'fcm-token-1' })
          return Promise.resolve({ remove: vi.fn(async () => undefined) })
        },
      )

      await usePushSubscription().register()

      expect(mockApi).toHaveBeenCalledWith('/push/device-tokens', expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ token: 'fcm-token-1', platform: 'android' }),
      }))
    })

    it('register() stops silently when permission is denied', async () => {
      mockIsNativePlatform.mockReturnValue(true)
      mockPushNotifications.requestPermissions.mockResolvedValue({ receive: 'denied' })

      await usePushSubscription().register()

      expect(mockApi).not.toHaveBeenCalled()
    })
  })
})
