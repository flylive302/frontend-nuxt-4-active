/**
 * Action composable for paying a Rare Auction's entry fee.
 *
 * Every function runs GATE → EXECUTE → REACT. The server stays authoritative:
 * a gate that passes here can still be refused by the API, and each refusal
 * code has its own REACT (top-up offer, refreshed standing, toast).
 */

import { usePrettyIdAuctionApi } from '~/composables/pretty-id/usePrettyIdAuctionApi'
import { usePrettyIdAuctionData } from '~/composables/pretty-id/usePrettyIdAuctionData'
import { usePrettyIdToast } from '~/composables/pretty-id/usePrettyIdToast'
import { PRETTY_ID_TOP_UP_ROUTE } from '~/constants/pretty-id'
import { useBalanceStore } from '~/stores/balance'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { usePrettyIdAuctionEnterStore } from '~/stores/prettyIdAuctionEnter'
import type { PrettyIdAuctionEnterResult, PrettyIdAuctionErrorCode } from '~/types/pretty-id-auction'
import { formatCoins } from '~/utils/currency'
import { createLogger } from '~/utils/logger'
import { toPrettyIdAuctionError } from '~/utils/pretty-id-auction-error'

const log = createLogger('[PrettyIdAuctionEnterActions]')

/** Refusals after which the viewer's own standing is stale: refetching it moves the page to the right state. */
const STALE_STANDING_CODES: readonly PrettyIdAuctionErrorCode[] = ['already_entered', 'disqualified', 'staff_not_allowed']

export function usePrettyIdAuctionEnterActions() {
  const api = usePrettyIdAuctionApi()
  const auctionStore = usePrettyIdAuctionStore()
  const enterStore = usePrettyIdAuctionEnterStore()
  const balanceStore = useBalanceStore()
  const toast = usePrettyIdToast()
  const { loadAuctionMe } = usePrettyIdAuctionData()

  // ========================================
  // GATE
  // ========================================

  /** True when this viewer may pay the entry fee for the auction right now, as far as the client knows. */
  function canEnter(id: number): boolean {
    if (auctionStore.snapshotById(id)?.state !== 'live') return false
    const me = auctionStore.myStandingById(id)
    return me !== undefined && me.may_bid && !me.entered && !me.disqualified
  }

  // ========================================
  // Open / close the confirm dialog
  // ========================================

  /** "Pay <fee> entry": opens the confirm dialog if the viewer may enter. */
  function openEntry(id: number): void {
    // GATE
    if (enterStore.isEntering || !canEnter(id)) return
    // EXECUTE
    enterStore.setShortOnCoins(false)
    enterStore.setConfirmId(id)
  }

  /** Refused while the call is in flight: the dialog must stay up until the server answers. */
  function closeEntry(): void {
    if (enterStore.isEntering) return
    enterStore.setConfirmId(null)
  }

  /** "Top up": leaves for the Buy coins page. */
  async function openTopUp(): Promise<void> {
    enterStore.setConfirmId(null)
    await navigateTo(PRETTY_ID_TOP_UP_ROUTE)
  }

  // ========================================
  // Confirm
  // ========================================

  /** EXECUTE — the standing and the coin balance both come straight from the response. */
  function applyEntered(id: number, result: PrettyIdAuctionEnterResult): void {
    auctionStore.setMyStanding(id, {
      entered: result.entered,
      disqualified: result.disqualified,
      may_bid: result.may_bid,
    })
    balanceStore.patch({ coins: String(result.coins) })
  }

  async function confirmEntry(): Promise<void> {
    // GATE
    const id = enterStore.confirmId
    if (id === null || enterStore.isEntering) return
    if (!canEnter(id)) {
      enterStore.setConfirmId(null)
      return
    }

    enterStore.setEntering(true)
    try {
      // EXECUTE
      const result = await api.enter(id)
      applyEntered(id, result)
      enterStore.setConfirmId(null)
      // REACT
      toast.success(`You're in. Entry fee paid: ${formatCoins(result.fee_paid)}`)
      void loadAuctionMe(id)
    } catch (err) {
      const error = toPrettyIdAuctionError(err)
      reactToRefusal(id, error.code, error.message)
      log.warn('Entry failed', { id, code: error.code })
    } finally {
      enterStore.setEntering(false)
    }
  }

  function reactToRefusal(id: number, code: PrettyIdAuctionErrorCode, message: string): void {
    if (code === 'insufficient_coins') {
      // The dialog stays up and swaps "Confirm" for "Top up".
      enterStore.setShortOnCoins(true)
      return
    }
    toast.error(message)
    // A network or server hiccup: keep the dialog so the viewer can try again.
    if (code === 'unknown') return
    enterStore.setConfirmId(null)
    if (STALE_STANDING_CODES.includes(code)) void loadAuctionMe(id)
  }

  return {
    canEnter,
    openEntry,
    closeEntry,
    openTopUp,
    confirmEntry,
  }
}
