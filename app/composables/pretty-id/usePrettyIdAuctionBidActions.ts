/**
 * Action composable for bidding on a Rare Auction.
 *
 * Every function runs GATE → EXECUTE → REACT. The server stays authoritative:
 * a gate that passes here can still be refused by the API, and each refusal
 * code has its own REACT (new minimum, top-up offer, refreshed standing, toast).
 *
 * "Am I leading" is never stored: `isLeading` compares the snapshot's leader id
 * with the signed-in user, so it follows every refetch by itself.
 */

import { usePrettyIdAuctionApi } from '~/composables/pretty-id/usePrettyIdAuctionApi'
import { usePrettyIdAuctionData } from '~/composables/pretty-id/usePrettyIdAuctionData'
import { usePrettyIdToast } from '~/composables/pretty-id/usePrettyIdToast'
import { PRETTY_ID_AUCTION_BID_CHIPS } from '~/constants/pretty-id-auction'
import { PRETTY_ID_TOP_UP_ROUTE } from '~/constants/pretty-id'
import { useAuthStore } from '~/stores/auth'
import { useBalanceStore } from '~/stores/balance'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { usePrettyIdAuctionBidStore } from '~/stores/prettyIdAuctionBid'
import type { PrettyIdAuctionBidResult, PrettyIdAuctionSnapshot } from '~/types/pretty-id-auction'
import { formatCoins } from '~/utils/currency'
import { createLogger } from '~/utils/logger'
import {
  isPrettyIdBidSuspicious,
  parsePrettyIdBidAmount,
  sanitizePrettyIdBidText,
} from '~/utils/pretty-id-auction'
import { toPrettyIdAuctionError } from '~/utils/pretty-id-auction-error'
import type { PrettyIdAuctionApiError } from '~/utils/pretty-id-auction-error'

const log = createLogger('[PrettyIdAuctionBidActions]')

export interface PrettyIdBidChip {
  /** Coins the chip adds to the field. */
  amount: number
}

