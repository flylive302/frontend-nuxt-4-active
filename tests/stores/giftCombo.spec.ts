import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

vi.stubGlobal('ref', ref)

describe('useGiftComboStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('initialises with zero state', async () => {
    const { useGiftComboStore } = await import('../../app/stores/giftCombo')
    const store = useGiftComboStore()

    expect(store.pendingRefund).toBe(0)
    expect(store.lastLuckyContext).toBeNull()
    expect(store.isLuckyComboActive).toBe(false)
  })

  describe('setLuckyContext / clearLuckyContext', () => {
    it('setLuckyContext sets lastLuckyContext and activates the flag', async () => {
      const { useGiftComboStore } = await import('../../app/stores/giftCombo')
      const store = useGiftComboStore()

      const ctx = {
        gift: { id: 7, price: 100 } as any,
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

      store.setLuckyContext({ gift: { id: 7 } as any, senderId: 1, recipientIds: [2], quantity: 1 })
      store.clearLuckyContext()

      expect(store.lastLuckyContext).toBeNull()
      expect(store.isLuckyComboActive).toBe(false)
    })
  })

  describe('$reset()', () => {
    it('clears all three fields to their initial values', async () => {
      const { useGiftComboStore } = await import('../../app/stores/giftCombo')
      const store = useGiftComboStore()

      store.setPendingRefund(200)
      store.setLuckyContext({ gift: { id: 5 } as any, senderId: 1, recipientIds: [3], quantity: 2 })

      store.$reset()

      expect(store.pendingRefund).toBe(0)
      expect(store.lastLuckyContext).toBeNull()
      expect(store.isLuckyComboActive).toBe(false)
    })
  })
})
