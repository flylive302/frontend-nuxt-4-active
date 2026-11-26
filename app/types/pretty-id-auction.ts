// ========================================
// Pretty ID — Rare Auction API contract (pretty-id-step2 05, view only)
// ========================================
//
// Mirrors `GET /pretty-id/auctions`, `GET /pretty-id/auctions/{id}` and
// `GET /pretty-id/auctions/{id}/me`. All times are ISO-8601 UTC strings with
// milliseconds. `rare_id` is TEXT of up to 8 digits with significant leading
// zeros: never run it through `Number()`.
// ========================================

export type PrettyIdAuctionState = 'upcoming' | 'live' | 'ended' | 'cancelled'

/** One row of the Rare Auction tab. */
export interface PrettyIdAuctionCard {
  id: number
  rare_id: string
  state: PrettyIdAuctionState
  starts_at: string
  /** The ACTUAL end: it moves when a last-minute bid extends the auction. */
  ends_at: string
  entry_fee: number
  opening_bid: number
  keep_days: number
  top_bid: number | null
  bidder_count: number
}

/** `GET /pretty-id/auctions`: already ordered live → upcoming → recently ended. */
export interface PrettyIdAuctionList {
  server_now: string
  auctions: PrettyIdAuctionCard[]
}

export interface PrettyIdAuctionUser {
  id: number
  name: string
  avatar: string | null
  /** The user's Signature text; `null` when it cannot be shown (no profile link then). */
  signature: string | null
}

export interface PrettyIdAuctionBid {
  user: PrettyIdAuctionUser
  amount: number
  placed_at: string
}

export interface PrettyIdAuctionResult {
  winner: PrettyIdAuctionUser | null
  winning_bid: number | null
}

/** `GET /pretty-id/auctions/{id}`: the public snapshot, identical for every viewer. */
export interface PrettyIdAuctionSnapshot {
  id: number
  rare_id: string
  state: PrettyIdAuctionState
  starts_at: string
  planned_ends_at: string
  /** The ACTUAL end (see `PrettyIdAuctionCard.ends_at`). */
  ends_at: string
  entry_fee: number
  opening_bid: number
  min_raise: number
  keep_days: number
  price_floor: number | null
  min_next_bid: number
  leader: PrettyIdAuctionUser | null
  /** Highest first, at most 8. */
  top_bids: PrettyIdAuctionBid[]
  bidder_count: number
  /** Non-null only once `state === 'ended'`. */
  result: PrettyIdAuctionResult | null
  server_now: string
}

/** `GET /pretty-id/auctions/{id}/me`: the viewer's own standing. Fetched on page open, never polled. */
export interface PrettyIdAuctionMe {
  entered: boolean
  disqualified: boolean
  may_bid: boolean
}

/** `POST /pretty-id/auctions/{id}/enter` success: the viewer's new standing, the fee taken and the new coin balance. */
export interface PrettyIdAuctionEnterResult extends PrettyIdAuctionMe {
  fee_paid: number
  /** The user's coin balance after the fee. */
  coins: number
}

/**
 * `POST /pretty-id/auctions/{id}/bid` success: the fresh public snapshot (same shape as
 * `GET /pretty-id/auctions/{id}`, including `server_now`) and the bidder's new coin balance.
 */
export interface PrettyIdAuctionBidResult {
  auction: PrettyIdAuctionSnapshot
  /** The bidder's coin balance after the hold. */
  coins: number
}

/**
 * Why an auction call was refused: a 404 (unknown id, or the auction switch is off), one of the
 * `errors.error_code` refusals of `enter` / `bid`, or anything else.
 */
export type PrettyIdAuctionErrorCode =
  | 'not_found'
  | 'staff_not_allowed'
  | 'disqualified'
  | 'auction_not_live'
  | 'auction_ended'
  | 'already_entered'
  | 'entry_required'
  | 'already_highest'
  | 'bid_too_low'
  | 'invalid'
  | 'insufficient_coins'
  | 'unknown'

/** What the auction page knows about its snapshot. `not_found` and `error` are told apart on purpose. */
export type PrettyIdAuctionLoadStatus = 'loading' | 'ready' | 'not_found' | 'error'

