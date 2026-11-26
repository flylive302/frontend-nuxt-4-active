import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { readonly, ref } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('readonly', readonly)

async function makeStore() {
  const { usePrettyIdAuctionEnterStore } = await import('../../app/stores/prettyIdAuctionEnter')
  return usePrettyIdAuctionEnterStore()
}

describe('prettyIdAuctionEnter store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts closed, idle and not short of coins', async () => {
    const store = await makeStore()
    expect(store.confirmId).toBeNull()
    expect(store.isEntering).toBe(false)
    expect(store.isShortOnCoins).toBe(false)
  })

  it('setters write and reset restores the defaults', async () => {
    const store = await makeStore()
    store.setConfirmId(3)
    store.setEntering(true)
    store.setShortOnCoins(true)
    expect([store.confirmId, store.isEntering, store.isShortOnCoins]).toEqual([3, true, true])
    store.reset()
    expect([store.confirmId, store.isEntering, store.isShortOnCoins]).toEqual([null, false, false])
  })
})
