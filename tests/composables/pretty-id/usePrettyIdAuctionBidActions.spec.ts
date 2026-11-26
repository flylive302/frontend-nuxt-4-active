import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, nextTick, readonly, ref, watch } from 'vue'
import { usePrettyIdAuctionBidActions } from '~/composables/pretty-id/usePrettyIdAuctionBidActions'
import { PRETTY_ID_TOP_UP_ROUTE } from '~/constants/pretty-id'
import { useBalanceStore } from '~/stores/balance'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { usePrettyIdAuctionBidStore } from '~/stores/prettyIdAuctionBid'
import type { PrettyIdAuctionErrorCode, PrettyIdAuctionSnapshot } from '~/types/pretty-id-auction'
import { PrettyIdAuctionApiError } from '~/utils/pretty-id-auction-error'
import { deferred } from '../../helpers/prettyIdFixtures'
import {
  createAuctionApiMock,
  makeBid,
  makeBidResult,
  makeMe,
  makeSnapshot,
  makeUser,
  resetAuctionApiMock,
} from '../../helpers/prettyIdAuctionFixtures'

const apiMock = createAuctionApiMock()
const toastAdd = vi.fn()
const navigateToMock = vi.fn()
/** The signed-in user the mocked auth store reports (the real store needs the persistence plugin). */
const authState: { user: { id: number } | null } = { user: null }

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => authState,
}))

vi.mock('~/composables/pretty-id/usePrettyIdAuctionApi', () => ({
  usePrettyIdAuctionApi: () => apiMock,
}))
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('watch', watch)
vi.stubGlobal('useToast', () => ({ add: toastAdd }))
vi.stubGlobal('navigateTo', navigateToMock)

const ID = 1
const ME_ID = 99
/** An entered viewer who may bid. */
const CAN_BID = makeMe({ entered: true, may_bid: true })

function toastTitles(): string[] {
  return toastAdd.mock.calls.map(([options]) => (options as { title: string }).title)
}

