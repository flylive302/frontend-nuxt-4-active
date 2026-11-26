// ========================================
// Pretty ID — Rare Auction pure helpers
// ========================================
//
// No Vue, no stores. The polling cadence rule lives here so it can be tested
// without timers: callers pass SERVER time (`Date.now() + clockOffsetMs`).

import {
  PRETTY_ID_AUCTION_FAST_WINDOW_MS,
  PRETTY_ID_AUCTION_POLL_FAST_MS,
  PRETTY_ID_AUCTION_POLL_SLOW_MS,
  PRETTY_ID_AUCTION_START_SLACK_MS,
} from '~/constants/pretty-id-auction'
import { PRETTY_ID_ROUTES } from '~/constants/pretty-id'
import type { PrettyIdAuctionCard, PrettyIdAuctionState } from '~/types/pretty-id-auction'

export interface PrettyIdAuctionTiming {
  state: PrettyIdAuctionState
  starts_at: string
  /** The ACTUAL end. */
  ends_at: string
}

/** The auction id in a `/pretty-id/auction/:id` URL segment, or `null` when it is not plain digits. */
export function parsePrettyIdAuctionId(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) ? id : null
}

/** The page of one auction. */
export function prettyIdAuctionRoute(id: number): string {
  return `${PRETTY_ID_ROUTES.auction}/${id}`
}

/**
 * `clockOffsetMs` for a response stamped `serverNowIso`, or `null` when the
 * stamp is not a date (the caller then keeps the offset it has).
 */
export function prettyIdClockOffset(serverNowIso: string, deviceNowMs: number): number | null {
  const server = Date.parse(serverNowIso)
  return Number.isNaN(server) ? null : server - deviceNowMs
}

/**
 * Delay before the next auction-page fetch, or `null` once the auction is
 * terminal (ended / cancelled) and polling should stop.
 *
 * - live: 3 s while less than an hour remains to the ACTUAL end (this includes
 *   already past it, awaiting settlement, and it stays 3 s through extensions
 *   because `ends_at` is the moving end); otherwise 60 s.
 * - upcoming: the time to the start plus a second, at most 60 s, at least 3 s.
 */
export function nextPrettyIdAuctionPollDelayMs(timing: PrettyIdAuctionTiming, serverNowMs: number): number | null {
  if (timing.state === 'ended' || timing.state === 'cancelled') return null

  if (timing.state === 'live') {
    const remaining = Date.parse(timing.ends_at) - serverNowMs
    return remaining < PRETTY_ID_AUCTION_FAST_WINDOW_MS ? PRETTY_ID_AUCTION_POLL_FAST_MS : PRETTY_ID_AUCTION_POLL_SLOW_MS
  }

  const untilStart = Date.parse(timing.starts_at) - serverNowMs + PRETTY_ID_AUCTION_START_SLACK_MS
  if (Number.isNaN(untilStart)) return PRETTY_ID_AUCTION_POLL_SLOW_MS
  return Math.max(PRETTY_ID_AUCTION_POLL_FAST_MS, Math.min(PRETTY_ID_AUCTION_POLL_SLOW_MS, untilStart))
}

export interface PrettyIdAuctionGroups {
  live: PrettyIdAuctionCard[]
  upcoming: PrettyIdAuctionCard[]
  ended: PrettyIdAuctionCard[]
}

/** Splits the tab list by state, keeping the server's order inside each group. Cancelled cards are dropped. */
export function groupPrettyIdAuctions(cards: readonly PrettyIdAuctionCard[]): PrettyIdAuctionGroups {
  return {
    live: cards.filter(card => card.state === 'live'),
    upcoming: cards.filter(card => card.state === 'upcoming'),
    ended: cards.filter(card => card.state === 'ended'),
  }
}

/** Font size (px) for a Rare ID of `rareId.length` characters: shrinks so up to 8 still fit on a phone. */
export function prettyIdRareFontPx(rareId: string, sizes: { max: number; min: number }): number {
  const FULL_SIZE_UP_TO = 3
  const SHRINK_PER_CHAR = 0.1
  const extra = Math.max(0, rareId.length - FULL_SIZE_UP_TO)
  return Math.max(sizes.min, Math.round(sizes.max * (1 - SHRINK_PER_CHAR * extra)))
}

/** A user's profile page, or `null` when they have no Signature to open it by. */
export function prettyIdProfileRoute(signature: string | null): string | null {
  return signature ? `/profile/${encodeURIComponent(signature)}` : null
}
