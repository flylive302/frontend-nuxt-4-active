import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, readonly, ref } from 'vue'
import { usePrettyIdAuctionEnterActions } from '~/composables/pretty-id/usePrettyIdAuctionEnterActions'
import { PRETTY_ID_TOP_UP_ROUTE } from '~/constants/pretty-id'
import { useBalanceStore } from '~/stores/balance'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { usePrettyIdAuctionEnterStore } from '~/stores/prettyIdAuctionEnter'
import type { PrettyIdAuctionErrorCode } from '~/types/pretty-id-auction'
import { PrettyIdAuctionApiError } from '~/utils/pretty-id-auction-error'
import { deferred } from '../../helpers/prettyIdFixtures'
import {
  createAuctionApiMock,
  makeEnterResult,
  makeMe,
  makeSnapshot,
  resetAuctionApiMock,
} from '../../helpers/prettyIdAuctionFixtures'

const apiMock = createAuctionApiMock()
const toastAdd = vi.fn()
const navigateToMock = vi.fn()

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
vi.stubGlobal('navigateTo', navigateToMock)

const ID = 1
/** A viewer who may bid and has not entered yet. */
const CAN_ENTER = makeMe({ may_bid: true })

function toastTitles(): string[] {
  return toastAdd.mock.calls.map(([options]) => (options as { title: string }).title)
}

