// ========================================
// Pretty ID — Rare Auction API refusal
// ========================================
//
// The one error type that crosses the auction seam (`PrettyIdAuctionApi`).
// An HTTP 404 (unknown id, or the auction switch is off) maps to `not_found`;
// the contract gives no `error_code` on it, so the STATUS decides. The refusals
// of `enter` carry `errors.error_code` and map by code. Everything else is
// `unknown`. Separate from `PrettyIdApiError` so the Step 1 claim flow keeps its
// own, narrower code type.

import type { PrettyIdAuctionErrorCode } from '~/types/pretty-id-auction'
import { normalizeFetchError } from '~/utils/api/normalizeFetchError'
import { readErrorCode } from '~/utils/api/readErrorCode'

const NOT_FOUND_STATUS = 404
const UNKNOWN_MESSAGE = 'Something went wrong. Please try again.'

const MESSAGES: Record<PrettyIdAuctionErrorCode, string> = {
  not_found: 'This auction was not found.',
  staff_not_allowed: 'Staff accounts can watch but not take part.',
  disqualified: 'You were disqualified from this auction.',
  auction_not_live: 'This auction is not live right now.',
  already_entered: 'You have already entered this auction.',
  insufficient_coins: 'Not enough coins to pay the entry fee.',
  unknown: UNKNOWN_MESSAGE,
}

/** The codes a response's `errors.error_code` may name (`not_found` is decided by status, `unknown` is the fallback). */
const BODY_CODES: readonly PrettyIdAuctionErrorCode[] = [
  'staff_not_allowed',
  'disqualified',
  'auction_not_live',
  'already_entered',
  'insufficient_coins',
]

export class PrettyIdAuctionApiError extends Error {
  readonly code: PrettyIdAuctionErrorCode

  constructor(code: PrettyIdAuctionErrorCode, message: string = MESSAGES[code]) {
    super(message)
    this.name = 'PrettyIdAuctionApiError'
    this.code = code
  }
}

/** Normalise anything caught at the auction seam into a `PrettyIdAuctionApiError`. */
export function toPrettyIdAuctionError(error: unknown): PrettyIdAuctionApiError {
  if (error instanceof PrettyIdAuctionApiError) return error

  const normalized = normalizeFetchError(error)
  if (normalized.status === NOT_FOUND_STATUS) return new PrettyIdAuctionApiError('not_found')

  const rawCode = readErrorCode(normalized)
  const code = BODY_CODES.find(known => known === rawCode)
  if (code) return new PrettyIdAuctionApiError(code)

  // No HTTP status = the request never got an answer: "Check your connection" is more useful than the generic line.
  return new PrettyIdAuctionApiError('unknown', normalized.status === undefined ? normalized.message : UNKNOWN_MESSAGE)
}
