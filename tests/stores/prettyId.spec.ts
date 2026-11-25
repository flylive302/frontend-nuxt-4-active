import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, readonly, ref } from 'vue'
import { makeClaimed, makeItem, makeMe } from '../helpers/prettyIdFixtures'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)

async function makeStore() {
  const { usePrettyIdStore } = await import('../../app/stores/prettyId')
  return usePrettyIdStore()
}

describe('prettyId store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts empty on the 6-digit tier with no filter', async () => {
    const store = await makeStore()
    expect(store.me).toBeNull()
    expect(store.activeTier).toBe(6)
    expect(store.category).toBeNull()
    expect(store.wealthLevel).toBe(0)
    expect(store.tierMode).toBe('loading')
    expect(store.browseTier).toBeNull()
  })

  it('setMe stores me and the wealth level', async () => {
    const store = await makeStore()
    store.setMe(makeMe())
    expect(store.me?.tiers).toHaveLength(2)
    expect(store.wealthLevel).toBe(20)
    store.setMe(null)
    expect(store.me).toBeNull()
    expect(store.wealthLevel).toBe(0)
  })

  describe('tierMode', () => {
    it('is browse for an unlocked, unclaimed tier', async () => {
      const store = await makeStore()
      store.setMe(makeMe())
      expect(store.tierMode).toBe('browse')
      expect(store.browseTier).toBe(6)
      expect(store.activeTierState?.required_level).toBe(17)
    })

    it('is locked for a locked tier and follows the active tier', async () => {
      const store = await makeStore()
      store.setMe(makeMe())
      store.setActiveTier(4)
      expect(store.tierMode).toBe('locked')
      expect(store.browseTier).toBeNull()
    })

    it('is claimed once a number is claimed, even if the tier also reads locked', async () => {
      const store = await makeStore()
      store.setMe(makeMe({}, { six: { claimed: makeClaimed('123456') }, four: { unlocked: false } }))
      expect(store.tierMode).toBe('claimed')
      store.setActiveTier(4)
      expect(store.tierMode).toBe('locked')
    })

    it('is loading when me has no state for the tier', async () => {
      const store = await makeStore()
      store.setMe({ wealth_level: 1, tiers: [] })
      expect(store.tierMode).toBe('loading')
    })
  })

  describe('list', () => {
    it('setList replaces the page, cursor and total', async () => {
      const store = await makeStore()
      store.setList([makeItem('111111')], 40, 'c1')
      expect(store.items).toEqual([makeItem('111111')])
      expect(store.itemsTotal).toBe(40)
      expect(store.nextCursor).toBe('c1')
      expect(store.hasMore).toBe(true)
    })

    it('appendList adds the next page and skips a number already listed', async () => {
      const store = await makeStore()
      store.setList([makeItem('111111'), makeItem('222222')], 4, 'c1')
      store.appendList([makeItem('222222'), makeItem('333333')], 3, null)
      expect(store.items.map(item => item.signature)).toEqual(['111111', '222222', '333333'])
      expect(store.itemsTotal).toBe(3)
      expect(store.hasMore).toBe(false)
    })

    it('clearList empties the list and the failure flag', async () => {
      const store = await makeStore()
      store.setList([makeItem('111111')], 1, 'c1')
      store.setListFailed(true)
      store.clearList()
      expect(store.items).toEqual([])
      expect(store.itemsTotal).toBe(0)
      expect(store.nextCursor).toBeNull()
      expect(store.isListFailed).toBe(false)
    })
  })

  it('setSearch stores the query, status and result', async () => {
    const store = await makeStore()
    store.setSearch('777777', 'searching')
    expect(store.searchStatus).toBe('searching')
    expect(store.searchResult).toBeNull()
    store.setSearch('777777', 'available', makeItem('777777'))
    expect(store.searchQuery).toBe('777777')
    expect(store.searchResult).toEqual(makeItem('777777'))
  })

  it('claim flow setters', async () => {
    const store = await makeStore()
    store.setClaimTarget(makeItem('123456', 'mirror'))
    store.setClaiming(true)
    store.setRaceConflict({ signature: '123456' })
    store.setCelebration({ signature: '123456', tier: 6, category: 'mirror' })
    expect(store.claimTarget).toEqual(makeItem('123456', 'mirror'))
    expect(store.isClaiming).toBe(true)
    expect(store.raceConflict?.signature).toBe('123456')
    expect(store.celebration).toEqual({ signature: '123456', tier: 6, category: 'mirror' })
  })

  it('reset returns every field to its default', async () => {
    const store = await makeStore()
    store.setMe(makeMe())
    store.setActiveTier(4)
    store.setCategory('mirror')
    store.setList([makeItem('1234')], 1, 'c')
    store.setSearch('1234', 'available', makeItem('1234'))
    store.setClaimTarget(makeItem('1234'))
    store.setCelebration({ signature: '1234', tier: 4, category: 'lucky' })
    store.reset()
    expect(store.me).toBeNull()
    expect(store.activeTier).toBe(6)
    expect(store.category).toBeNull()
    expect(store.items).toEqual([])
    expect(store.nextCursor).toBeNull()
    expect(store.searchStatus).toBe('idle')
    expect(store.claimTarget).toBeNull()
    expect(store.celebration).toBeNull()
  })
})
