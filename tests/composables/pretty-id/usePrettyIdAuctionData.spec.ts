import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, readonly, ref } from 'vue'
import { usePrettyIdAuctionData } from '~/composables/pretty-id/usePrettyIdAuctionData'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { PrettyIdAuctionApiError } from '~/utils/pretty-id-auction-error'
import {
  createAuctionApiMock,
  makeCard,
  makeList,
  makeMe,
  makeSnapshot,
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

describe('usePrettyIdAuctionData', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetAuctionApiMock(apiMock)
    toastAdd.mockReset()
  })

  describe('loadAuctions', () => {
    it('stores the list in server order and toggles the loading flag around a non-quiet load', async () => {
      apiMock.auctions.mockResolvedValue(makeList([makeCard({ id: 2 }), makeCard({ id: 1 })]))
      const store = usePrettyIdAuctionStore()
      const pending = usePrettyIdAuctionData().loadAuctions()
      expect(store.isAuctionsLoading).toBe(true)
      expect(await pending).toBe('ok')
      expect(store.isAuctionsLoading).toBe(false)
      expect(store.auctions.map(card => card.id)).toEqual([2, 1])
    })

    it('a quiet load never flips the loading flag', async () => {
      const store = usePrettyIdAuctionStore()
      const pending = usePrettyIdAuctionData().loadAuctions({ quiet: true })
      expect(store.isAuctionsLoading).toBe(false)
      await pending
    })

    it('first failure toasts and flags the list failed', async () => {
      apiMock.auctions.mockRejectedValue(down())
      const store = usePrettyIdAuctionStore()
      expect(await usePrettyIdAuctionData().loadAuctions()).toBe('error')
      expect(toastAdd).toHaveBeenCalledTimes(1)
      expect(store.isAuctionsFailed).toBe(true)
      expect(store.isAuctionsLoading).toBe(false)
    })

    it('a failure with a list already on screen is silent and keeps the list', async () => {
      const store = usePrettyIdAuctionStore()
      store.setAuctions([makeCard()])
      apiMock.auctions.mockRejectedValue(down())
      expect(await usePrettyIdAuctionData().loadAuctions()).toBe('error')
      expect(toastAdd).not.toHaveBeenCalled()
      expect(store.isAuctionsFailed).toBe(false)
      expect(store.auctions).toHaveLength(1)
    })

    it('a 404 (auction off server-side) is not_found: no toast, not flagged failed', async () => {
      apiMock.auctions.mockRejectedValue(new PrettyIdAuctionApiError('not_found'))
      const store = usePrettyIdAuctionStore()
      expect(await usePrettyIdAuctionData().loadAuctions()).toBe('not_found')
      expect(toastAdd).not.toHaveBeenCalled()
      expect(store.isAuctionsFailed).toBe(false)
    })

    it('a quiet failure never toasts', async () => {
      apiMock.auctions.mockRejectedValue(down())
      await usePrettyIdAuctionData().loadAuctions({ quiet: true })
      expect(toastAdd).not.toHaveBeenCalled()
    })
  })

  describe('loadAuction', () => {
    it('stores the snapshot under its id', async () => {
      apiMock.auction.mockResolvedValue(makeSnapshot({ id: 5, rare_id: '00123456' }))
      expect(await usePrettyIdAuctionData().loadAuction(5)).toBe('ok')
      // leading zeros survive: rare_id is text
      expect(usePrettyIdAuctionStore().snapshotById(5)?.rare_id).toBe('00123456')
    })

    it('a 404 is not_found: no toast, nothing stored', async () => {
      apiMock.auction.mockRejectedValue(new PrettyIdAuctionApiError('not_found'))
      expect(await usePrettyIdAuctionData().loadAuction(5)).toBe('not_found')
      expect(toastAdd).not.toHaveBeenCalled()
      expect(usePrettyIdAuctionStore().snapshotById(5)).toBeUndefined()
    })

    it('another failure with nothing on screen toasts once; with a snapshot or quiet it is silent', async () => {
      apiMock.auction.mockRejectedValue(down())
      const data = usePrettyIdAuctionData()
      expect(await data.loadAuction(5)).toBe('error')
      expect(toastAdd).toHaveBeenCalledTimes(1)

      expect(await data.loadAuction(6, { quiet: true })).toBe('error')
      usePrettyIdAuctionStore().setSnapshot(makeSnapshot({ id: 7 }))
      expect(await data.loadAuction(7)).toBe('error')
      expect(toastAdd).toHaveBeenCalledTimes(1)
    })
  })

  describe('loadAuctionMe', () => {
    it('stores the viewer standing', async () => {
      apiMock.auctionMe.mockResolvedValue(makeMe({ entered: true, may_bid: true }))
      await usePrettyIdAuctionData().loadAuctionMe(3)
      expect(usePrettyIdAuctionStore().myStandingById(3)).toEqual(makeMe({ entered: true, may_bid: true }))
    })

    it('swallows a failure (log only, no toast)', async () => {
      apiMock.auctionMe.mockRejectedValue(down())
      await expect(usePrettyIdAuctionData().loadAuctionMe(3)).resolves.toBeUndefined()
      expect(toastAdd).not.toHaveBeenCalled()
    })
  })
})
