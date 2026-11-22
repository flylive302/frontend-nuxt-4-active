import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, readonly, ref } from 'vue'
import { makeLot } from '../helpers/prettyIdFixtures'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)

const lot = makeLot

async function makeStore() {
  const { usePrettyIdAuctionStore } = await import('../../app/stores/prettyIdAuction')
  return usePrettyIdAuctionStore()
}

describe('prettyIdAuction store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('setLots replaces the list and lotById finds a lot', async () => {
    const store = await makeStore()
    store.setLots([lot(1), lot(2)])
    expect(store.lots.map(l => l.id)).toEqual([1, 2])
    expect(store.lotById(2)?.number).toBe('2')
    expect(store.lotById(9)).toBeUndefined()
  })

  it('upsertLot replaces a lot with the same id in place', async () => {
    const store = await makeStore()
    store.setLots([lot(1), lot(2), lot(3)])
    store.upsertLot(lot(2, { highest_bid: 5_000, you_are_highest: true }))
    expect(store.lots.map(l => l.id)).toEqual([1, 2, 3])
    expect(store.lotById(2)?.highest_bid).toBe(5_000)
    expect(store.lotById(2)?.you_are_highest).toBe(true)
  })

  it('upsertLot appends an unknown lot', async () => {
    const store = await makeStore()
    store.setLots([lot(1)])
    store.upsertLot(lot(7))
    expect(store.lots.map(l => l.id)).toEqual([1, 7])
  })

  it('upsertLot swaps the array so a pending fetch can detect the change', async () => {
    const store = await makeStore()
    store.setLots([lot(1)])
    const before = store.lots
    store.upsertLot(lot(1, { highest_bid: 2_000 }))
    expect(store.lots).not.toBe(before)
    expect(before[0]?.highest_bid).toBeNull()
  })

  it('winners, weekly and the selected winner are plain setters', async () => {
    const store = await makeStore()
    const winner = { auction_id: 1, user: { id: 3, name: 'Sam', avatar_url: null }, id_number: '7', winning_bid: 9_000, won_at: '2026-11-20T00:00:00Z' }
    store.setWinners({ month: '2026-11', months: ['2026-11'], winners: [winner] })
    store.setWeekly({ month: '2026-11', total_bid_coins: 10, allotments: [] })
    store.setSelectedWinner(winner)
    store.setLotsLoading(true)
    store.setWinnersLoading(true)
    store.setWeeklyLoading(true)
    expect(store.winners?.winners).toHaveLength(1)
    expect(store.weekly?.total_bid_coins).toBe(10)
    expect(store.selectedWinner?.id_number).toBe('7')
    expect(store.isLotsLoading && store.isWinnersLoading && store.isWeeklyLoading).toBe(true)
  })

  it('reset clears everything', async () => {
    const store = await makeStore()
    store.setLots([lot(1)])
    store.setSelectedWinner({ auction_id: 1, user: { id: 3, name: 'Sam', avatar_url: null }, id_number: '7', winning_bid: 1, won_at: 'x' })
    store.setLotsLoading(true)
    store.reset()
    expect(store.lots).toEqual([])
    expect(store.selectedWinner).toBeNull()
    expect(store.winners).toBeNull()
    expect(store.weekly).toBeNull()
    expect(store.isLotsLoading).toBe(false)
  })
})
