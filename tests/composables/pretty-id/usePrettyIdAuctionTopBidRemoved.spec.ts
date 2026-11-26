import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import {
  isPrettyIdTopBidRemoved,
  usePrettyIdAuctionTopBidRemoved,
} from '~/composables/pretty-id/usePrettyIdAuctionTopBidRemoved'
import { PRETTY_ID_DISQUALIFIED_MESSAGE, PRETTY_ID_TOP_BID_REMOVED_MESSAGE } from '~/utils/pretty-id-auction-error'
import { makeBid, makeSnapshot, makeUser } from '../../helpers/prettyIdAuctionFixtures'

describe('isPrettyIdTopBidRemoved', () => {
  it('is true: live, no leader, price floor still set', () => {
    expect(isPrettyIdTopBidRemoved(makeSnapshot({ leader: null, price_floor: 120_000, min_next_bid: 130_000 }))).toBe(true)
  })

  it('is true: live, no leader, bids still on the board', () => {
    expect(isPrettyIdTopBidRemoved(makeSnapshot({ leader: null, top_bids: [makeBid(120_000, makeUser(5))] }))).toBe(true)
  })

  it('is false: live, no leader, no floor, empty board (never bid, or every bid removed)', () => {
    expect(isPrettyIdTopBidRemoved(makeSnapshot({ leader: null, price_floor: null, top_bids: [] }))).toBe(false)
  })

  it('is false while somebody leads', () => {
    expect(isPrettyIdTopBidRemoved(makeSnapshot({ leader: makeUser(5), price_floor: 120_000 }))).toBe(false)
  })

  it.each(['upcoming', 'ended', 'cancelled'] as const)('is false for a %s auction', (state) => {
    expect(isPrettyIdTopBidRemoved(makeSnapshot({ state, leader: null, price_floor: 120_000 }))).toBe(false)
  })

  it('is false without a snapshot', () => {
    expect(isPrettyIdTopBidRemoved(undefined)).toBe(false)
  })

  it('follows the snapshot when it changes', () => {
    const snapshot = ref(makeSnapshot({ leader: makeUser(5), price_floor: 120_000 }))
    const removed = usePrettyIdAuctionTopBidRemoved(() => snapshot.value)
    expect(removed.value).toBe(false)
    snapshot.value = makeSnapshot({ leader: null, price_floor: 110_000, min_next_bid: 120_000 })
    expect(removed.value).toBe(true)
  })
})

describe('copy', () => {
  it('uses the agreed lines', () => {
    expect(PRETTY_ID_TOP_BID_REMOVED_MESSAGE).toBe('Top bid removed — bid again to lead.')
    expect(PRETTY_ID_DISQUALIFIED_MESSAGE).toBe('You were disqualified from this auction. Your entry fee is not returned.')
  })
})
