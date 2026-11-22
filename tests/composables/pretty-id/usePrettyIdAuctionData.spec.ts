import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, readonly, ref } from 'vue'
import {
  detectPrettyIdLotTransition,
  usePrettyIdAuctionData,
} from '~/composables/pretty-id/usePrettyIdAuctionData'
import { usePrettyIdStore } from '~/stores/prettyId'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { PrettyIdApiError } from '~/utils/pretty-id-error'
import { createApiMock, makeBid, makeLot, makeMe, resetApiMock } from '../../helpers/prettyIdFixtures'

const apiMock = createApiMock()
const toastAdd = vi.fn()

vi.mock('~/composables/pretty-id/usePrettyIdApi', () => ({
  usePrettyIdApi: () => apiMock,
  usePrettyIdMockControls: () => null,
}))
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('useToast', () => ({ add: toastAdd }))

/** Lets fire-and-forget work (`void loadMe()`) settle. */
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0))

function toastTitles(): string[] {
  return toastAdd.mock.calls.map(([options]) => (options as { title: string }).title)
}

const mine = makeLot(7, { you_are_highest: true, highest_bid: 20_000, top_bids: [makeBid('Ana', 20_000, true)] })
const outbidLot = makeLot(7, { highest_bid: 30_000, top_bids: [makeBid('Rita', 30_000), makeBid('Ana', 20_000, true)] })
const wonLot = makeLot(7, {
  status: 'ended',
  you_are_highest: true,
  highest_bid: 20_000,
  winning_bid: 20_000,
  top_bids: [makeBid('Ana', 20_000, true)],
})

// ========================================
// detectPrettyIdLotTransition (pure)
// ========================================

describe('detectPrettyIdLotTransition', () => {
  it('reports "outbid" when the lead was lost on a live lot', () => {
    expect(detectPrettyIdLotTransition(mine, outbidLot)).toBe('outbid')
  })

  it('reports "won" when a live lot ends with this user on top', () => {
    expect(detectPrettyIdLotTransition(mine, wonLot)).toBe('won')
  })

  it('reports "won" even if the user was not the leader at the previous poll', () => {
    expect(detectPrettyIdLotTransition(makeLot(7), wonLot)).toBe('won')
  })

  it('is silent when still highest on a live lot', () => {
    expect(detectPrettyIdLotTransition(mine, { ...mine, highest_bid: 25_000 })).toBeNull()
  })

  it('is silent when never highest and still not', () => {
    expect(detectPrettyIdLotTransition(makeLot(7), outbidLot)).toBeNull()
  })

  it('is silent when the lot ended with someone else on top', () => {
    const lost = makeLot(7, { status: 'ended', top_bids: [makeBid('Rita', 30_000), makeBid('Ana', 20_000, true)] })
    expect(detectPrettyIdLotTransition(mine, lost)).toBeNull()
  })

  it('is silent when the lot ended without any bid', () => {
    expect(detectPrettyIdLotTransition(makeLot(7), makeLot(7, { status: 'ended' }))).toBeNull()
  })

  it('is silent when the lot was already ended', () => {
    expect(detectPrettyIdLotTransition(wonLot, wonLot)).toBeNull()
  })

  it('is silent without a previous snapshot', () => {
    expect(detectPrettyIdLotTransition(undefined, wonLot)).toBeNull()
    expect(detectPrettyIdLotTransition(undefined, outbidLot)).toBeNull()
  })
})

// ========================================
// usePrettyIdAuctionData
// ========================================

