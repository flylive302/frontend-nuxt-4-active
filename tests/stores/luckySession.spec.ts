import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

describe('useLuckySessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('addFloater appends an entry to floatingMultipliers', async () => {
    const { useLuckySessionStore } = await import('../../app/stores/luckySession')
    const store = useLuckySessionStore()

    store.addFloater({ id: 1, multiplier: 2.5, colorClass: 'lucky-float--great' })

    expect(store.floatingMultipliers).toHaveLength(1)
    expect(store.floatingMultipliers[0]).toEqual({ id: 1, multiplier: 2.5, colorClass: 'lucky-float--great' })
  })

  // Big-win announcements migrated out of this store to the unified slide
  // overlay (ADR 0009); the store now owns floating multipliers only.
  it('$reset clears floatingMultipliers', async () => {
    const { useLuckySessionStore } = await import('../../app/stores/luckySession')
    const store = useLuckySessionStore()

    store.addFloater({ id: 1, multiplier: 5, colorClass: 'lucky-float--epic' })

    store.$reset()

    expect(store.floatingMultipliers).toHaveLength(0)
  })
})
