import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, readonly, ref } from 'vue'
import { usePrettyIdAuctionActions } from '~/composables/pretty-id/usePrettyIdAuctionActions'
import { usePrettyIdStore } from '~/stores/prettyId'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { PrettyIdApiError } from '~/utils/pretty-id-error'
import { createApiMock, makeLot, makeMe, resetApiMock } from '../../helpers/prettyIdFixtures'

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

const ENTRY_FEE = 1_000

function toastTitles(): string[] {
  return toastAdd.mock.calls.map(([options]) => (options as { title: string }).title)
}

describe('usePrettyIdAuctionActions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetApiMock(apiMock)
    toastAdd.mockReset()
  })

  function setup() {
    const store = usePrettyIdStore()
    const auctionStore = usePrettyIdAuctionStore()
    store.setMe(makeMe({ coins: 100_000 }))
    auctionStore.setLots([makeLot(7), makeLot(8)])
    return { store, auctionStore, actions: usePrettyIdAuctionActions() }
  }

  describe('enterAuction', () => {
    it('pays the fee, stores the lot and balance, and toasts', async () => {
      const entered = makeLot(7, { entered: true })
      apiMock.enter.mockResolvedValue({ auction: entered, coins: 100_000 - ENTRY_FEE })
      const { store, auctionStore, actions } = setup()

      expect(await actions.enterAuction(7)).toBe(true)

      expect(apiMock.enter).toHaveBeenCalledWith(7)
      expect(auctionStore.lotById(7)?.entered).toBe(true)
      expect(auctionStore.lots).toHaveLength(2)
      expect(store.coins).toBe(99_000)
      expect(toastTitles()).toEqual(['Entry fee paid. You can bid now.'])
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'success' }))
      expect(actions.isSubmitting.value).toBe(false)
    })

    it('toasts the server message and changes nothing on a refusal', async () => {
      apiMock.enter.mockRejectedValue(new PrettyIdApiError('insufficient_coins', 'Not enough coins'))
      const { store, auctionStore, actions } = setup()

      expect(await actions.enterAuction(7)).toBe(false)

      expect(toastTitles()).toEqual(['Not enough coins'])
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
      expect(store.coins).toBe(100_000)
      expect(auctionStore.lotById(7)?.entered).toBe(false)
      expect(actions.isSubmitting.value).toBe(false)
    })
  })

  describe('placeBid', () => {
    it('places the bid, stores the lot and balance, and toasts the amount', async () => {
      const leading = makeLot(7, { entered: true, you_are_highest: true, highest_bid: 50_000 })
      apiMock.bid.mockResolvedValue({ auction: leading, coins: 49_000 })
      const { store, auctionStore, actions } = setup()

      expect(await actions.placeBid(7, 50_000)).toBe(true)

      expect(apiMock.bid).toHaveBeenCalledWith(7, 50_000)
      expect(auctionStore.lotById(7)?.you_are_highest).toBe(true)
      expect(store.coins).toBe(49_000)
      expect(toastTitles()).toEqual(['Bid placed: 50,000'])
      expect(actions.isSubmitting.value).toBe(false)
    })

    it('toasts the server message when the bid is refused', async () => {
      apiMock.bid.mockRejectedValue(new PrettyIdApiError('bid_too_low', 'Bid at least 51,000'))
      const { store, actions } = setup()

      expect(await actions.placeBid(7, 1_000)).toBe(false)

      expect(toastTitles()).toEqual(['Bid at least 51,000'])
      expect(store.coins).toBe(100_000)
      expect(actions.isSubmitting.value).toBe(false)
    })

    it('falls back to the generic message for an unexpected error', async () => {
      apiMock.bid.mockRejectedValue(new Error('boom'))
      const { actions } = setup()
      expect(await actions.placeBid(7, 5_000)).toBe(false)
      expect(toastTitles()).toEqual(['Something went wrong. Please try again.'])
    })

    it.each([0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects the amount %s before calling the server', async (amount) => {
      const { actions } = setup()

      expect(await actions.placeBid(7, amount)).toBe(false)

      expect(apiMock.bid).not.toHaveBeenCalled()
      expect(toastTitles()).toEqual(['Enter a bid amount'])
      expect(actions.isSubmitting.value).toBe(false)
    })
  })

  describe('concurrent submits', () => {
    it('ignores a second bid while the first is in flight', async () => {
      let resolve!: (value: unknown) => void
      apiMock.bid.mockReturnValue(new Promise((res) => { resolve = res }))
      const { actions } = setup()

      const first = actions.placeBid(7, 5_000)
      expect(actions.isSubmitting.value).toBe(true)
      expect(await actions.placeBid(7, 6_000)).toBe(false)

      resolve({ auction: makeLot(7), coins: 1 })
      expect(await first).toBe(true)
      expect(apiMock.bid).toHaveBeenCalledTimes(1)
      expect(actions.isSubmitting.value).toBe(false)
    })

    it('shares the guard between entering and bidding', async () => {
      let resolve!: (value: unknown) => void
      apiMock.enter.mockReturnValue(new Promise((res) => { resolve = res }))
      const { actions } = setup()

      const entering = actions.enterAuction(7)
      expect(await actions.placeBid(7, 5_000)).toBe(false)
      expect(await actions.enterAuction(8)).toBe(false)

      resolve({ auction: makeLot(7, { entered: true }), coins: 1 })
      await entering
      expect(apiMock.bid).not.toHaveBeenCalled()
      expect(apiMock.enter).toHaveBeenCalledTimes(1)
    })

    it('accepts a new submit once the previous one failed', async () => {
      apiMock.bid.mockRejectedValueOnce(new PrettyIdApiError('bid_too_low', 'Too low'))
      apiMock.bid.mockResolvedValueOnce({ auction: makeLot(7), coins: 1 })
      const { actions } = setup()

      expect(await actions.placeBid(7, 1_000)).toBe(false)
      expect(await actions.placeBid(7, 9_000)).toBe(true)
    })
  })
})
