/**
 * useBalanceStore — in-memory balance + sequence-guarded setter
 * (gift-authority-tick-fanout ticket 13, moved off the persisted `auth` store
 * in lucky-tap-balance-store). Older `seq` must never win, a partial patch
 * must never wipe the fields it didn't carry, and `seed()` must not touch the
 * watermark.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

describe('useBalanceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  async function setup() {
    const { useBalanceStore } = await import('../../app/stores/balance')
    const store = useBalanceStore()
    store.seed({ coins: '1000', diamonds: '50', wealth_xp: '10', charm_xp: '5' })
    return store
  }

  it('starts unseeded and reads as zero', async () => {
    const { useBalanceStore } = await import('../../app/stores/balance')
    const store = useBalanceStore()
    expect(store.isSeeded).toBe(false)
    expect(store.coins).toBeNull()
    expect(store.coinsNumber).toBe(0)
  })

  it('seed sets every field and leaves the watermark alone', async () => {
    const store = await setup()
    store.apply({ coins: '1', seq: 7 })
    store.seed({ coins: '5', diamonds: '6', wealth_xp: '7', charm_xp: '8' })
    expect(store.isSeeded).toBe(true)
    expect([store.coins, store.diamonds, store.wealthXp, store.charmXp]).toEqual(['5', '6', '7', '8'])
    expect(store.seq).toBe(7)
    expect(store.coinsNumber).toBe(5)
  })

  it('applies a balance whose seq is newer than the last applied one', async () => {
    const store = await setup()
    store.apply({ coins: '900', seq: 1 })
    expect(store.coins).toBe('900')
    expect(store.seq).toBe(1)
  })

  it('ignores a seq that is not newer (older or equal) than the last applied one', async () => {
    const store = await setup()
    store.apply({ coins: '900', seq: 5 })
    store.apply({ coins: '999999', seq: 5 }) // equal — ignored
    store.apply({ coins: '1', seq: 2 }) // older — ignored
    expect(store.coins).toBe('900')
  })

  it('ack-then-push and push-then-ack converge on the same number', async () => {
    const ackThenPush = await setup()
    ackThenPush.apply({ coins: '900', seq: 5 })
    ackThenPush.apply({ coins: '850', seq: 6 })
    expect(ackThenPush.coins).toBe('850')

    setActivePinia(createPinia())
    const pushThenAck = await setup()
    pushThenAck.apply({ coins: '850', seq: 6 })
    pushThenAck.apply({ coins: '900', seq: 5 })
    expect(pushThenAck.coins).toBe('850')
  })

  it('only patches the keys present — a coins-only apply leaves diamonds/XP untouched', async () => {
    const store = await setup()
    store.apply({ coins: '850', seq: 1 })
    expect([store.coins, store.diamonds, store.wealthXp, store.charmXp]).toEqual(['850', '50', '10', '5'])
  })

  it('seq: 0 is a no-op against the default watermark — strictly-greater', async () => {
    const store = await setup()
    store.apply({ coins: '1', seq: 0 })
    expect(store.coins).toBe('1000')
    store.apply({ coins: '2', seq: 1 })
    expect(store.coins).toBe('2')
  })

  it('patch is unguarded and partial', async () => {
    const store = await setup()
    store.apply({ coins: '900', seq: 9 })
    store.patch({ coins: '10' })
    expect(store.coins).toBe('10')
    expect(store.diamonds).toBe('50')
    expect(store.seq).toBe(9)
  })

  it('reset clears the numbers and the watermark', async () => {
    const store = await setup()
    store.apply({ coins: '1', seq: 100 })
    store.reset()
    expect(store.isSeeded).toBe(false)
    expect(store.seq).toBe(0)
    store.apply({ coins: '2', seq: 1 }) // a fresh session is not blocked by the old high seq
    expect(store.coins).toBe('2')
  })
})
