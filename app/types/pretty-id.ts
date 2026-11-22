// ========================================
// Pretty ID event — API contract
// ========================================
//
// Shapes exchanged across the Pretty ID API seam (`PrettyIdApi`, resolved by
// `composables/pretty-id/usePrettyIdApi.ts`). The backend does not exist yet:
// the seam is currently served by `services/prettyIdMockApi.ts` (localStorage),
// and these interfaces are the contract the Laravel API will be built to.
// Wire format is snake_case, timestamps are ISO-8601 strings.
//
// Interfaces only — no runtime code in this file.

// ========================================
// Vocabulary
// ========================================

/** Pattern tier of an ID, strongest first. `standard` is labelled "Classic". */
export type PrettyIdTier = 'legend' | 'couple' | 'lucky' | 'sequence' | 'mirror' | 'repeat' | 'standard'

/** The two level rewards: a 6-digit ID at Lv 17 and a 4-digit ID at Lv 34. */
export type PrettyIdSlotKey = 'lv17' | 'lv34'

/** Digit count of a claimable (non-auction) Pretty ID. */
export type PrettyIdLength = 6 | 4

/** Why a `PrettyIdApi` call was refused. Carried by `PrettyIdApiError.code`. */
export type PrettyIdErrorCode =
  | 'taken'
  | 'level_required'
  | 'already_claimed'
  | 'nothing_to_change'
  | 'no_tokens'
  | 'cooldown'
  | 'already_entered'
  | 'insufficient_coins'
  | 'auction_ended'
  | 'bid_too_low'
  | 'entry_required'
  | 'already_highest'
  | 'not_found'
  | 'invalid'
  | 'unknown'

// ========================================
// Me
// ========================================

export interface PrettyIdUserCard {
  id: number
  name: string
  avatar_url: string | null
}

/** Event rules, server-owned so the client never hardcodes a fee. */
export interface PrettyIdRules {
  entry_fee: number
  opening_bid: number
  min_increment: number
  /** Days a won auction ID stays with the winner. */
  ownership_days: number
  /** Hours between two changes of the same slot. */
  change_cooldown_hours: number
  min_level_auction: number
}

export interface PrettyIdSlot {
  key: PrettyIdSlotKey
  required_level: number
  length: PrettyIdLength
  /** `level >= required_level`. */
  unlocked: boolean
  /** The claimed number, or `null` while unclaimed. */
  id: string | null
  claimed_at: string | null
  change_tokens: number
  /** When the next change is allowed; `null` = allowed now (or nothing claimed). */
  next_change_at: string | null
}

/** A rare 1–2 digit ID won at auction, held for `rules.ownership_days`. */
export interface PrettyIdAuctionHolding {
  id: string
  won_at: string
  expires_at: string
}

export interface PrettyIdMe {
  /** Server clock at response time — the client derives its countdown offset from it. */
  server_now: string
  user: PrettyIdUserCard
  level: number
  coins: number
  slots: Record<PrettyIdSlotKey, PrettyIdSlot>
  auction_ids: PrettyIdAuctionHolding[]
  rules: PrettyIdRules
}

// ========================================
// Choose / search / claim
// ========================================

export interface PrettyIdItem {
  id: string
  tier: PrettyIdTier
}

export interface PrettyIdListQuery {
  length: PrettyIdLength
  tier: PrettyIdTier | null
}

export interface PrettyIdListResponse {
  /** First page only (`PRETTY_ID_LIST_PAGE_SIZE`). */
  items: PrettyIdItem[]
  /** Count of every available ID matching the query, not just `items`. */
  total: number
}

/**
 * - `taken` — owned by someone; `suggestions` holds free IDs of the same pattern.
 * - `reserved` — blocked/system number or still in its release cooldown.
 * - `auction_only` — 1–99, never claimable, only won at auction.
 * - `invalid` — not a well-formed Pretty ID; `message` says why.
 */
export type PrettyIdSearchReason = 'taken' | 'reserved' | 'auction_only' | 'invalid'

export interface PrettyIdSearchResult {
  id: string
  available: boolean
  reason: PrettyIdSearchReason | null
  /** Display-ready explanation for `invalid`; `null` otherwise. */
  message: string | null
  tier: PrettyIdTier | null
  suggestions: PrettyIdItem[]
}

export interface PrettyIdClaimResult {
  id: string
  slot: PrettyIdSlotKey
  /** `true` when an existing claim was swapped (a change token was spent). */
  changed: boolean
  me: PrettyIdMe
}

// ========================================
// Auction
// ========================================

