/**
 * "Top bid removed": a LIVE auction whose leader was disqualified (or blocked /
 * deleted) has `leader: null` while bids may remain on the board. The server
 * has already moved `min_next_bid` (floor + raise, or the opening bid when no bid
 * is left), so the bid area simply follows it; this only tells the page to say so.
 *
 * Derived from the snapshot, never stored. A live auction that never had a bid
 * (`leader: null`, `price_floor: null`, empty board) is NOT this state, and the
 * snapshot cannot tell it apart from "all bids removed".
 */

import { computed, toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { PrettyIdAuctionSnapshot } from '~/types/pretty-id-auction'

/** GATE (pure): live, nobody leads, yet a price floor or bids remain. */
export function isPrettyIdTopBidRemoved(
  auction: Pick<PrettyIdAuctionSnapshot, 'state' | 'leader' | 'price_floor' | 'top_bids'> | undefined,
): boolean {
  return auction !== undefined
    && auction.state === 'live'
    && auction.leader === null
    && (auction.price_floor !== null || auction.top_bids.length > 0)
}

export function usePrettyIdAuctionTopBidRemoved(
  auction: MaybeRefOrGetter<Parameters<typeof isPrettyIdTopBidRemoved>[0]>,
): ComputedRef<boolean> {
  return computed(() => isPrettyIdTopBidRemoved(toValue(auction)))
}
