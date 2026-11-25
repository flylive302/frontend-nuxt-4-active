// ========================================
// Pretty ID event — API contract (Step 1)
// ========================================
//
// Shapes exchanged across the Pretty ID API seam (`PrettyIdApi`, implemented by
// `composables/pretty-id/usePrettyIdApi.ts` over `/pretty-id/*`).
// Wire format is snake_case.
//
// Interfaces only — no runtime code in this file.

// ========================================
// Vocabulary
// ========================================

/** Digit count of a claimable Pretty ID — also the id of its level reward: 6 at Lv 17, 4 at Lv 34. */
export type PrettyIdTier = 6 | 4

/** Pattern category of a number. */
export type PrettyIdCategory = 'lucky' | 'sequence' | 'legend' | 'mirror' | 'couple'

/** Why a `PrettyIdApi` call was refused. Carried by `PrettyIdApiError.code`. */
export type PrettyIdErrorCode =
  | 'level_required'
  | 'already_claimed'
  | 'taken'
  | 'invalid'
  | 'unknown'

// ========================================
// Me
// ========================================

/** The number a user claimed in one tier. */
export interface PrettyIdClaimed {
  signature: string
  category: PrettyIdCategory
  claimed_at: string
}

export interface PrettyIdTierState {
  tier: PrettyIdTier
  required_level: number
  /** `wealth_level >= required_level`. */
  unlocked: boolean
  /** The claimed number, or `null` while unclaimed. */
  claimed: PrettyIdClaimed | null
}

export interface PrettyIdMe {
  wealth_level: number
  /** Tier 6 first. */
  tiers: PrettyIdTierState[]
}

// ========================================
// Browse / search / claim
// ========================================

/** One available number. */
export interface PrettyIdItem {
  signature: string
  category: PrettyIdCategory
}

export interface PrettyIdListQuery {
  tier: PrettyIdTier
  category?: PrettyIdCategory | null
  /** Exact number to look up inside the tier (0 or 1 item back). */
  q?: string
  cursor?: string | null
}

export interface PrettyIdListResponse {
  items: PrettyIdItem[]
  /** Count of every available number matching tier + category, not just `items`. */
  total: number
  next_cursor: string | null
}

export interface PrettyIdClaimResult {
  signature: string
  tier: PrettyIdTier
  category: PrettyIdCategory
  user_prop_id: number
}

// ========================================
// The seam
// ========================================

/**
 * Every Pretty ID server interaction. All methods are async, unwrap the API
 * envelope and reject with a `PrettyIdApiError` (`utils/pretty-id-error.ts`).
 */
export interface PrettyIdApi {
  me(): Promise<PrettyIdMe>
  /** Browse (`tier` + `category`) and exact search (`q`) share this one call. */
  list(query: PrettyIdListQuery): Promise<PrettyIdListResponse>
  /** Rejects `taken`, `level_required`, `already_claimed`, `invalid`. */
  claim(signature: string): Promise<PrettyIdClaimResult>
}

// ========================================
// Client view state (never sent over the wire)
// ========================================

/** What the active tier's panel shows. */
export type PrettyIdTierMode = 'loading' | 'locked' | 'claimed' | 'browse'

/** Outcome of the inline exact search. */
export type PrettyIdSearchStatus = 'idle' | 'searching' | 'available' | 'unavailable' | 'failed'

/** A claim that just succeeded — drives the full-screen celebration overlay. */
export interface PrettyIdCelebration {
  signature: string
  tier: PrettyIdTier
  category: PrettyIdCategory
}

/** The number was taken between pick and confirm — drives the "just taken" modal. */
export interface PrettyIdRaceConflict {
  signature: string
}
