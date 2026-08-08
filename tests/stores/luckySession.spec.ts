import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import type { LuckySenderBand } from '../../app/types/lucky'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

function makeBand(overrides: Partial<LuckySenderBand> = {}): LuckySenderBand {
  return {
    senderId: 1,
    senderName: 'Player',
    senderAvatar: null,
    giftName: 'Lucky Star',
    recipientName: 'Host',
    recipientCount: 1,
    quantity: 1,
    coinsWon: 0,
    slot: 0,
    phase: 'visible',
    lastActivityAt: 0,
    ...overrides,
  }
}

describe('useLuckySessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('addFloater appends an entry to floatingMultipliers', async () => {
    const { useLuckySessionStore } = await import('../../app/stores/luckySession')
    const store = useLuckySessionStore()

    store.addFloater({ id: 1, kind: 'notice', text: 'pool capped for today', colorClass: 'lucky-float--notice' })

    expect(store.floatingMultipliers).toHaveLength(1)
    expect(store.floatingMultipliers[0]?.id).toBe(1)
  })

  it('setCenterCashback overwrites the single visual and phase updates in place', async () => {
    const { useLuckySessionStore } = await import('../../app/stores/luckySession')
    const store = useLuckySessionStore()

    store.setCenterCashback({ tier: 5, multiplier: 5, coinsWon: 500, phase: 'visible', revision: 1 })
    store.setCenterCashback({ tier: 10, multiplier: 10, coinsWon: 1000, phase: 'visible', revision: 2 })

    expect(store.centerCashback?.tier).toBe(10)

    store.setCenterCashbackPhase('fading')
    expect(store.centerCashback?.phase).toBe('fading')

    store.setCenterCashback(null)
    expect(store.centerCashback).toBeNull()
  })

  it('bands upsert/patch in place and visibleBands excludes slotless bands', async () => {
    const { useLuckySessionStore } = await import('../../app/stores/luckySession')
    const store = useLuckySessionStore()

    store.upsertBand(makeBand({ senderId: 1, slot: 0 }))
    store.upsertBand(makeBand({ senderId: 2, slot: null }))
    store.patchBand(1, { quantity: 3, coinsWon: 700 })

    expect(store.senderBands.size).toBe(2)
    expect(store.senderBands.get(1)?.quantity).toBe(3)
    expect(store.senderBands.get(1)?.coinsWon).toBe(700)
    expect(store.visibleBands).toHaveLength(1)
    expect(store.visibleBands[0]?.senderId).toBe(1)

    store.removeBand(1)
    expect(store.senderBands.has(1)).toBe(false)
  })

  it('$reset clears floaters, center cashback, and bands', async () => {
    const { useLuckySessionStore } = await import('../../app/stores/luckySession')
    const store = useLuckySessionStore()

    store.addFloater({ id: 1, kind: 'notice', text: 'x', colorClass: 'lucky-float--notice' })
    store.setCenterCashback({ tier: 5, multiplier: 5, coinsWon: 500, phase: 'visible', revision: 1 })
    store.upsertBand(makeBand())

    store.$reset()

    expect(store.floatingMultipliers).toHaveLength(0)
    expect(store.centerCashback).toBeNull()
    expect(store.senderBands.size).toBe(0)
  })
})
