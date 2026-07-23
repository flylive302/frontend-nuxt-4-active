import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import type { Gift } from '~/types/gift/gift'

vi.stubGlobal('ref', ref)

describe('useGiftComboStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('initialises with zero state', async () => {
    const { useGiftComboStore } = await import('../../app/stores/giftCombo')
    const store = useGiftComboStore()

    expect(store.pendingRefunds.size).toBe(0)
    expect(store.lastLuckyContext).toBeNull()
    expect(store.isLuckyComboActive).toBe(false)
  })

  describe('setPendingRefund / consumePendingRefund', () => {
    it('tracks a refund amount per batchId and consuming it removes the entry', async () => {
      const { useGiftComboStore } = await import('../../app/stores/giftCombo')
      const store = useGiftComboStore()

      store.setPendingRefund('batch-a', 500)

      expect(store.consumePendingRefund('batch-a')).toBe(500)
      // Consumed — a second read returns 0, not the stale amount.
      expect(store.consumePendingRefund('batch-a')).toBe(0)
    })

    it('overlapping sends each track and consume their own batch independently (regression: scalar last-write-wins bug)', async () => {
      const { useGiftComboStore } = await import('../../app/stores/giftCombo')
      const store = useGiftComboStore()

      store.setPendingRefund('batch-a', 100)
      store.setPendingRefund('batch-b', 250)

      // Consuming batch-b must not clear or corrupt batch-a's tracked amount.
      expect(store.consumePendingRefund('batch-b')).toBe(250)
      expect(store.consumePendingRefund('batch-a')).toBe(100)
    })

    it('consuming an unknown batchId returns 0', async () => {
      const { useGiftComboStore } = await import('../../app/stores/giftCombo')
      const store = useGiftComboStore()

      expect(store.consumePendingRefund('never-tracked')).toBe(0)
    })
  })

  describe('setLuckyContext / clearLuckyContext', () => {
    it('setLuckyContext sets lastLuckyContext and activates the flag', async () => {
      const { useGiftComboStore } = await import('../../app/stores/giftCombo')
      const store = useGiftComboStore()

      const ctx = {
        gift: { id: 7, price: 100 } as Gift,
        senderId: 1,
        recipientIds: [2, 3],
        quantity: 1,
      }

      store.setLuckyContext(ctx)

      expect(store.lastLuckyContext).toEqual(ctx)
      expect(store.isLuckyComboActive).toBe(true)
    })

    it('clearLuckyContext nulls lastLuckyContext and deactivates the flag', async () => {
      const { useGiftComboStore } = await import('../../app/stores/giftCombo')
      const store = useGiftComboStore()

      store.setLuckyContext({ gift: { id: 7 } as Gift, senderId: 1, recipientIds: [2], quantity: 1 })
      store.clearLuckyContext()

      expect(store.lastLuckyContext).toBeNull()
      expect(store.isLuckyComboActive).toBe(false)
    })
  })

  describe('$reset()', () => {
    it('clears all fields to their initial values', async () => {
      const { useGiftComboStore } = await import('../../app/stores/giftCombo')
      const store = useGiftComboStore()

      store.setPendingRefund('batch-a', 200)
      store.setLuckyContext({ gift: { id: 5 } as Gift, senderId: 1, recipientIds: [3], quantity: 2 })

      store.$reset()

      expect(store.pendingRefunds.size).toBe(0)
      expect(store.lastLuckyContext).toBeNull()
      expect(store.isLuckyComboActive).toBe(false)
    })
  })
})
