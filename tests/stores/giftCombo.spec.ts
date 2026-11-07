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

  describe('won-this-combo sum + refusal pause (gift-cashback-latency 06)', () => {
    const luckyCtx = () => ({ gift: { id: 7, price: 100 } as Gift, senderId: 1, recipientIds: [2], quantity: 1 })

    it('starts at zero and unpaused', async () => {
      const { useGiftComboStore } = await import('../../app/stores/giftCombo')
      const store = useGiftComboStore()

      expect(store.luckyComboWonCoins).toBe(0)
      expect(store.isLuckyComboPaused).toBe(false)
    })

    it('addLuckyComboWon accumulates deltas', async () => {
      const { useGiftComboStore } = await import('../../app/stores/giftCombo')
      const store = useGiftComboStore()
      const deltas = [500, 200, 1]

      store.setLuckyContext(luckyCtx())
      for (const delta of deltas) store.addLuckyComboWon(delta)

      expect(store.luckyComboWonCoins).toBe(deltas.reduce((sum, d) => sum + d, 0))
    })

    it('a new combo starts from zero won and enabled', async () => {
      const { useGiftComboStore } = await import('../../app/stores/giftCombo')
      const store = useGiftComboStore()

      store.setLuckyContext(luckyCtx())
      store.addLuckyComboWon(700)
      store.setLuckyComboPaused(true)

      store.setLuckyContext(luckyCtx())

      expect(store.luckyComboWonCoins).toBe(0)
      expect(store.isLuckyComboPaused).toBe(false)
    })

    it('ending the combo resets the won sum and the pause', async () => {
      const { useGiftComboStore } = await import('../../app/stores/giftCombo')
      const store = useGiftComboStore()

      store.setLuckyContext(luckyCtx())
      store.addLuckyComboWon(700)
      store.setLuckyComboPaused(true)

      store.clearLuckyContext()

      expect(store.luckyComboWonCoins).toBe(0)
      expect(store.isLuckyComboPaused).toBe(false)
    })

    it('$reset clears the won sum and the pause', async () => {
      const { useGiftComboStore } = await import('../../app/stores/giftCombo')
      const store = useGiftComboStore()

      store.setLuckyContext(luckyCtx())
      store.addLuckyComboWon(700)
      store.setLuckyComboPaused(true)

      store.$reset()

      expect(store.luckyComboWonCoins).toBe(0)
      expect(store.isLuckyComboPaused).toBe(false)
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
