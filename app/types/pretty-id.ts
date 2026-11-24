// ========================================
// Pretty ID event — API contract
// ========================================
//
// Shapes exchanged across the Pretty ID API seam (`PrettyIdApi`, resolved by
// `composables/pretty-id/usePrettyIdApi.ts`). The Choose tab (list, search,
// claim) is still served by `services/prettyIdMockApi.ts` (localStorage) until
// the real API replaces it. The auction and My ID features are removed.
// Wire format is snake_case.
//
// Interfaces only — no runtime code in this file.

// ========================================
// Vocabulary
// ========================================

/** Pattern tier of an ID, strongest first. `standard` is labelled "Classic". */
export type PrettyIdTier = 'legend' | 'couple' | 'lucky' | 'sequence' | 'mirror' | 'repeat' | 'standard'

/** The two level rewards: a 6-digit ID at Lv 17 and a 4-digit ID at Lv 34. */
export type PrettyIdSlotKey = 'lv17' | 'lv34'

/** Digit count of a claimable Pretty ID. */
export type PrettyIdLength = 6 | 4

/** Why a `PrettyIdApi` call was refused. Carried by `PrettyIdApiError.code`. */
export type PrettyIdErrorCode =
  | 'taken'
  | 'level_required'
  | 'already_claimed'
  | 'invalid'
  | 'unknown'

// ========================================
// Me
// ========================================

export interface PrettyIdSlot {
  key: PrettyIdSlotKey
  required_level: number
  length: PrettyIdLength
  /** `level >= required_level`. */
  unlocked: boolean
  /** The claimed number, or `null` while unclaimed. */
  id: string | null
}

export interface PrettyIdMe {
  /** Server clock at response time. */
  server_now: string
  level: number
  slots: Record<PrettyIdSlotKey, PrettyIdSlot>
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
 * - `reserved` — blocked/system number.
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
  me: PrettyIdMe
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
  /** Rejects `taken` (with `suggestions`), `level_required`, `already_claimed`. */
  claim(id: string): Promise<PrettyIdClaimResult>
}

// ========================================
// Client view state (never sent over the wire)
// ========================================

/** A claim that just succeeded — drives the full-screen celebration overlay. */
export interface PrettyIdCelebration {
  id: string
  slot: PrettyIdSlotKey
}

/** The ID was taken between pick and confirm — drives the "ID taken" modal. */
export interface PrettyIdRaceConflict {
  id: string
  suggestions: PrettyIdItem[]
}

// ========================================
// Mock-only (deleted with the mock when the real API lands)
// ========================================

/** Identity the mock is seeded for — taken from the signed-in user. */
export interface PrettyIdMockProfile {
  id: number
}
