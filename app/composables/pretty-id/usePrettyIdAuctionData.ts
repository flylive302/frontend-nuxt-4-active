/**
 * Data composable for the Rare Auction side of the Pretty ID event.
 *
 * Queries only: the tab list, one auction's snapshot and the viewer's own
 * standing (`me`), written into `usePrettyIdAuctionStore`. Every list and
 * snapshot response also refreshes the store's server-clock offset, which is
 * what the countdowns run on.
 *
 * Failures: a load toasts only when there is nothing on screen to fall back on,
 * and never when `quiet` (a poll tick: no toast, no loading flag, so a dead
 * connection does not toast every few seconds or flicker the skeleton).
 * A 404 (an auction, or the list while the auction is off) is reported as `not_found`, not as a failure.
 */

import { usePrettyIdAuctionApi } from '~/composables/pretty-id/usePrettyIdAuctionApi'
import { usePrettyIdToast } from '~/composables/pretty-id/usePrettyIdToast'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import type {
  PrettyIdAuctionList,
  PrettyIdAuctionLoadOutcome,
  PrettyIdAuctionSnapshot,
} from '~/types/pretty-id-auction'
import { createLogger } from '~/utils/logger'
import { prettyIdClockOffset } from '~/utils/pretty-id-auction'
import { toPrettyIdAuctionError } from '~/utils/pretty-id-auction-error'
import type { PrettyIdAuctionApiError } from '~/utils/pretty-id-auction-error'

const log = createLogger('[PrettyIdAuctionData]')

export interface PrettyIdAuctionLoadOptions {
  /** Background refresh (poll tick): failures are only logged and the loading flag is left alone. */
  quiet?: boolean
}

export function usePrettyIdAuctionData() {
  const api = usePrettyIdAuctionApi()
  const store = usePrettyIdAuctionStore()
  const toast = usePrettyIdToast()

  // ========================================
  // EXECUTE: writes into the store
  // ========================================

  /** Moves the server-clock offset to this response's `server_now`; a bad stamp is ignored. */
  function applyClock(serverNowIso: string): void {
    const offset = prettyIdClockOffset(serverNowIso, Date.now())
    if (offset !== null) store.setClockOffsetMs(offset)
  }

  function applyList(list: PrettyIdAuctionList): void {
    applyClock(list.server_now)
    store.setAuctions(list.auctions)
  }

  function applySnapshot(snapshot: PrettyIdAuctionSnapshot): void {
    applyClock(snapshot.server_now)
    store.setSnapshot(snapshot)
  }

  // ========================================
  // REACT: failure feedback
  // ========================================

  /**
   * A 404 on the list means the auction is off server-side: an answer, not a
   * failure, so it neither toasts nor flags the list failed. Any other failure
   * toasts only with nothing on screen to fall back on, and never when quiet.
   */
  function reactToListFailure(error: PrettyIdAuctionApiError, quiet: boolean): void {
    if (error.code === 'not_found' || store.isAuctionsLoaded) return
    store.setAuctionsFailed(true)
    if (!quiet) toast.error(error.message)
  }

  function reactToAuctionFailure(id: number, error: PrettyIdAuctionApiError, quiet: boolean): void {
    if (!quiet && store.snapshotById(id) === undefined) toast.error(error.message)
  }

  // ========================================
  // Public loads
  // ========================================

  async function loadAuctions(options: PrettyIdAuctionLoadOptions = {}): Promise<PrettyIdAuctionLoadOutcome> {
    const quiet = options.quiet === true
    if (!quiet) store.setAuctionsLoading(true)
    try {
      applyList(await api.auctions())
      return 'ok'
    } catch (err) {
      const error = toPrettyIdAuctionError(err)
      reactToListFailure(error, quiet)
      log.warn('Failed to load auctions', err)
      return error.code === 'not_found' ? 'not_found' : 'error'
    } finally {
      if (!quiet) store.setAuctionsLoading(false)
    }
  }

  async function loadAuction(id: number, options: PrettyIdAuctionLoadOptions = {}): Promise<PrettyIdAuctionLoadOutcome> {
    try {
      applySnapshot(await api.auction(id))
      return 'ok'
    } catch (err) {
      const error = toPrettyIdAuctionError(err)
      // A 404 is an answer ("no such auction"), not a failure: the view says so, no toast.
      if (error.code === 'not_found') return 'not_found'
      reactToAuctionFailure(id, error, options.quiet === true)
      log.warn('Failed to load auction', { id, err })
      return 'error'
    }
  }

  /** The viewer's own standing. Called once per page open; a failure is only logged (nothing blocks on it yet). */
  async function loadAuctionMe(id: number): Promise<void> {
    try {
      store.setMyStanding(id, await api.auctionMe(id))
    } catch (err) {
      log.warn('Failed to load own auction standing', { id, err })
    }
  }

  return { loadAuctions, loadAuction, loadAuctionMe }
}
