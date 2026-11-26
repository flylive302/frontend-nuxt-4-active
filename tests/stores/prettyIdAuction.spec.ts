import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, readonly, ref } from 'vue'
import { makeCard, makeMe, makeSnapshot } from '../helpers/prettyIdAuctionFixtures'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)

async function makeStore() {
  const { usePrettyIdAuctionStore } = await import('../../app/stores/prettyIdAuction')
  return usePrettyIdAuctionStore()
}

describe('prettyIdAuction store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts empty with a zero clock offset', async () => {
    const store = await makeStore()
    expect(store.auctions).toEqual([])
    expect(store.isAuctionsLoading).toBe(false)
    expect(store.isAuctionsLoaded).toBe(false)
    expect(store.isAuctionsFailed).toBe(false)
    expect(store.snapshotById(1)).toBeUndefined()
    expect(store.myStandingById(1)).toBeUndefined()
    expect(store.clockOffsetMs).toBe(0)
  })

  it('setAuctions keeps the server order, marks the list loaded and clears a failure', async () => {
    const store = await makeStore()
    store.setAuctionsFailed(true)
    const cards = [makeCard({ id: 3 }), makeCard({ id: 1 }), makeCard({ id: 2 })]
    store.setAuctions(cards)
    expect(store.auctions.map(card => card.id)).toEqual([3, 1, 2])
    expect(store.isAuctionsLoaded).toBe(true)
    expect(store.isAuctionsFailed).toBe(false)
  })

  it('setAuctionsLoading and setAuctionsFailed flip their flags', async () => {
    const store = await makeStore()
    store.setAuctionsLoading(true)
    store.setAuctionsFailed(true)
    expect(store.isAuctionsLoading).toBe(true)
    expect(store.isAuctionsFailed).toBe(true)
  })

  it('keeps one snapshot per auction id and replaces the same id', async () => {
    const store = await makeStore()
    store.setSnapshot(makeSnapshot({ id: 1, bidder_count: 0 }))
    store.setSnapshot(makeSnapshot({ id: 2 }))
    store.setSnapshot(makeSnapshot({ id: 1, bidder_count: 4 }))
    expect(store.snapshotById(1)?.bidder_count).toBe(4)
    expect(store.snapshotById(2)?.id).toBe(2)
    expect(Object.keys(store.snapshots)).toHaveLength(2)
  })

  it('keeps the viewer standing per auction id', async () => {
    const store = await makeStore()
    store.setMyStanding(1, makeMe({ entered: true }))
    store.setMyStanding(2, makeMe({ disqualified: true }))
    expect(store.myStandingById(1)?.entered).toBe(true)
    expect(store.myStandingById(2)?.disqualified).toBe(true)
  })

  it('setClockOffsetMs stores the offset', async () => {
    const store = await makeStore()
    store.setClockOffsetMs(-7_500)
    expect(store.clockOffsetMs).toBe(-7_500)
  })

  it('reset clears everything', async () => {
    const store = await makeStore()
    store.setAuctions([makeCard()])
    store.setSnapshot(makeSnapshot())
    store.setMyStanding(1, makeMe())
    store.setClockOffsetMs(500)
    store.setAuctionsFailed(true)
    store.reset()
    expect(store.auctions).toEqual([])
    expect(store.isAuctionsLoaded).toBe(false)
    expect(store.isAuctionsFailed).toBe(false)
    expect(store.snapshotById(1)).toBeUndefined()
    expect(store.myStandingById(1)).toBeUndefined()
    expect(store.clockOffsetMs).toBe(0)
  })
})