export function usePrettyIdAuctionBidActions() {
  const api = usePrettyIdAuctionApi()
  const auctionStore = usePrettyIdAuctionStore()
  const bidStore = usePrettyIdAuctionBidStore()
  const authStore = useAuthStore()
  const balanceStore = useBalanceStore()
  const toast = usePrettyIdToast()
  const { loadAuction, loadAuctionMe, applySnapshot } = usePrettyIdAuctionData()

  // ========================================
  // GATE (pure reads)
  // ========================================

  /** True when the signed-in viewer is the auction's current leader. Derived, never stored. */
  function isLeading(id: number): boolean {
    const leaderId = auctionStore.snapshotById(id)?.leader?.id
    const myId = authStore.user?.id
    return leaderId !== undefined && myId !== undefined && leaderId === myId
  }

  /** True when this viewer may place a bid right now, as far as the client knows. */
  function canBid(id: number): boolean {
    if (auctionStore.snapshotById(id)?.state !== 'live') return false
    const me = auctionStore.myStandingById(id)
    return me !== undefined && me.entered && !me.disqualified && me.may_bid && !isLeading(id)
  }

  /** The amount in the field, or `null` when it is empty or not a positive whole number. */
  function draftAmount(id: number): number | null {
    return bidStore.draftAuctionId === id ? parsePrettyIdBidAmount(bidStore.draft) : null
  }

  /** The field holds a whole amount at or above the current minimum. */
  function isDraftValid(id: number): boolean {
    const amount = draftAmount(id)
    const snapshot = auctionStore.snapshotById(id)
    return amount !== null && snapshot !== undefined && amount >= snapshot.min_next_bid
  }

  /** Red warning in the dialog: more than ten times the current minimum. */
  function isLargeBid(id: number, amount: number): boolean {
    const snapshot = auctionStore.snapshotById(id)
    return snapshot !== undefined && isPrettyIdBidSuspicious(amount, snapshot.min_next_bid)
  }

  /** Quick-add chips: fixed coin amounts, the same for every auction. */
  function bidChips(): PrettyIdBidChip[] {
    return PRETTY_ID_AUCTION_BID_CHIPS.map(amount => ({ amount }))
  }

  /** What the field shows for this auction: its own draft, or empty while the draft belongs to another auction. */
  function draftTextFor(id: number): string {
    return bidStore.draftAuctionId === id ? bidStore.draft : ''
  }

  /** The field and chips are locked while the dialog is open or a bid is in flight. */
  function isBidFormBusy(): boolean {
    return bidStore.isBidding || bidStore.confirmId !== null
  }

  // ========================================
  // The bid field
  // ========================================

  /**
   * Keeps the field at or above the minimum: a new auction, an empty field, or a
   * minimum that overtook it (a rival bid) moves it to `min_next_bid`. A higher
   * figure the viewer typed stays.
   */
  function syncDraftToMinimum(id: number): void {
    const snapshot = auctionStore.snapshotById(id)
    if (snapshot === undefined) return
    const current = draftAmount(id)
    if (current === null || current < snapshot.min_next_bid) {
      bidStore.setDraft(id, String(snapshot.min_next_bid))
    }
  }

  /**
   * Keeps the field in step with the auction on screen: runs `syncDraftToMinimum`
   * now and whenever the auction or its minimum changes (a rival bid). Call once
   * from the bid area's setup; the watcher stops with that component.
   */
  function keepDraftAtMinimum(auction: () => PrettyIdAuctionSnapshot): void {
    watch(
      () => [auction().id, auction().min_next_bid] as const,
      ([id]) => syncDraftToMinimum(id),
      { immediate: true },
    )
  }

  /** Typing: keeps digits only. */
  function setDraftText(id: number, raw: string): void {
    bidStore.setDraft(id, sanitizePrettyIdBidText(raw))
  }

  /** A chip: raises the field by `amount` (from the minimum when the field is empty). */
  function addToDraft(id: number, amount: number): void {
    const snapshot = auctionStore.snapshotById(id)
    if (snapshot === undefined || bidStore.isBidding) return
    const base = draftAmount(id) ?? snapshot.min_next_bid
    bidStore.setDraft(id, sanitizePrettyIdBidText(String(base + amount)))
  }

  // ========================================
  // Open / close the confirm dialog
  // ========================================

  /** "Place bid": opens the confirm dialog if the viewer may bid and the field holds a valid amount. */
  function openBid(id: number): void {
    // GATE
    if (bidStore.isBidding || !canBid(id)) return
    const amount = draftAmount(id)
    const snapshot = auctionStore.snapshotById(id)
    if (amount === null || snapshot === undefined) {
      toast.error('Enter a whole number of coins.')
      return
    }
    if (amount < snapshot.min_next_bid) {
      toast.error(`The minimum bid is ${formatCoins(snapshot.min_next_bid)}.`)
      return
    }
    // EXECUTE
    bidStore.setShortOnCoins(false)
    bidStore.setConfirm(id, amount)
  }

  /** Refused while the call is in flight: the dialog must stay up until the server answers. */
  function closeBid(): void {
    if (bidStore.isBidding) return
    bidStore.setConfirm(null)
  }

  /** "Top up": leaves for the Buy coins page. */
  async function openTopUp(): Promise<void> {
    bidStore.setConfirm(null)
    await navigateTo(PRETTY_ID_TOP_UP_ROUTE)
  }

  // ========================================
  // Confirm
  // ========================================

  /** EXECUTE — the snapshot and the coin balance both come straight from the response. */
  function applyBid(result: PrettyIdAuctionBidResult): void {
    applySnapshot(result.auction)
    balanceStore.patch({ coins: String(result.coins) })
  }

  async function confirmBid(): Promise<void> {
    // GATE
    const id = bidStore.confirmId
    if (id === null || bidStore.isBidding) return
    if (!canBid(id)) {
      bidStore.setConfirm(null)
      return
    }
    const amount = bidStore.confirmAmount

    bidStore.setBidding(true)
    try {
      // EXECUTE
      const result = await api.bid(id, amount)
      applyBid(result)
      bidStore.setConfirm(null)
      // REACT
      toast.success(`Bid placed: ${formatCoins(amount)}. Held until you're outbid.`)
      void loadAuction(id, { quiet: true })
    } catch (err) {
      const error = toPrettyIdAuctionError(err)
      reactToRefusal(id, error)
      log.warn('Bid failed', { id, code: error.code })
    } finally {
      bidStore.setBidding(false)
    }
  }

  function reactToRefusal(id: number, error: PrettyIdAuctionApiError): void {
    const { code, message } = error
    switch (code) {
      case 'insufficient_coins':
        // The dialog stays up and swaps "Place bid" for "Top up".
        bidStore.setShortOnCoins(true)
        return
      case 'unknown':
        // A network or server hiccup: keep the dialog so the viewer can try again.
        toast.error(message)
        return
      case 'bid_too_low':
        bidStore.setConfirm(null)
        if (error.minNextBid !== undefined) {
          bidStore.setDraft(id, String(error.minNextBid))
          toast.error(`Someone bid first. The minimum is now ${formatCoins(error.minNextBid)}.`)
        } else {
          toast.error(message)
        }
        void loadAuction(id, { quiet: true })
        return
      case 'already_highest':
      case 'entry_required':
      case 'disqualified':
      case 'staff_not_allowed':
        // The viewer's own standing (or the leader) is stale: refetching both moves the page to the right state.
        toast.error(message)
        bidStore.setConfirm(null)
        void loadAuctionMe(id)
        void loadAuction(id, { quiet: true })
        return
      case 'auction_ended':
      case 'auction_not_live':
        toast.error(message)
        bidStore.setConfirm(null)
        void loadAuction(id, { quiet: true })
        return
      default:
        // invalid, not_found, anything else: nothing to retry.
        toast.error(message)
        bidStore.setConfirm(null)
    }
  }

  return {
    isLeading,
    canBid,
    isDraftValid,
    isLargeBid,
    bidChips,
    draftTextFor,
    isBidFormBusy,
    syncDraftToMinimum,
    keepDraftAtMinimum,
    setDraftText,
    addToDraft,
    openBid,
    closeBid,
    openTopUp,
    confirmBid,
  }
}
