import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { readonly, ref } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('readonly', readonly)

async function makeStore() {
  const { usePrettyIdAuctionBidStore } = await import('../../app/stores/prettyIdAuctionBid')
  return usePrettyIdAuctionBidStore()
}

describe('prettyIdAuctionBid store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts empty, closed, idle and not short of coins', async () => {
    const store = await makeStore()
    expect(store.draft).toBe('')
    expect(store.draftAuctionId).toBeNull()
    expect(store.confirmId).toBeNull()
    expect(store.confirmAmount).toBe(0)
    expect(store.isBidding).toBe(false)
    expect(store.isShortOnCoins).toBe(false)
  })

  it('setDraft writes the text and the auction it belongs to', async () => {
    const store = await makeStore()
    store.setDraft(4, '250000')
    expect([store.draft, store.draftAuctionId]).toEqual(['250000', 4])
  })

  it('setConfirm opens with an amount; closing keeps the amount so a fading dialog does not blank', async () => {
    const store = await makeStore()
    store.setConfirm(3, 500_000)
    expect([store.confirmId, store.confirmAmount]).toEqual([3, 500_000])
    store.setConfirm(null)
    expect([store.confirmId, store.confirmAmount]).toEqual([null, 500_000])
  })

  it('setters write and reset restores the defaults', async () => {
    const store = await makeStore()
    store.setDraft(3, '9')
    store.setConfirm(3, 9)
    store.setBidding(true)
    store.setShortOnCoins(true)
    expect([store.isBidding, store.isShortOnCoins]).toEqual([true, true])
    store.reset()
    expect([store.draft, store.draftAuctionId, store.confirmId, store.confirmAmount, store.isBidding, store.isShortOnCoins])
      .toEqual(['', null, null, 0, false, false])
  })
})
