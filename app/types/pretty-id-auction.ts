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

/** Why an auction call was refused: a 404 (unknown id, or the auction switch is off) or anything else. */
export type PrettyIdAuctionErrorCode = 'not_found' | 'unknown'

/** What the auction page knows about its snapshot. `not_found` and `error` are told apart on purpose. */
export type PrettyIdAuctionLoadStatus = 'loading' | 'ready' | 'not_found' | 'error'

/** How a load of one auction ended. */
export type PrettyIdAuctionLoadOutcome = 'ok' | 'not_found' | 'error'

/** The auction API seam (`usePrettyIdAuctionApi`). Rejects with `PrettyIdAuctionApiError`. */
export interface PrettyIdAuctionApi {
  auctions: () => Promise<PrettyIdAuctionList>
  auction: (id: number) => Promise<PrettyIdAuctionSnapshot>
  auctionMe: (id: number) => Promise<PrettyIdAuctionMe>
}
