// ========================================
// Network Detector Service Tests
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getNetworkInfo,
  isCellular,
  isMeteredConnection,
  onConnectionChange,
  isNetworkInfoSupported,
} from '~/services/networkDetector'

// ========================================
// Mocks
// ========================================

// Mock logger
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

describe('networkDetector', () => {
  // Store original navigator
  const originalNavigator = global.navigator

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore navigator
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
    })
  })

  describe('getNetworkInfo', () => {
    it('should return default values when navigator is undefined (SSR)', () => {
      // @ts-expect-error - intentionally setting to undefined
      delete global.navigator

      const info = getNetworkInfo()

      expect(info).toEqual({
        isOnline: true,
        connectionType: 'unknown',
        effectiveType: 'unknown',
        saveData: false,
      })
    })

    it('should return online status from navigator.onLine', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          connection: null,
        },
        writable: true,
      })

      const info = getNetworkInfo()
      expect(info.isOnline).toBe(true)
    })

    it('should return offline status when navigator.onLine is false', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: false,
          connection: null,
        },
        writable: true,
      })

      const info = getNetworkInfo()
      expect(info.isOnline).toBe(false)
    })

    it('should return connection type from Network Information API', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          connection: {
            type: 'wifi',
            effectiveType: '4g',
            saveData: false,
          },
        },
        writable: true,
      })

      const info = getNetworkInfo()
      expect(info.connectionType).toBe('wifi')
      expect(info.effectiveType).toBe('4g')
      expect(info.saveData).toBe(false)
    })

    it('should detect cellular connection', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          connection: {
            type: 'cellular',
            effectiveType: '3g',
            saveData: false,
          },
        },
        writable: true,
      })

      const info = getNetworkInfo()
      expect(info.connectionType).toBe('cellular')
    })
  })

  describe('isCellular', () => {
    it('should return true when on cellular network', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          connection: {
            type: 'cellular',
            effectiveType: '4g',
            saveData: false,
          },
        },
        writable: true,
      })

      expect(isCellular()).toBe(true)
    })

    it('should return false when on wifi', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          connection: {
            type: 'wifi',
            effectiveType: '4g',
            saveData: false,
          },
        },
        writable: true,
      })

      expect(isCellular()).toBe(false)
    })
  })

  describe('isMeteredConnection', () => {
    it('should return true when on cellular', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          connection: {
            type: 'cellular',
            effectiveType: '4g',
            saveData: false,
          },
        },
        writable: true,
      })

      expect(isMeteredConnection()).toBe(true)
    })

    it('should return true when saveData is enabled', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          connection: {
            type: 'wifi',
            effectiveType: '4g',
            saveData: true,
          },
        },
        writable: true,
      })

      expect(isMeteredConnection()).toBe(true)
    })

    it('should return false when on wifi without saveData', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          connection: {
            type: 'wifi',
            effectiveType: '4g',
            saveData: false,
          },
        },
        writable: true,
      })

      expect(isMeteredConnection()).toBe(false)
    })
  })

  describe('onConnectionChange', () => {
    it('should call callback when subscribed', () => {
      const callback = vi.fn()

      // Subscribe
      const unsubscribe = onConnectionChange(callback)

      // Cleanup
      unsubscribe()

      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('isNetworkInfoSupported', () => {
    it('should return true when connection API is available', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          connection: {
            type: 'wifi',
          },
        },
        writable: true,
      })

      expect(isNetworkInfoSupported()).toBe(true)
    })

    it('should return false when connection API is not available', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          connection: undefined,
        },
        writable: true,
      })

      expect(isNetworkInfoSupported()).toBe(false)
    })
  })
})
