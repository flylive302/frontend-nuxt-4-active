// ========================================
// Pretty ID — Rare Auction API refusal
// ========================================
//
// The one error type that crosses the auction seam (`PrettyIdAuctionApi`).
// An HTTP 404 (unknown id, or the auction switch is off) maps to `not_found`;
// the contract gives no `error_code` on it, so the STATUS decides. Everything
// else is `unknown`. Separate from `PrettyIdApiError` so the Step 1 claim flow
// keeps its own, narrower code type.

import type { PrettyIdAuctionErrorCode } from '~/types/pretty-id-auction'
import { normalizeFetchError } from '~/utils/api/normalizeFetchError'

const NOT_FOUND_STATUS = 404
const UNKNOWN_MESSAGE = 'Something went wrong. Please try again.'
const NOT_FOUND_MESSAGE = 'This auction was not found.'

export class PrettyIdAuctionApiError extends Error {
  readonly code: PrettyIdAuctionErrorCode

  constructor(code: PrettyIdAuctionErrorCode, message: string = code === 'not_found' ? NOT_FOUND_MESSAGE : UNKNOWN_MESSAGE) {
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

  // No HTTP status = the request never got an answer: "Check your connection" is more useful than the generic line.
  return new PrettyIdAuctionApiError('unknown', normalized.status === undefined ? normalized.message : UNKNOWN_MESSAGE)
}