describe('usePrettyIdAuctionBidActions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetAuctionApiMock(apiMock)
    toastAdd.mockReset()
    navigateToMock.mockReset()
  })

  function setup(options: {
    snapshot?: Partial<PrettyIdAuctionSnapshot>
    me?: ReturnType<typeof makeMe> | null
  } = {}) {
    const auctionStore = usePrettyIdAuctionStore()
    const bidStore = usePrettyIdAuctionBidStore()
    const balance = useBalanceStore()
    authState.user = { id: ME_ID }
    balance.patch({ coins: '100000' })
    auctionStore.setSnapshot(makeSnapshot({ id: ID, min_next_bid: 100_000, min_raise: 10_000, ...options.snapshot }))
    const me = options.me === undefined ? CAN_BID : options.me
    if (me !== null) auctionStore.setMyStanding(ID, me)
    const actions = usePrettyIdAuctionBidActions()
    actions.syncDraftToMinimum(ID)
    return { auctionStore, bidStore, balance, actions }
  }

  /** Opens the dialog and confirms, as the user would. */
  async function openAndConfirm(actions: ReturnType<typeof usePrettyIdAuctionBidActions>): Promise<void> {
    actions.openBid(ID)
    await actions.confirmBid()
  }

  // ========================================
  // isLeading / canBid
  // ========================================

  describe('isLeading', () => {
    it('is true only when the snapshot leader is the signed-in user', () => {
      const { actions, auctionStore } = setup()
      expect(actions.isLeading(ID)).toBe(false)

      auctionStore.setSnapshot(makeSnapshot({ id: ID, leader: makeUser(ME_ID) }))
      expect(actions.isLeading(ID)).toBe(true)

      auctionStore.setSnapshot(makeSnapshot({ id: ID, leader: makeUser(5) }))
      expect(actions.isLeading(ID)).toBe(false)
    })

    it('is false with no signed-in user or no snapshot', () => {
      const { actions, auctionStore } = setup({ snapshot: { leader: makeUser(ME_ID) } })
      authState.user = null
      expect(actions.isLeading(ID)).toBe(false)
      authState.user = { id: ME_ID }
      expect(actions.isLeading(404)).toBe(false)
      expect(auctionStore.snapshotById(404)).toBeUndefined()
    })
  })

  describe('canBid', () => {
    it('is true for an entered, eligible, non-leading viewer on a live auction', () => {
      expect(setup().actions.canBid(ID)).toBe(true)
    })

    it.each([
      ['an upcoming auction', { snapshot: { state: 'upcoming' as const } }],
      ['an ended auction', { snapshot: { state: 'ended' as const } }],
      ['a viewer who has not entered', { me: makeMe({ may_bid: true }) }],
      ['a disqualified viewer', { me: makeMe({ entered: true, disqualified: true, may_bid: false }) }],
      ['a staff viewer (may_bid false)', { me: makeMe({ entered: true, may_bid: false }) }],
      ['a viewer whose standing is not loaded', { me: null }],
      ['the current leader', { snapshot: { leader: makeUser(ME_ID) } }],
    ])('is false for %s', (_name, options) => {
      expect(setup(options).actions.canBid(ID)).toBe(false)
    })
  })

  // ========================================
  // The field
  // ========================================

  describe('bid field', () => {
    it('pre-fills the minimum next bid', () => {
      const { bidStore } = setup({ snapshot: { min_next_bid: 130_000 } })
      expect(bidStore.draft).toBe('130000')
      expect(bidStore.draftAuctionId).toBe(ID)
    })

    it('follows a rising minimum but keeps a higher typed figure', () => {
      const { actions, auctionStore, bidStore } = setup()
      auctionStore.setSnapshot(makeSnapshot({ id: ID, min_next_bid: 120_000 }))
      actions.syncDraftToMinimum(ID)
      expect(bidStore.draft).toBe('120000')

      actions.setDraftText(ID, '500000')
      auctionStore.setSnapshot(makeSnapshot({ id: ID, min_next_bid: 130_000 }))
      actions.syncDraftToMinimum(ID)
      expect(bidStore.draft).toBe('500000')
    })

    it('refills an empty field with the minimum', () => {
      const { actions, bidStore } = setup()
      actions.setDraftText(ID, '')
      actions.syncDraftToMinimum(ID)
      expect(bidStore.draft).toBe('100000')
    })

    it('setDraftText keeps whole coins only', () => {
      const { actions, bidStore } = setup()
      actions.setDraftText(ID, '2,500.5x')
      expect(bidStore.draft).toBe('25005')
    })

    it('chips are +50K, +100K and +500K whatever the minimum raise', () => {
      const { actions } = setup({ snapshot: { min_raise: 10_000 } })
      expect(actions.bidChips().map(chip => chip.amount)).toEqual([50_000, 100_000, 500_000])
    })

    it('shows the draft only for the auction it belongs to', () => {
      const { actions } = setup()
      expect(actions.draftTextFor(ID)).toBe('100000')
      expect(actions.draftTextFor(ID + 1)).toBe('')
    })

    it('locks the form while the dialog is open', () => {
      const { actions } = setup()
      expect(actions.isBidFormBusy()).toBe(false)
      actions.openBid(ID)
      expect(actions.isBidFormBusy()).toBe(true)
      actions.closeBid()
      expect(actions.isBidFormBusy()).toBe(false)
    })

    it('keepDraftAtMinimum follows a rising minimum but keeps a higher typed amount', async () => {
      const { actions, auctionStore, bidStore } = setup()
      const snapshot = ref(makeSnapshot({ id: ID, min_next_bid: 100_000 }))
      bidStore.setDraft(ID, '')
      actions.keepDraftAtMinimum(() => snapshot.value)
      expect(bidStore.draft).toBe('100000')

      auctionStore.setSnapshot(makeSnapshot({ id: ID, min_next_bid: 120_000 }))
      snapshot.value = makeSnapshot({ id: ID, min_next_bid: 120_000 })
      await nextTick()
      expect(bidStore.draft).toBe('120000')

      actions.setDraftText(ID, '500000')
      auctionStore.setSnapshot(makeSnapshot({ id: ID, min_next_bid: 130_000 }))
      snapshot.value = makeSnapshot({ id: ID, min_next_bid: 130_000 })
      await nextTick()
      expect(bidStore.draft).toBe('500000')
    })

    it('after the leader was removed (leader null, floor set) the minimum is the server min_next_bid', () => {
      const { actions, bidStore } = setup({
        snapshot: { leader: null, price_floor: 120_000, min_next_bid: 130_000, top_bids: [makeBid(120_000, makeUser(5))] },
      })
      expect(actions.isLeading(ID)).toBe(false)
      expect(actions.canBid(ID)).toBe(true)
      expect(bidStore.draft).toBe('130000')
      expect(actions.isDraftValid(ID)).toBe(true)
      actions.setDraftText(ID, '129999')
      expect(actions.isDraftValid(ID)).toBe(false)
    })

    it('after every bid was removed (leader null, floor null) the minimum is the opening bid from the server', () => {
      const { actions, bidStore } = setup({ snapshot: { leader: null, price_floor: null, min_next_bid: 100_000 } })
      expect(bidStore.draft).toBe('100000')
      expect(actions.isDraftValid(ID)).toBe(true)
      actions.setDraftText(ID, '99999')
      expect(actions.isDraftValid(ID)).toBe(false)
    })

    it('a former leader may bid again once the leader slot is empty', () => {
      const { actions, auctionStore } = setup({ snapshot: { leader: makeUser(ME_ID), min_next_bid: 110_000 } })
      expect(actions.canBid(ID)).toBe(false)
      auctionStore.setSnapshot(makeSnapshot({ id: ID, leader: null, price_floor: 90_000, min_next_bid: 100_000 }))
      expect(actions.canBid(ID)).toBe(true)
      expect(actions.isDraftValid(ID)).toBe(true)
    })

    it('a chip raises the field by its amount', () => {
      const { actions, bidStore } = setup()
      actions.addToDraft(ID, 50_000)
      expect(bidStore.draft).toBe('150000')
      actions.addToDraft(ID, 10_000)
      expect(bidStore.draft).toBe('160000')
    })

    it('a chip on an empty field starts from the minimum', () => {
      const { actions, bidStore } = setup()
      actions.setDraftText(ID, '')
      actions.addToDraft(ID, 10_000)
      expect(bidStore.draft).toBe('110000')
    })

    it('isDraftValid needs a whole amount at or above the minimum', () => {
      const { actions } = setup()
      expect(actions.isDraftValid(ID)).toBe(true)
      actions.setDraftText(ID, '99999')
      expect(actions.isDraftValid(ID)).toBe(false)
      actions.setDraftText(ID, '')
      expect(actions.isDraftValid(ID)).toBe(false)
    })

    it('isLargeBid warns above ten times the minimum only', () => {
      const { actions } = setup()
      expect(actions.isLargeBid(ID, 1_000_000)).toBe(false)
      expect(actions.isLargeBid(ID, 1_000_001)).toBe(true)
    })
  })

  // ========================================
  // openBid / closeBid
  // ========================================

  describe('openBid', () => {
    it('opens the dialog with the field amount', () => {
      const { actions, bidStore } = setup()
      actions.setDraftText(ID, '250000')
      actions.openBid(ID)
      expect(bidStore.confirmId).toBe(ID)
      expect(bidStore.confirmAmount).toBe(250_000)
      expect(bidStore.isShortOnCoins).toBe(false)
    })

    it.each([
      ['a leading viewer', { snapshot: { leader: makeUser(ME_ID) } }],
      ['an upcoming auction', { snapshot: { state: 'upcoming' as const } }],
      ['a viewer who has not entered', { me: makeMe({ may_bid: true }) }],
      ['a disqualified viewer', { me: makeMe({ entered: true, disqualified: true }) }],
    ])('stays closed for %s', (_name, options) => {
      const { actions, bidStore } = setup(options)
      actions.openBid(ID)
      expect(bidStore.confirmId).toBeNull()
    })

    it('stays closed and toasts for an empty field', () => {
      const { actions, bidStore } = setup()
      actions.setDraftText(ID, '')
      actions.openBid(ID)
      expect(bidStore.confirmId).toBeNull()
      expect(toastTitles()).toEqual(['Enter a whole number of coins.'])
    })

    it('stays closed and toasts for an amount under the minimum', () => {
      const { actions, bidStore } = setup()
      actions.setDraftText(ID, '99999')
      actions.openBid(ID)
      expect(bidStore.confirmId).toBeNull()
      expect(toastTitles()).toEqual(['The minimum bid is 100,000.'])
    })

    it('stays closed while a bid is in flight', () => {
      const { actions, bidStore } = setup()
      bidStore.setBidding(true)
      actions.openBid(ID)
      expect(bidStore.confirmId).toBeNull()
    })

    it('closeBid is refused while the bid is in flight, and closes otherwise', () => {
      const { actions, bidStore } = setup()
      actions.openBid(ID)
      bidStore.setBidding(true)
      actions.closeBid()
      expect(bidStore.confirmId).toBe(ID)
      bidStore.setBidding(false)
      actions.closeBid()
      expect(bidStore.confirmId).toBeNull()
    })

    it('reopening clears the Top up offer', async () => {
      apiMock.bid.mockRejectedValue(new PrettyIdAuctionApiError('insufficient_coins'))
      const { actions, bidStore } = setup()
      await openAndConfirm(actions)
      actions.closeBid()
      actions.openBid(ID)
      expect(bidStore.isShortOnCoins).toBe(false)
    })
  })

  // ========================================
  // confirmBid: success
  // ========================================

  describe('confirmBid', () => {
    it('sends the dialog amount, writes the returned snapshot and balance, toasts and refetches at once', async () => {
      const after = makeSnapshot({ id: ID, leader: makeUser(ME_ID), min_next_bid: 150_000, price_floor: 140_000 })
      apiMock.bid.mockResolvedValue(makeBidResult({ auction: after, coins: 60_000 }))
      apiMock.auction.mockResolvedValue(after)
      const { actions, auctionStore, bidStore, balance } = setup()
      actions.setDraftText(ID, '140000')

      await openAndConfirm(actions)

      expect(apiMock.bid).toHaveBeenCalledWith(ID, 140_000)
      expect(auctionStore.snapshotById(ID)).toEqual(after)
      expect(actions.isLeading(ID)).toBe(true)
      expect(balance.coins).toBe('60000')
      expect(bidStore.confirmId).toBeNull()
      expect(bidStore.isBidding).toBe(false)
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'success' }))
      await vi.waitFor(() => expect(apiMock.auction).toHaveBeenCalledWith(ID))
    })

    it('sends the amount the dialog showed, not a field that moved since', async () => {
      const { actions, bidStore } = setup()
      actions.setDraftText(ID, '200000')
      actions.openBid(ID)
      bidStore.setDraft(ID, '999999')
      await actions.confirmBid()
      expect(apiMock.bid).toHaveBeenCalledWith(ID, 200_000)
    })

    it('does nothing with no dialog open', async () => {
      const { actions } = setup()
      await actions.confirmBid()
      expect(apiMock.bid).not.toHaveBeenCalled()
    })

    it('re-checks the gate: a standing that turned stale closes the dialog without calling bid', async () => {
      const { actions, auctionStore, bidStore } = setup()
      actions.openBid(ID)
      auctionStore.setSnapshot(makeSnapshot({ id: ID, state: 'ended' }))
      await actions.confirmBid()
      expect(apiMock.bid).not.toHaveBeenCalled()
      expect(bidStore.confirmId).toBeNull()
    })

    it('guards against a double confirm', async () => {
      const gate = deferred<ReturnType<typeof makeBidResult>>()
      apiMock.bid.mockReturnValue(gate.promise)
      const { actions, bidStore } = setup()
      actions.openBid(ID)

      const first = actions.confirmBid()
      expect(bidStore.isBidding).toBe(true)
      await actions.confirmBid()
      expect(apiMock.bid).toHaveBeenCalledTimes(1)

      gate.resolve(makeBidResult())
      await first
      expect(bidStore.isBidding).toBe(false)
    })

    // ========================================
    // Refusals
    // ========================================

    function refuse(code: PrettyIdAuctionErrorCode, message = `refused: ${code}`, minNextBid?: number): void {
      apiMock.bid.mockRejectedValue(new PrettyIdAuctionApiError(code, message, minNextBid))
    }

    it('insufficient_coins keeps the dialog open and offers Top up, with no toast and no change', async () => {
      refuse('insufficient_coins')
      const { actions, bidStore, balance } = setup()

      await openAndConfirm(actions)

      expect(bidStore.isShortOnCoins).toBe(true)
      expect(bidStore.confirmId).toBe(ID)
      expect(bidStore.isBidding).toBe(false)
      expect(toastAdd).not.toHaveBeenCalled()
      expect(balance.coins).toBe('100000')
    })

    it('openTopUp closes the dialog and goes to the buy-coins route', async () => {
      refuse('insufficient_coins')
      const { actions, bidStore } = setup()
      await openAndConfirm(actions)

      await actions.openTopUp()

      expect(navigateToMock).toHaveBeenCalledWith(PRETTY_ID_TOP_UP_ROUTE)
      expect(bidStore.confirmId).toBeNull()
    })

    it('bid_too_low toasts the new minimum, sets the field to it, closes the dialog and refetches the snapshot', async () => {
      refuse('bid_too_low', 'x', 150_000)
      apiMock.auction.mockResolvedValue(makeSnapshot({ id: ID, min_next_bid: 150_000 }))
      const { actions, auctionStore, bidStore, balance } = setup()

      await openAndConfirm(actions)

      expect(toastTitles()).toEqual(['Someone bid first. The minimum is now 150,000.'])
      expect(bidStore.draft).toBe('150000')
      expect(bidStore.confirmId).toBeNull()
      expect(balance.coins).toBe('100000')
      await vi.waitFor(() => expect(auctionStore.snapshotById(ID)?.min_next_bid).toBe(150_000))
      expect(apiMock.auction).toHaveBeenCalledWith(ID)
    })

    it('bid_too_low without a minimum still toasts, closes and refetches', async () => {
      refuse('bid_too_low', 'Too low')
      const { actions, bidStore } = setup()
      await openAndConfirm(actions)
      expect(toastTitles()).toEqual(['Too low'])
      expect(bidStore.confirmId).toBeNull()
      await vi.waitFor(() => expect(apiMock.auction).toHaveBeenCalledWith(ID))
    })

    it.each<PrettyIdAuctionErrorCode>(['already_highest', 'entry_required', 'disqualified', 'staff_not_allowed'])(
      '%s toasts, closes the dialog and refetches both me and the snapshot',
      async (code) => {
        refuse(code)
        const { actions, bidStore, balance } = setup()

        await openAndConfirm(actions)

        expect(toastTitles()).toEqual([`refused: ${code}`])
        expect(bidStore.confirmId).toBeNull()
        expect(balance.coins).toBe('100000')
        await vi.waitFor(() => expect(apiMock.auctionMe).toHaveBeenCalledWith(ID))
        await vi.waitFor(() => expect(apiMock.auction).toHaveBeenCalledWith(ID))
      },
    )

    it.each<PrettyIdAuctionErrorCode>(['auction_ended', 'auction_not_live'])(
      '%s toasts, closes the dialog and refetches the snapshot only',
      async (code) => {
        refuse(code)
        const { actions, bidStore } = setup()

        await openAndConfirm(actions)

        expect(toastTitles()).toEqual([`refused: ${code}`])
        expect(bidStore.confirmId).toBeNull()
        await vi.waitFor(() => expect(apiMock.auction).toHaveBeenCalledWith(ID))
        expect(apiMock.auctionMe).not.toHaveBeenCalled()
      },
    )

    it.each<PrettyIdAuctionErrorCode>(['invalid', 'not_found'])(
      '%s toasts and closes the dialog with no refetch',
      async (code) => {
        refuse(code)
        const { actions, bidStore } = setup()

        await openAndConfirm(actions)

        expect(toastTitles()).toEqual([`refused: ${code}`])
        expect(bidStore.confirmId).toBeNull()
        expect(apiMock.auction).not.toHaveBeenCalled()
        expect(apiMock.auctionMe).not.toHaveBeenCalled()
      },
    )

    it('unknown toasts and keeps the dialog open so the viewer can retry', async () => {
      refuse('unknown', 'Network error. Check your connection.')
      const { actions, bidStore } = setup()

      await openAndConfirm(actions)

      expect(toastTitles()).toEqual(['Network error. Check your connection.'])
      expect(bidStore.confirmId).toBe(ID)
      expect(bidStore.isBidding).toBe(false)
    })
  })
})
