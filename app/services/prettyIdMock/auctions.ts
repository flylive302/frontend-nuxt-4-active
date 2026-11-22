// ========================================
// Pretty ID mock backend — auctions, winners, weekly record
// ========================================
//
// Entering and bidding follow the demo's rules: a non-refundable entry fee, the
// whole bid held in escrow (refunded when outbid), a minimum raise, and a
// one-minute anti-snipe extension. GATE helpers throw `PrettyIdApiError`;
// `executeBid` is shared with the rival bots (`rivals.ts`).

import { buildAllotment, buildLot, buildWinner } from '~/services/prettyIdMock/mappers'
import { ANTI_SNIPE_MS, PRETTY_ID_MOCK_RULES, minNextBid } from '~/services/prettyIdMock/rules'
import type { MockCtx, MockData, MockLot, MockUserRef } from '~/services/prettyIdMock/state'
import type {
  PrettyIdAuctionActionResult,
  PrettyIdMockProfile,
  PrettyIdWeeklyResponse,
  PrettyIdWinnersResponse,
} from '~/types/pretty-id'
import { formatCoins } from '~/utils/currency'
import { PrettyIdApiError } from '~/utils/pretty-id-error'
import { prettyIdMonthKey } from '~/utils/pretty-id-format'

// ========================================
// Constants
// ========================================

const MESSAGES = {
  auctionNotFound: 'Auction not found',
  alreadyEntered: 'Already entered',
  auctionEnded: 'Auction has ended',
  entryRequired: 'Pay the entry fee first',
  alreadyHighest: 'You are already the highest bidder',
  wholeCoins: 'Bid must be a whole number of coins',
} as const

// ========================================
// Lots
// ========================================

export function findLot({ data }: MockCtx, lotId: number): MockLot {
  const lot = data.lots.find(candidate => Number(candidate.number) === lotId)
  if (!lot) throw new PrettyIdApiError('not_found', MESSAGES.auctionNotFound)
  return lot
}

function actionResult({ data }: MockCtx, lot: MockLot, profile: PrettyIdMockProfile): PrettyIdAuctionActionResult {
  return { auction: buildLot(lot, profile), coins: data.coins }
}

// ========================================
// Enter
// ========================================

function gateEnter({ data }: MockCtx, lot: MockLot): void {
  const { entryFee, minLevelAuction } = PRETTY_ID_MOCK_RULES
  if (data.level < minLevelAuction) {
    throw new PrettyIdApiError('level_required', `Reach Lv ${minLevelAuction} to join auctions`)
  }
  if (lot.ended) throw new PrettyIdApiError('auction_ended', MESSAGES.auctionEnded)
  if (lot.entered) throw new PrettyIdApiError('already_entered', MESSAGES.alreadyEntered)
  if (data.coins < entryFee) {
    throw new PrettyIdApiError('insufficient_coins', `Not enough coins for the ${formatCoins(entryFee)} entry fee`)
  }
}

export function enterLot(ctx: MockCtx, profile: PrettyIdMockProfile, lotId: number): PrettyIdAuctionActionResult {
  const lot = findLot(ctx, lotId)
  gateEnter(ctx, lot)
  ctx.data.coins -= PRETTY_ID_MOCK_RULES.entryFee
  lot.entered = true
  // The rival bots start rolling one interval after the user joins, not instantly.
  lot.last_rival_roll_at = ctx.now
  return actionResult(ctx, lot, profile)
}

// ========================================
// Bid
// ========================================

/** EXECUTE: record a bid, escrow / refund coins, extend the lot when it lands in the last minute. */
export function executeBid({ data, now }: MockCtx, lot: MockLot, bidder: MockUserRef, amount: number): void {
  const top = lot.bids[0]
  if (top?.user === 'me') data.coins += top.amount
  if (bidder === 'me') data.coins -= amount
  lot.bids.unshift({ user: bidder, amount, at: now })
  data.bid_log.push({ amount, at: now })
  if (lot.ends_at - now < ANTI_SNIPE_MS) lot.ends_at = now + ANTI_SNIPE_MS
}

/** GATE for the user's own bid. Check order is the demo's. */
function gateBid({ data, now }: MockCtx, lot: MockLot, amount: number): void {
  if (lot.ended || now >= lot.ends_at) throw new PrettyIdApiError('auction_ended', MESSAGES.auctionEnded)
  if (!Number.isInteger(amount)) throw new PrettyIdApiError('invalid', MESSAGES.wholeCoins)
  const minimum = minNextBid(lot)
  if (amount < minimum) throw new PrettyIdApiError('bid_too_low', `Minimum bid is ${formatCoins(minimum)}`)
  if (!lot.entered) throw new PrettyIdApiError('entry_required', MESSAGES.entryRequired)
  if (lot.bids[0]?.user === 'me') throw new PrettyIdApiError('already_highest', MESSAGES.alreadyHighest)
  if (data.coins < amount) {
    throw new PrettyIdApiError('insufficient_coins', `Not enough coins (escrow ${formatCoins(amount)})`)
  }
}

export function placeBid(
  ctx: MockCtx,
  profile: PrettyIdMockProfile,
  lotId: number,
  amount: number,
): PrettyIdAuctionActionResult {
  const lot = findLot(ctx, lotId)
  gateBid(ctx, lot, amount)
  executeBid(ctx, lot, 'me', amount)
  return actionResult(ctx, lot, profile)
}

// ========================================
// Winners / weekly
// ========================================

export function winnersFor({ data, now }: MockCtx, profile: PrettyIdMockProfile, month?: string): PrettyIdWinnersResponse {
  const currentMonth = prettyIdMonthKey(now)
  const months = [...new Set([...data.wins.map(win => prettyIdMonthKey(win.at)), currentMonth])].sort().reverse()
  const selected = month && months.includes(month) ? month : currentMonth
  const winners = data.wins
    .filter(win => prettyIdMonthKey(win.at) === selected)
    .sort((a, b) => b.at - a.at)
    .map(win => buildWinner(win, profile))
  return { month: selected, months, winners }
}

/** Coins bid on Pretty IDs in `month`: the seeded baseline plus every bid placed since. */
function monthBidTotal(data: MockData, month: string): number {
  const placed = data.bid_log
    .filter(entry => prettyIdMonthKey(entry.at) === month)
    .reduce((sum, entry) => sum + entry.amount, 0)
  return (data.base_bid[month] ?? 0) + placed
}

export function weeklyFor({ data, now }: MockCtx, profile: PrettyIdMockProfile): PrettyIdWeeklyResponse {
  const month = prettyIdMonthKey(now)
  const allotments = [...data.allotments]
    .sort((a, b) => b.week_start - a.week_start || b.id - a.id)
    .map(allotment => buildAllotment(allotment, profile))
  return { month, total_bid_coins: monthBidTotal(data, month), allotments }
}
