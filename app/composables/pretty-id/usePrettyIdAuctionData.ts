/**
 * Data composable for the Rare Auction side of the Pretty ID event.
 *
 * Queries only: the lot grid, one lot, the winners board and the weekly record,
 * written into `usePrettyIdAuctionStore`.
 *
 * REACT on lot transitions: whenever a refetched lot replaces the stored copy,
 * `detectPrettyIdLotTransition` tells whether this user was just outbid or just
 * won; that raises the matching toast and refreshes `me` (the escrow came back,
 * or the win changed the balance).
 *
 * Staleness: a lot that was replaced while its request was in flight (a bid or
 * entry response, another poll) is newer than the response, so the response is
 * ignored for that lot. Without this, a poll issued just before a bid would
 * overwrite the bid and fire a false "outbid" toast.
 *
 * Failures: a load toasts only when there is nothing on screen to fall back on,
 * and never when `quiet` (a poll tick: no toast, no loading flag, so a dead
 * connection does not toast every few seconds or flicker the skeleton).
 */

import { usePrettyIdApi } from '~/composables/pretty-id/usePrettyIdApi'
import { usePrettyIdData } from '~/composables/pretty-id/usePrettyIdData'
import { usePrettyIdToast } from '~/composables/pretty-id/usePrettyIdToast'
import { usePrettyIdStore } from '~/stores/prettyId'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import type { PrettyIdLot, PrettyIdWinner } from '~/types/pretty-id'
import { toPrettyIdError } from '~/utils/pretty-id-error'
import { createLogger } from '~/utils/logger'

const log = createLogger('[PrettyIdAuctionData]')

const FALLBACK_BIDDER_NAME = 'Someone'

export type PrettyIdLotTransition = 'outbid' | 'won'

export interface PrettyIdLoadOptions {
  /** Background refresh (poll tick): failures are only logged and the loading flag is left alone. */
  quiet?: boolean
}

/**
 * Pure. What happened to this user between two snapshots of a lot:
 * - `outbid` — was the highest bidder, is not now, lot still live;
 * - `won` — lot went live → ended with this user's bid on top;
 * - `null` — nothing to announce (also when there is no previous snapshot).
 */
export function detectPrettyIdLotTransition(
  prev: PrettyIdLot | undefined,
  next: PrettyIdLot,
): PrettyIdLotTransition | null {
  if (prev === undefined) return null
  if (prev.you_are_highest && !next.you_are_highest && next.status === 'live') return 'outbid'
  if (prev.status === 'live' && next.status === 'ended' && next.top_bids[0]?.is_me === true) return 'won'
  return null
}

export function usePrettyIdAuctionData() {
  const api = usePrettyIdApi()
  const store = usePrettyIdStore()
  const auctionStore = usePrettyIdAuctionStore()
  const toast = usePrettyIdToast()
  const { loadMe } = usePrettyIdData()

  let latestWinnersRequest = 0

  /** REACT — announces a transition; returns whether `me` must be refreshed. */
  function reactToLot(prev: PrettyIdLot | undefined, next: PrettyIdLot): boolean {
    const transition = detectPrettyIdLotTransition(prev, next)
    if (transition === 'outbid') {
      const bidder = next.top_bids[0]?.user.name ?? FALLBACK_BIDDER_NAME
      toast.error(`${bidder} outbid you on ${next.number}. Escrow refunded.`)
    } else if (transition === 'won') {
      // `me` can still be loading on a deep link; then the duration is left out.
      const days = store.me?.rules.ownership_days
      const tail = days === undefined ? '' : ` It is yours for ${days} days.`
      toast.success(`You won Rare ID ${next.number}!${tail}`)
    }
    return transition !== null
  }

  // ========================================
  // EXECUTE — lots
  // ========================================

  async function loadLots(options: PrettyIdLoadOptions = {}): Promise<void> {
    // The stored copy of each lot at request time, to spot lots replaced while in flight.
    const startedWith = new Map<number, PrettyIdLot | undefined>()
    for (const lot of auctionStore.lots) startedWith.set(lot.id, auctionStore.lotById(lot.id))
    if (!options.quiet) auctionStore.setLotsLoading(true)
    try {
      const fetched = await api.auctions()
      let refreshMe = false
      const next = fetched.map((lot) => {
        const current = auctionStore.lotById(lot.id)
        if (current !== startedWith.get(lot.id)) return current ?? lot // replaced in flight: newer
        if (reactToLot(current, lot)) refreshMe = true
        return lot
      })
      auctionStore.setLots(next)
      if (refreshMe) void loadMe()
    } catch (err) {
      if (!options.quiet && auctionStore.lots.length === 0) toast.error(toPrettyIdError(err).message)
      log.warn('Failed to load auctions', err)
    } finally {
      if (!options.quiet) auctionStore.setLotsLoading(false)
    }
  }

  /** @returns whether a fresh copy of the lot was applied. */
  async function loadLot(lotId: number, options: PrettyIdLoadOptions = {}): Promise<boolean> {
    const before = auctionStore.lotById(lotId)
    try {
      const lot = await api.auction(lotId)
      if (auctionStore.lotById(lotId) !== before) return false // replaced in flight: newer
      const refreshMe = reactToLot(before, lot)
      auctionStore.upsertLot(lot)
      if (refreshMe) void loadMe()
      return true
    } catch (err) {
      if (!options.quiet && before === undefined) toast.error(toPrettyIdError(err).message)
      log.warn('Failed to load auction', { lotId, err })
      return false
    }
  }

  // ========================================
  // EXECUTE — winners board & weekly record
  // ========================================

  /** `month` is `YYYY-MM`; omitted = the current month. A newer request supersedes an older one. */
  async function loadWinners(month?: string): Promise<void> {
    const request = ++latestWinnersRequest
    auctionStore.setWinnersLoading(true)
    try {
      const response = await api.winners(month)
      if (request === latestWinnersRequest) auctionStore.setWinners(response)
    } catch (err) {
      if (request !== latestWinnersRequest) return
      toast.error(toPrettyIdError(err).message)
      log.warn('Failed to load winners', { month, err })
    } finally {
      if (request === latestWinnersRequest) auctionStore.setWinnersLoading(false)
    }
  }

  async function loadWeekly(): Promise<void> {
    auctionStore.setWeeklyLoading(true)
    try {
      auctionStore.setWeekly(await api.weekly())
    } catch (err) {
      toast.error(toPrettyIdError(err).message)
      log.warn('Failed to load the weekly record', err)
    } finally {
      auctionStore.setWeeklyLoading(false)
    }
  }

  /** Opens (or, with `null`, closes) the winner bottom sheet. */
  function selectWinner(winner: PrettyIdWinner | null): void {
    auctionStore.setSelectedWinner(winner)
  }

  return { loadLots, loadLot, loadWinners, loadWeekly, selectWinner }
}