describe('usePrettyIdAuctionEnterActions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetAuctionApiMock(apiMock)
    toastAdd.mockReset()
    navigateToMock.mockReset()
  })

  function setup(options: { state?: 'live' | 'upcoming' | 'ended'; me?: ReturnType<typeof makeMe> | null } = {}) {
    const auctionStore = usePrettyIdAuctionStore()
    const enterStore = usePrettyIdAuctionEnterStore()
    const balance = useBalanceStore()
    balance.patch({ coins: '100000' })
    auctionStore.setSnapshot(makeSnapshot({ id: ID, state: options.state ?? 'live' }))
    const me = options.me === undefined ? CAN_ENTER : options.me
    if (me !== null) auctionStore.setMyStanding(ID, me)
    return { auctionStore, enterStore, balance, actions: usePrettyIdAuctionEnterActions() }
  }

  /** Opens the dialog and confirms, as the user would. */
  async function openAndConfirm(actions: ReturnType<typeof usePrettyIdAuctionEnterActions>): Promise<void> {
    actions.openEntry(ID)
    await actions.confirmEntry()
  }

  // ========================================
  // openEntry
  // ========================================

  describe('openEntry', () => {
    it('opens the dialog for a live auction the viewer may enter', () => {
      const { actions, enterStore } = setup()
      actions.openEntry(ID)
      expect(enterStore.confirmId).toBe(ID)
      expect(enterStore.isShortOnCoins).toBe(false)
    })

    it.each([
      ['an upcoming auction', { state: 'upcoming' as const }],
      ['an ended auction', { state: 'ended' as const }],
      ['an already entered viewer', { me: makeMe({ may_bid: true, entered: true }) }],
      ['a staff viewer (may_bid false)', { me: makeMe({ may_bid: false }) }],
      ['a disqualified viewer', { me: makeMe({ may_bid: false, disqualified: true }) }],
      ['a viewer whose standing is not loaded', { me: null }],
    ])('stays closed for %s', (_name, options) => {
      const { actions, enterStore } = setup(options)
      actions.openEntry(ID)
      expect(enterStore.confirmId).toBeNull()
    })

    it('stays closed while an entry is in flight', () => {
      const { actions, enterStore } = setup()
      enterStore.setEntering(true)
      actions.openEntry(ID)
      expect(enterStore.confirmId).toBeNull()
    })

    it('closeEntry is refused while the entry is in flight', () => {
      const { actions, enterStore } = setup()
      actions.openEntry(ID)
      enterStore.setEntering(true)
      actions.closeEntry()
      expect(enterStore.confirmId).toBe(ID)
    })

    it('closeEntry closes the dialog otherwise', () => {
      const { actions, enterStore } = setup()
      actions.openEntry(ID)
      actions.closeEntry()
      expect(enterStore.confirmId).toBeNull()
    })
  })

  // ========================================
  // confirmEntry: success
  // ========================================

  describe('confirmEntry', () => {
    it('calls enter, sets the standing and balance from the response, toasts and refetches me', async () => {
      apiMock.enter.mockResolvedValue(makeEnterResult({ fee_paid: 5_000, coins: 95_000 }))
      apiMock.auctionMe.mockResolvedValue(makeMe({ entered: true, may_bid: true }))
      const { actions, auctionStore, enterStore, balance } = setup()

      await openAndConfirm(actions)

      expect(apiMock.enter).toHaveBeenCalledWith(ID)
      expect(auctionStore.myStandingById(ID)).toEqual({ entered: true, disqualified: false, may_bid: true })
      expect(balance.coins).toBe('95000')
      expect(enterStore.confirmId).toBeNull()
      expect(enterStore.isEntering).toBe(false)
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'success' }))
      await vi.waitFor(() => expect(apiMock.auctionMe).toHaveBeenCalledWith(ID))
    })

    it('does nothing with no dialog open', async () => {
      const { actions } = setup()
      await actions.confirmEntry()
      expect(apiMock.enter).not.toHaveBeenCalled()
    })

    it('re-checks the gate: a standing that turned stale closes the dialog without calling enter', async () => {
      const { actions, auctionStore, enterStore } = setup()
      actions.openEntry(ID)
      auctionStore.setMyStanding(ID, makeMe({ may_bid: true, entered: true }))
      await actions.confirmEntry()
      expect(apiMock.enter).not.toHaveBeenCalled()
      expect(enterStore.confirmId).toBeNull()
    })

    it('guards against a double confirm', async () => {
      const gate = deferred<ReturnType<typeof makeEnterResult>>()
      apiMock.enter.mockReturnValue(gate.promise)
      const { actions, enterStore } = setup()
      actions.openEntry(ID)

      const first = actions.confirmEntry()
      expect(enterStore.isEntering).toBe(true)
      await actions.confirmEntry()
      expect(apiMock.enter).toHaveBeenCalledTimes(1)

      gate.resolve(makeEnterResult())
      await first
      expect(enterStore.isEntering).toBe(false)
    })

    // ========================================
    // Refusals
    // ========================================

    function refuse(code: PrettyIdAuctionErrorCode, message = `refused: ${code}`): void {
      apiMock.enter.mockRejectedValue(new PrettyIdAuctionApiError(code, message))
    }

    it('insufficient_coins keeps the dialog open and offers Top up, with no toast and no change', async () => {
      refuse('insufficient_coins')
      const { actions, auctionStore, enterStore, balance } = setup()

      await openAndConfirm(actions)

      expect(enterStore.isShortOnCoins).toBe(true)
      expect(enterStore.confirmId).toBe(ID)
      expect(enterStore.isEntering).toBe(false)
      expect(toastAdd).not.toHaveBeenCalled()
      expect(auctionStore.myStandingById(ID)).toEqual(CAN_ENTER)
      expect(balance.coins).toBe('100000')
    })

    it('openTopUp closes the dialog and goes to the buy-coins route', async () => {
      refuse('insufficient_coins')
      const { actions, enterStore } = setup()
      await openAndConfirm(actions)

      await actions.openTopUp()

      expect(navigateToMock).toHaveBeenCalledWith(PRETTY_ID_TOP_UP_ROUTE)
      expect(enterStore.confirmId).toBeNull()
    })

    it('reopening the dialog clears the Top up offer', async () => {
      refuse('insufficient_coins')
      const { actions, enterStore } = setup()
      await openAndConfirm(actions)
      actions.closeEntry()

      actions.openEntry(ID)

      expect(enterStore.isShortOnCoins).toBe(false)
    })

    it('already_entered toasts, closes the dialog and refetches me', async () => {
      refuse('already_entered')
      apiMock.auctionMe.mockResolvedValue(makeMe({ entered: true, may_bid: true }))
      const { actions, auctionStore, enterStore } = setup()

      await openAndConfirm(actions)

      expect(toastTitles()).toEqual(['refused: already_entered'])
      expect(enterStore.confirmId).toBeNull()
      await vi.waitFor(() => expect(auctionStore.myStandingById(ID)?.entered).toBe(true))
    })

    it.each<PrettyIdAuctionErrorCode>(['disqualified', 'staff_not_allowed'])(
      '%s toasts, closes the dialog, refetches me and touches neither standing nor balance',
      async (code) => {
        refuse(code)
        const { actions, auctionStore, enterStore, balance } = setup()

        await openAndConfirm(actions)

        expect(toastTitles()).toEqual([`refused: ${code}`])
        expect(enterStore.confirmId).toBeNull()
        expect(balance.coins).toBe('100000')
        await vi.waitFor(() => expect(apiMock.auctionMe).toHaveBeenCalledWith(ID))
        expect(auctionStore.myStandingById(ID)?.entered).toBe(false)
      },
    )

    it.each<PrettyIdAuctionErrorCode>(['auction_not_live', 'not_found'])(
      '%s toasts, closes the dialog and changes nothing',
      async (code) => {
        refuse(code)
        const { actions, auctionStore, enterStore, balance } = setup()

        await openAndConfirm(actions)

        expect(toastTitles()).toEqual([`refused: ${code}`])
        expect(enterStore.confirmId).toBeNull()
        expect(auctionStore.myStandingById(ID)).toEqual(CAN_ENTER)
        expect(balance.coins).toBe('100000')
        expect(apiMock.auctionMe).not.toHaveBeenCalled()
      },
    )

    it('unknown toasts and keeps the dialog open so the viewer can retry', async () => {
      refuse('unknown', 'Network error. Check your connection.')
      const { actions, enterStore } = setup()

      await openAndConfirm(actions)

      expect(toastTitles()).toEqual(['Network error. Check your connection.'])
      expect(enterStore.confirmId).toBe(ID)
      expect(enterStore.isEntering).toBe(false)
    })
  })
})