describe('usePrettyIdAuctionData', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetApiMock(apiMock)
    toastAdd.mockReset()
  })

  function setup(known: ReturnType<typeof makeLot>[] = [], withMe = true) {
    const store = usePrettyIdStore()
    const auctionStore = usePrettyIdAuctionStore()
    if (withMe) store.setMe(makeMe())
    auctionStore.setLots(known)
    return { store, auctionStore, data: usePrettyIdAuctionData() }
  }

  describe('loadLot', () => {
    it('toasts "outbid", stores the new lot and refreshes me', async () => {
      apiMock.auction.mockResolvedValue(outbidLot)
      const { auctionStore, data } = setup([mine])

      expect(await data.loadLot(7)).toBe(true)
      await settle()

      expect(toastTitles()).toEqual(['Rita outbid you on 7. Escrow refunded.'])
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
      expect(auctionStore.lotById(7)?.highest_bid).toBe(30_000)
      expect(apiMock.me).toHaveBeenCalledTimes(1)
    })

    it('names a missing top bidder "Someone"', async () => {
      apiMock.auction.mockResolvedValue(makeLot(7, { highest_bid: 30_000 }))
      const { data } = setup([mine])
      await data.loadLot(7)
      expect(toastTitles()).toEqual(['Someone outbid you on 7. Escrow refunded.'])
    })

    it('toasts "won" with the ownership days from me.rules and refreshes me', async () => {
      apiMock.auction.mockResolvedValue(wonLot)
      const { data } = setup([mine])

      await data.loadLot(7)
      await settle()

      expect(toastTitles()).toEqual(['You won Rare ID 7! It is yours for 30 days.'])
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'success' }))
      expect(apiMock.me).toHaveBeenCalledTimes(1)
    })

    it('leaves the duration out of the "won" toast while me is not loaded', async () => {
      apiMock.auction.mockResolvedValue(wonLot)
      const { data } = setup([mine], false)
      await data.loadLot(7)
      expect(toastTitles()).toEqual(['You won Rare ID 7!'])
    })

    it('stays silent and leaves me alone when nothing changed for the user', async () => {
      apiMock.auction.mockResolvedValue({ ...mine, highest_bid: 25_000 })
      const { auctionStore, data } = setup([mine])

      await data.loadLot(7)
      await settle()

      expect(toastAdd).not.toHaveBeenCalled()
      expect(apiMock.me).not.toHaveBeenCalled()
      expect(auctionStore.lotById(7)?.highest_bid).toBe(25_000)
    })

    it('adds a lot it has not seen before without announcing anything', async () => {
      apiMock.auction.mockResolvedValue(wonLot)
      const { auctionStore, data } = setup([])
      await data.loadLot(7)
      await settle()
      expect(auctionStore.lots.map(l => l.id)).toEqual([7])
      expect(toastAdd).not.toHaveBeenCalled()
      expect(apiMock.me).not.toHaveBeenCalled()
    })

    it('ignores a response for a lot that was replaced while it was in flight', async () => {
      let resolve!: (lot: unknown) => void
      apiMock.auction.mockReturnValue(new Promise((res) => { resolve = res }))
      const { auctionStore, data } = setup([makeLot(7)])

      const pending = data.loadLot(7)
      // A bid response lands first: this user is now the leader.
      auctionStore.upsertLot(mine)
      // The poll answers with the older, pre-bid picture.
      resolve(makeLot(7))

      expect(await pending).toBe(false)
      expect(auctionStore.lotById(7)?.you_are_highest).toBe(true)
      expect(toastAdd).not.toHaveBeenCalled()
    })

    it('fails quietly when the lot is already on screen', async () => {
      apiMock.auction.mockRejectedValue(new Error('offline'))
      const { data } = setup([mine])
      expect(await data.loadLot(7)).toBe(false)
      expect(toastAdd).not.toHaveBeenCalled()
    })

    it('toasts the error when there is nothing to show yet', async () => {
      apiMock.auction.mockRejectedValue(new PrettyIdApiError('not_found', 'No such auction'))
      const { data } = setup([])
      expect(await data.loadLot(99)).toBe(false)
      expect(toastTitles()).toEqual(['No such auction'])
    })

    it('never toasts a failure on quiet poll ticks, however many fail', async () => {
      apiMock.auction.mockRejectedValue(new PrettyIdApiError('not_found', 'No such auction'))
      const { data } = setup([])
      await data.loadLot(99, { quiet: true })
      await data.loadLot(99, { quiet: true })
      expect(toastAdd).not.toHaveBeenCalled()
    })

    it('still announces transitions on quiet poll ticks', async () => {
      apiMock.auction.mockResolvedValue(outbidLot)
      const { data } = setup([mine])
      await data.loadLot(7, { quiet: true })
      expect(toastTitles()).toEqual(['Rita outbid you on 7. Escrow refunded.'])
    })
  })

  describe('loadLots', () => {
    it('stores the grid, reacts per lot and refreshes me once', async () => {
      const mineB = makeLot(8, { you_are_highest: true, top_bids: [makeBid('Ana', 5, true)] })
      const outbidB = makeLot(8, { top_bids: [makeBid('Rita', 9)] })
      apiMock.auctions.mockResolvedValue([outbidLot, outbidB, makeLot(9)])
      const { auctionStore, data } = setup([mine, mineB])

      await data.loadLots()
      await settle()

      expect(toastTitles()).toEqual([
        'Rita outbid you on 7. Escrow refunded.',
        'Rita outbid you on 8. Escrow refunded.',
      ])
      expect(apiMock.me).toHaveBeenCalledTimes(1)
      expect(auctionStore.lots.map(l => l.id)).toEqual([7, 8, 9])
      expect(auctionStore.isLotsLoading).toBe(false)
    })

    it('does not refresh me when no lot changed hands', async () => {
      apiMock.auctions.mockResolvedValue([makeLot(1), makeLot(2)])
      const { auctionStore, data } = setup([])
      await data.loadLots()
      await settle()
      expect(auctionStore.lots).toHaveLength(2)
      expect(apiMock.me).not.toHaveBeenCalled()
      expect(toastAdd).not.toHaveBeenCalled()
    })

    it('keeps a lot that was replaced while the grid request was in flight', async () => {
      let resolve!: (lots: unknown) => void
      apiMock.auctions.mockReturnValue(new Promise((res) => { resolve = res }))
      const { auctionStore, data } = setup([makeLot(7), makeLot(8)])

      const pending = data.loadLots()
      auctionStore.upsertLot(mine)
      resolve([makeLot(7), makeLot(8, { highest_bid: 4_000 })])
      await pending

      expect(auctionStore.lotById(7)?.you_are_highest).toBe(true)
      expect(auctionStore.lotById(8)?.highest_bid).toBe(4_000)
      expect(toastAdd).not.toHaveBeenCalled()
    })

    it('toasts a failure only while the grid is empty', async () => {
      apiMock.auctions.mockRejectedValue(new Error('offline'))
      const first = setup([])
      await first.data.loadLots()
      expect(toastTitles()).toEqual(['Something went wrong. Please try again.'])
      expect(first.auctionStore.isLotsLoading).toBe(false)

      toastAdd.mockReset()
      const second = setup([makeLot(1)])
      await second.data.loadLots()
      expect(toastAdd).not.toHaveBeenCalled()
    })

    it('never toasts, or raises the loading flag, on quiet poll ticks', async () => {
      apiMock.auctions.mockRejectedValue(new Error('offline'))
      const { auctionStore, data } = setup([])

      const first = data.loadLots({ quiet: true })
      expect(auctionStore.isLotsLoading).toBe(false)
      await first
      await data.loadLots({ quiet: true })

      expect(toastAdd).not.toHaveBeenCalled()
      expect(auctionStore.isLotsLoading).toBe(false)
    })

    it('a quiet tick that succeeds still updates the grid', async () => {
      apiMock.auctions.mockResolvedValue([makeLot(1)])
      const { auctionStore, data } = setup([])
      await data.loadLots({ quiet: true })
      expect(auctionStore.lots.map(l => l.id)).toEqual([1])
    })
  })

  describe('winners, weekly, selection', () => {
    it('loadWinners passes the month through and stores the response', async () => {
      const response = { month: '2026-10', months: ['2026-11', '2026-10'], winners: [] }
      apiMock.winners.mockResolvedValue(response)
      const { auctionStore, data } = setup()
      await data.loadWinners('2026-10')
      expect(apiMock.winners).toHaveBeenCalledWith('2026-10')
      expect(auctionStore.winners).toEqual(response)
      expect(auctionStore.isWinnersLoading).toBe(false)
    })

    it('loadWinners lets the newest request win', async () => {
      const resolvers: Array<(value: unknown) => void> = []
      apiMock.winners.mockImplementation(() => new Promise((res) => { resolvers.push(res) }))
      const { auctionStore, data } = setup()

      const older = data.loadWinners('2026-09')
      const newer = data.loadWinners('2026-10')
      resolvers[1]?.({ month: '2026-10', months: [], winners: [] })
      await newer
      resolvers[0]?.({ month: '2026-09', months: [], winners: [] })
      await older

      expect(auctionStore.winners?.month).toBe('2026-10')
      expect(auctionStore.isWinnersLoading).toBe(false)
    })

    it('loadWinners toasts a failure', async () => {
      apiMock.winners.mockRejectedValue(new PrettyIdApiError('invalid', 'Bad month'))
      const { auctionStore, data } = setup()
      await data.loadWinners('nope')
      expect(toastTitles()).toEqual(['Bad month'])
      expect(auctionStore.isWinnersLoading).toBe(false)
    })

    it('loadWeekly stores the record', async () => {
      const response = { month: '2026-11', total_bid_coins: 5, allotments: [] }
      apiMock.weekly.mockResolvedValue(response)
      const { auctionStore, data } = setup()
      await data.loadWeekly()
      expect(auctionStore.weekly).toEqual(response)
      expect(auctionStore.isWeeklyLoading).toBe(false)
    })

    it('selectWinner sets and clears the bottom-sheet winner', () => {
      const winner = { auction_id: 1, user: { id: 3, name: 'Sam', avatar_url: null }, id_number: '7', winning_bid: 9, won_at: 'x' }
      const { auctionStore, data } = setup()
      data.selectWinner(winner)
      expect(auctionStore.selectedWinner).toEqual(winner)
      data.selectWinner(null)
      expect(auctionStore.selectedWinner).toBeNull()
    })
  })
})
