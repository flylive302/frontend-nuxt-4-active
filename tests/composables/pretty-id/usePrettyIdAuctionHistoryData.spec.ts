import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, readonly, ref } from 'vue'
import { usePrettyIdAuctionHistoryData } from '~/composables/pretty-id/usePrettyIdAuctionHistoryData'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { PrettyIdAuctionApiError } from '~/utils/pretty-id-auction-error'
import {
  createAuctionApiMock,
  makeWeeklyRecord,
  makeWeeklyRow,
  makeWinnerEntry,
  makeWinnersBoard,
  resetAuctionApiMock,
} from '../../helpers/prettyIdAuctionFixtures'

const apiMock = createAuctionApiMock()
const toastAdd = vi.fn()

vi.mock('~/composables/pretty-id/usePrettyIdAuctionApi', () => ({
  usePrettyIdAuctionApi: () => apiMock,
}))
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('useToast', () => ({ add: toastAdd }))

const down = () => new PrettyIdAuctionApiError('unknown', 'Server down')

/** A promise settled from outside, to make two in-flight requests finish out of order. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('usePrettyIdAuctionHistoryData', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetAuctionApiMock(apiMock)
    toastAdd.mockReset()
  })

  describe('loadWinners', () => {
    it('asks for the given month, stores the board and toggles the loading flag', async () => {
      const board = makeWinnersBoard({ month: '2026-10', winners: [makeWinnerEntry({ auction_id: 4, rare_id: '00123456' })] })
      apiMock.winners.mockResolvedValue(board)
      const store = usePrettyIdAuctionStore()

      const pending = usePrettyIdAuctionHistoryData().loadWinners('2026-10')
      expect(store.isWinnersLoading).toBe(true)
      expect(await pending).toBe('ok')

      expect(apiMock.winners).toHaveBeenCalledWith('2026-10')
      expect(store.isWinnersLoading).toBe(false)
      expect(store.winners?.month).toBe('2026-10')
      // leading zeros survive: rare_id is text
      expect(store.winners?.winners[0]?.rare_id).toBe('00123456')
    })

    it('asks with no month for the current one', async () => {
      await usePrettyIdAuctionHistoryData().loadWinners()
      expect(apiMock.winners).toHaveBeenCalledWith(undefined)
    })

    it('a failure with nothing on screen toasts once; with a board on screen it is silent and keeps the board', async () => {
      apiMock.winners.mockRejectedValue(down())
      const store = usePrettyIdAuctionStore()
      const history = usePrettyIdAuctionHistoryData()

      expect(await history.loadWinners()).toBe('error')
      expect(toastAdd).toHaveBeenCalledTimes(1)
      expect(store.isWinnersLoading).toBe(false)

      store.setWinners(makeWinnersBoard())
      expect(await history.loadWinners('2026-10')).toBe('error')
      expect(toastAdd).toHaveBeenCalledTimes(1)
      expect(store.winners?.month).toBe('2026-11')
    })

    it('a 404 (auction switch off) is not_found: no toast', async () => {
      apiMock.winners.mockRejectedValue(new PrettyIdAuctionApiError('not_found'))
      expect(await usePrettyIdAuctionHistoryData().loadWinners()).toBe('not_found')
      expect(toastAdd).not.toHaveBeenCalled()
    })

    it('the newest request wins: a slower older month never overwrites it', async () => {
      const older = deferred<ReturnType<typeof makeWinnersBoard>>()
      const newer = deferred<ReturnType<typeof makeWinnersBoard>>()
      apiMock.winners.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
      const store = usePrettyIdAuctionStore()
      const history = usePrettyIdAuctionHistoryData()

      const first = history.loadWinners('2026-09')
      const second = history.loadWinners('2026-10')
      newer.resolve(makeWinnersBoard({ month: '2026-10' }))
      expect(await second).toBe('ok')
      older.resolve(makeWinnersBoard({ month: '2026-09' }))
      expect(await first).toBe('superseded')

      expect(store.winners?.month).toBe('2026-10')
      expect(store.isWinnersLoading).toBe(false)
    })

    it('a superseded failure neither toasts nor reports an error', async () => {
      const older = deferred<ReturnType<typeof makeWinnersBoard>>()
      apiMock.winners.mockReturnValueOnce(older.promise).mockResolvedValueOnce(makeWinnersBoard({ month: '2026-10' }))
      const store = usePrettyIdAuctionStore()
      const history = usePrettyIdAuctionHistoryData()

      const first = history.loadWinners('2026-09')
      await history.loadWinners('2026-10')
      older.reject(down())

      expect(await first).toBe('superseded')
      expect(toastAdd).not.toHaveBeenCalled()
      expect(store.winners?.month).toBe('2026-10')
    })
  })

  describe('loadWeekly', () => {
    it('asks for the given month and stores the record with its total and weeks', async () => {
      const record = makeWeeklyRecord({
        month: '2026-10',
        total_winning_bids: 300_000,
        weeks: [{ starts_on: '2026-10-26', ends_on: '2026-10-31', auctions: [makeWeeklyRow({ winner: null, winning_bid: null })] }],
      })
      apiMock.weekly.mockResolvedValue(record)
      const store = usePrettyIdAuctionStore()

      const pending = usePrettyIdAuctionHistoryData().loadWeekly('2026-10')
      expect(store.isWeeklyLoading).toBe(true)
      expect(await pending).toBe('ok')

      expect(apiMock.weekly).toHaveBeenCalledWith('2026-10')
      expect(store.isWeeklyLoading).toBe(false)
      expect(store.weekly?.total_winning_bids).toBe(300_000)
      // a no-winner row keeps its nulls
      expect(store.weekly?.weeks[0]?.auctions[0]).toMatchObject({ winner: null, winning_bid: null })
    })

    it('first failure toasts; a failure with a record on screen is silent; 404 is not_found', async () => {
      apiMock.weekly.mockRejectedValue(down())
      const store = usePrettyIdAuctionStore()
      const history = usePrettyIdAuctionHistoryData()

      expect(await history.loadWeekly()).toBe('error')
      expect(toastAdd).toHaveBeenCalledTimes(1)

      store.setWeekly(makeWeeklyRecord())
      expect(await history.loadWeekly('2026-10')).toBe('error')
      expect(toastAdd).toHaveBeenCalledTimes(1)

      apiMock.weekly.mockRejectedValue(new PrettyIdAuctionApiError('not_found'))
      expect(await history.loadWeekly()).toBe('not_found')
      expect(toastAdd).toHaveBeenCalledTimes(1)
    })

    it('the newest request wins', async () => {
      const older = deferred<ReturnType<typeof makeWeeklyRecord>>()
      const newer = deferred<ReturnType<typeof makeWeeklyRecord>>()
      apiMock.weekly.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
      const store = usePrettyIdAuctionStore()
      const history = usePrettyIdAuctionHistoryData()

      const first = history.loadWeekly('2026-09')
      const second = history.loadWeekly('2026-10')
      newer.resolve(makeWeeklyRecord({ month: '2026-10' }))
      await second
      older.resolve(makeWeeklyRecord({ month: '2026-09' }))
      expect(await first).toBe('superseded')

      expect(store.weekly?.month).toBe('2026-10')
    })
  })
})
