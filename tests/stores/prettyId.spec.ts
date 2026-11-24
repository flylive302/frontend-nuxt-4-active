import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, readonly, ref } from 'vue'
import { makeMe, SERVER_NOW } from '../helpers/prettyIdFixtures'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)

const DEVICE_NOW = Date.parse(SERVER_NOW)

async function makeStore() {
  const { usePrettyIdStore } = await import('../../app/stores/prettyId')
  return usePrettyIdStore()
}

describe('prettyId store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(DEVICE_NOW)
  })

  afterEach(() => vi.useRealTimers())

  it('starts empty on the 6-digit list', async () => {
    const store = await makeStore()
    expect(store.me).toBeNull()
    expect(store.listLength).toBe(6)
    expect(store.listTier).toBeNull()
    expect(store.level).toBe(0)
  })

  it('setMe stores me and level', async () => {
    const store = await makeStore()
    store.setMe(makeMe())
    expect(store.me?.slots.lv17.id).toBeNull()
    expect(store.level).toBe(20)
  })

  it('setMe(null) clears me', async () => {
    const store = await makeStore()
    store.setMe(makeMe())
    store.setMe(null)
    expect(store.me).toBeNull()
    expect(store.level).toBe(0)
  })

  it('setList / setListLength / setListTier / setListLoading update the list state', async () => {
    const store = await makeStore()
    store.setListLength(4)
    store.setListTier('lucky')
    store.setListLoading(true)
    store.setList([{ id: '1234', tier: 'lucky' }], 99)
    expect(store.listLength).toBe(4)
    expect(store.listTier).toBe('lucky')
    expect(store.isListLoading).toBe(true)
    expect(store.items).toEqual([{ id: '1234', tier: 'lucky' }])
    expect(store.itemsTotal).toBe(99)
  })

  it('setSearch stores the query with its result', async () => {
    const store = await makeStore()
    const result = { id: '777777', available: true, reason: null, message: null, tier: 'repeat' as const, suggestions: [] }
    store.setSearch('777777', null)
    expect(store.searchQuery).toBe('777777')
    expect(store.searchResult).toBeNull()
    store.setSearch('777777', result)
    expect(store.searchResult).toEqual(result)
    store.setSearching(true)
    expect(store.isSearching).toBe(true)
  })

  it('claim flow setters', async () => {
    const store = await makeStore()
    store.setClaimTarget('123456')
    store.setClaiming(true)
    store.setRaceConflict({ id: '123456', suggestions: [] })
    store.setCelebration({ id: '123456', slot: 'lv17' })
    expect(store.claimTarget).toBe('123456')
    expect(store.isClaiming).toBe(true)
    expect(store.raceConflict?.id).toBe('123456')
    expect(store.celebration).toEqual({ id: '123456', slot: 'lv17' })
  })

  it('reset returns every field to its default', async () => {
    const store = await makeStore()
    store.setMe(makeMe())
    store.setListLength(4)
    store.setListTier('mirror')
    store.setClaimTarget('1234')
    store.setCelebration({ id: '1234', slot: 'lv34' })
    store.reset()
    expect(store.me).toBeNull()
    expect(store.listLength).toBe(6)
    expect(store.listTier).toBeNull()
    expect(store.claimTarget).toBeNull()
    expect(store.celebration).toBeNull()
  })
})