export type PrettyIdLotStatus = 'live' | 'ended'

export interface PrettyIdBid {
  user: PrettyIdUserCard
  amount: number
  at: string
  /** The bid belongs to the requesting user. */
  is_me: boolean
}

export interface PrettyIdLot {
  id: number
  /** The rare ID on offer, e.g. `"7"`. */
  number: string
  status: PrettyIdLotStatus
  starts_at: string
  ends_at: string
  entry_fee: number
  opening_bid: number
  min_increment: number
  highest_bid: number | null
  /** Smallest amount the next bid must reach. */
  min_next_bid: number
  /** The requesting user paid the entry fee. */
  entered: boolean
  you_are_highest: boolean
  /** Set once `status` is `ended` and at least one bid was placed. */
  winner: PrettyIdUserCard | null
  winning_bid: number | null
  /** Highest first. */
  top_bids: PrettyIdBid[]
}

export interface PrettyIdAuctionActionResult {
  auction: PrettyIdLot
  /** The requesting user's balance after the action. */
  coins: number
}

export interface PrettyIdWinner {
  auction_id: number
  user: PrettyIdUserCard
  id_number: string
  winning_bid: number
  won_at: string
}

export interface PrettyIdWinnersResponse {
  /** `YYYY-MM` actually returned. */
  month: string
  /** Every month that can be paged to, newest first. Always includes the current month. */
  months: string[]
  /** Newest first. */
  winners: PrettyIdWinner[]
}

export interface PrettyIdAllotment {
  id: number
  week_start: string
  week_end: string
  id_number: string
  user: PrettyIdUserCard
  signature_text: string | null
}

export interface PrettyIdWeeklyResponse {
  month: string
  total_bid_coins: number
  /** Newest week first. */
  allotments: PrettyIdAllotment[]
}

// ========================================
// The seam
// ========================================

/**
 * Every Pretty ID server interaction. All methods are async and reject with a
 * `PrettyIdApiError` (`utils/pretty-id-error.ts`) on a business refusal.
 */
export interface PrettyIdApi {
  me(): Promise<PrettyIdMe>
  list(query: PrettyIdListQuery): Promise<PrettyIdListResponse>
  search(id: string): Promise<PrettyIdSearchResult>
  /** First claim of a slot. Rejects `taken` (with `suggestions`), `level_required`, `already_claimed`. */
  claim(id: string): Promise<PrettyIdClaimResult>
  /** Swap a claimed slot's ID. Rejects `taken`, `nothing_to_change`, `no_tokens`, `cooldown`. */
  change(id: string, slot: PrettyIdSlotKey): Promise<PrettyIdClaimResult>
  auctions(): Promise<PrettyIdLot[]>
  auction(lotId: number): Promise<PrettyIdLot>
  enter(lotId: number): Promise<PrettyIdAuctionActionResult>
  bid(lotId: number, amount: number): Promise<PrettyIdAuctionActionResult>
  /** `month` is `YYYY-MM`; omitted = the current month. */
  winners(month?: string): Promise<PrettyIdWinnersResponse>
  weekly(): Promise<PrettyIdWeeklyResponse>
}

// ========================================
// Client view state (never sent over the wire)
// ========================================

/** A claim/change that just succeeded — drives the full-screen celebration overlay. */
export interface PrettyIdCelebration {
  id: string
  slot: PrettyIdSlotKey
  changed: boolean
}

/** The ID was taken between pick and confirm — drives the "ID taken" modal. */
export interface PrettyIdRaceConflict {
  id: string
  suggestions: PrettyIdItem[]
}

// ========================================
// Mock-only (deleted with the mock when the real API lands)
// ========================================

/** Identity the mock is seeded with — taken from the signed-in user. */
export interface PrettyIdMockProfile {
  id: number
  name: string
  avatar_url: string | null
}

export interface PrettyIdMockState {
  level: number
  coins: number
  /** Hours the mock clock runs ahead of the device clock. */
  offset_hours: number
  /** The next claim will be "stolen" mid-confirm. */
  race_armed: boolean
}

/** Test levers of the mock backend, driven by the dev panel. Never part of the real API. */
export interface PrettyIdMockControls {
  state(): PrettyIdMockState
  setLevel(level: number): void
  /** Adds `amount` coins; `0` empties the balance. */
  addCoins(amount: number): void
  skipHours(hours: number): void
  /** Returns how many rival bids were placed. */
  rivalBidsNow(): number
  endAllAuctions(): void
  toggleRace(): void
  /** Returns `false` when no slot is claimed yet. */
  addChangeToken(): boolean
  reset(): void
}