/** How a load of one auction ended. */
export type PrettyIdAuctionLoadOutcome = 'ok' | 'not_found' | 'error'

/** One Rare Auction the viewer won and has not been congratulated on yet (`GET auctions/wins/unseen`). */
export interface PrettyIdAuctionUnseenWin {
  auction_id: number
  rare_id: string
  winning_bid: number
  /** The auction's actual end, not the time the win was settled. */
  won_at: string
  expires_at: string
  keep_days: number
}

/** `POST auctions/wins/{id}/seen`. */
export interface PrettyIdAuctionWinSeenResult {
  auction_id: number
  seen: true
}

// ----------------------------------------
// History pages (pretty-id-step2 12): Big Winners + Weekly Record
// ----------------------------------------
//
// One PKT (Asia/Karachi) month per call; `month` and `months` are `YYYY-MM`.
// `months` lists the months that have finished auctions, newest first, and
// always includes the current one. Cancelled auctions are on neither page.

/**
 * The winner on a history row. `id` is `null` for a winner whose account is gone
 * (the name is then a placeholder): no profile link is drawn.
 */
export interface PrettyIdAuctionHistoryWinner {
  id: number | null
  name: string
  avatar: string | null
  /** What the profile is opened by (`/profile/:signature`); `null` when there is no profile. */
  signature: string | null
}

/** One winning auction on Big Winners. */
export interface PrettyIdAuctionWinnerEntry {
  auction_id: number
  rare_id: string
  winning_bid: number
  /** The auction's actual end. */
  ended_at: string
  winner: PrettyIdAuctionHistoryWinner
}

/** `GET /pretty-id/auctions/winners?month=YYYY-MM`: winners newest first. */
export interface PrettyIdAuctionWinnersBoard {
  month: string
  months: string[]
  winners: PrettyIdAuctionWinnerEntry[]
}

/** One finished auction on the Weekly Record. */
export interface PrettyIdAuctionWeeklyRow {
  auction_id: number
  rare_id: string
  /** `null` = ended with no winner. */
  winner: PrettyIdAuctionHistoryWinner | null
  /** `null` when there is no winner. */
  winning_bid: number | null
  bidder_count: number
  keep_days: number
  ended_at: string
}

/** A Monday-start week clipped to its month; `starts_on` / `ends_on` are PKT dates (`YYYY-MM-DD`). */
export interface PrettyIdAuctionWeeklyWeek {
  starts_on: string
  ends_on: string
  /** Newest first. */
  auctions: PrettyIdAuctionWeeklyRow[]
}

/** `GET /pretty-id/auctions/weekly?month=YYYY-MM`: weeks newest first, empty weeks omitted. */
export interface PrettyIdAuctionWeeklyRecord {
  month: string
  months: string[]
  /** Sum of the month's winning bids (no-winner and cancelled auctions add nothing). */
  total_winning_bids: number
  weeks: PrettyIdAuctionWeeklyWeek[]
}

/** The auction API seam (`usePrettyIdAuctionApi`). Rejects with `PrettyIdAuctionApiError`. */
export interface PrettyIdAuctionApi {
  auctions: () => Promise<PrettyIdAuctionList>
  auction: (id: number) => Promise<PrettyIdAuctionSnapshot>
  auctionMe: (id: number) => Promise<PrettyIdAuctionMe>
  enter: (id: number) => Promise<PrettyIdAuctionEnterResult>
  bid: (id: number, amount: number) => Promise<PrettyIdAuctionBidResult>
  /** Oldest first, usually 0 or 1. A 404 (auction switch off) rejects with `not_found`. */
  unseenWins: () => Promise<PrettyIdAuctionUnseenWin[]>
  /** Idempotent. 404 when the caller is not that auction's winner. */
  markWinSeen: (id: number) => Promise<PrettyIdAuctionWinSeenResult>
  /** Big Winners of a PKT month (`YYYY-MM`); omitted = the current month. */
  winners: (month?: string) => Promise<PrettyIdAuctionWinnersBoard>
  /** Weekly Record of a PKT month (`YYYY-MM`); omitted = the current month. */
  weekly: (month?: string) => Promise<PrettyIdAuctionWeeklyRecord>
}
