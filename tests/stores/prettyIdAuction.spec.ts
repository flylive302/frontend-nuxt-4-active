import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, readonly, ref } from 'vue'
import { makeCard, makeMe, makeSnapshot, makeWeeklyRecord, makeWinnerEntry, makeWinnersBoard } from '../helpers/prettyIdAuctionFixtures'

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

  it('starts with no winners board, weekly record or selected winner', async () => {
    const store = await makeStore()
    expect(store.winners).toBeNull()
    expect(store.weekly).toBeNull()
    expect(store.selectedWinner).toBeNull()
    expect(store.isWinnersLoading).toBe(false)
    expect(store.isWeeklyLoading).toBe(false)
  })

  it('setWinners replaces the board and keeps its months', async () => {
    const store = await makeStore()
    store.setWinners(makeWinnersBoard({ month: '2026-11', winners: [makeWinnerEntry({ auction_id: 2 })] }))
    store.setWinners(makeWinnersBoard({ month: '2026-10', months: ['2026-11', '2026-10', '2026-09'] }))
    expect(store.winners?.month).toBe('2026-10')
    expect(store.winners?.months).toEqual(['2026-11', '2026-10', '2026-09'])
    expect(store.winners?.winners).toEqual([])
  })

  it('setWeekly replaces the record and keeps the total', async () => {
    const store = await makeStore()
    store.setWeekly(makeWeeklyRecord({ total_winning_bids: 1_000 }))
    store.setWeekly(makeWeeklyRecord({ month: '2026-10', total_winning_bids: 42_500 }))
    expect(store.weekly?.month).toBe('2026-10')
    expect(store.weekly?.total_winning_bids).toBe(42_500)
  })

  it('the history loading flags and the selected winner flip independently', async () => {
    const store = await makeStore()
    store.setWinnersLoading(true)
    expect(store.isWinnersLoading).toBe(true)
    expect(store.isWeeklyLoading).toBe(false)
    store.setWeeklyLoading(true)
    expect(store.isWeeklyLoading).toBe(true)

    const entry = makeWinnerEntry({ auction_id: 8 })
    store.setSelectedWinner(entry)
    expect(store.selectedWinner).toEqual(entry)
    store.setSelectedWinner(null)
    expect(store.selectedWinner).toBeNull()
  })

  it('reset clears everything', async () => {
    const store = await makeStore()
    store.setAuctions([makeCard()])
    store.setSnapshot(makeSnapshot())
    store.setMyStanding(1, makeMe())
    store.setClockOffsetMs(500)
    store.setAuctionsFailed(true)
    store.setWinners(makeWinnersBoard())
    store.setWeekly(makeWeeklyRecord())
    store.setSelectedWinner(makeWinnerEntry())
    store.setWinnersLoading(true)
    store.setWeeklyLoading(true)
    store.reset()
    expect(store.auctions).toEqual([])
    expect(store.isAuctionsLoaded).toBe(false)
    expect(store.isAuctionsFailed).toBe(false)
    expect(store.snapshotById(1)).toBeUndefined()
    expect(store.myStandingById(1)).toBeUndefined()
    expect(store.clockOffsetMs).toBe(0)
    expect(store.winners).toBeNull()
    expect(store.weekly).toBeNull()
    expect(store.selectedWinner).toBeNull()
    expect(store.isWinnersLoading).toBe(false)
    expect(store.isWeeklyLoading).toBe(false)
  })
})
