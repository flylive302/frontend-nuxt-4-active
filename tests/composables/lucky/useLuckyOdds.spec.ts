import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useLuckyOdds } from '~/composables/lucky/useLuckyOdds'
import { LUCKY_DRAW_STORAGE_PREFIX } from '~/constants/lucky'

// ========================================
// Mock localStorage
// ========================================
const mockStorage: Record<string, string> = {}

function setupLocalStorage() {
  ;(globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => { mockStorage[k] = v },
    removeItem: (k: string) => { Reflect.deleteProperty(mockStorage, k) },
  }
}

function clearLocalStorage() {
  for (const k of Object.keys(mockStorage)) Reflect.deleteProperty(mockStorage, k)
}

describe('useLuckyOdds', () => {
  beforeEach(() => {
    clearLocalStorage()
    setupLocalStorage()
  })

  afterEach(() => {
    clearLocalStorage()
  })

  describe('hasAcknowledged / markAcknowledged', () => {
    it('returns false for a user with no prior ack', () => {
      const { hasAcknowledged } = useLuckyOdds()
      expect(hasAcknowledged(123)).toBe(false)
    })

    it('returns true after marking acknowledged', () => {
      const { hasAcknowledged, markAcknowledged } = useLuckyOdds()
      const userId = 456

      markAcknowledged(userId)
      expect(hasAcknowledged(userId)).toBe(true)
    })

    it('persists ack across fresh composable instantiation (restart)', () => {
      const userId = 789
      const { markAcknowledged } = useLuckyOdds()

      // First instantiation: mark acknowledged
      markAcknowledged(userId)

      // Fresh instantiation (simulating app restart): should still be acknowledged
      const { hasAcknowledged: hasAck2 } = useLuckyOdds()
      expect(hasAck2(userId)).toBe(true)
    })

    it('distinguishes ack by user id (user A acked, user B not)', () => {
      const userA = 100
      const userB = 200
      const { hasAcknowledged, markAcknowledged } = useLuckyOdds()

      // User A acks
      markAcknowledged(userA)

      // Check: A acked, B not
      expect(hasAcknowledged(userA)).toBe(true)
      expect(hasAcknowledged(userB)).toBe(false)

      // User B acks
      markAcknowledged(userB)

      // Check: both acked
      expect(hasAcknowledged(userA)).toBe(true)
      expect(hasAcknowledged(userB)).toBe(true)
    })

    it('uses correct localStorage key format', () => {
      const userId = 999
      const { markAcknowledged } = useLuckyOdds()

      markAcknowledged(userId)

      const expectedKey = `${LUCKY_DRAW_STORAGE_PREFIX}${userId}`
      expect(localStorage.getItem(expectedKey)).toBe('1')
    })

  })
})
