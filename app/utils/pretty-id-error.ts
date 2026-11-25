// ========================================
// Pretty ID — API refusal
// ========================================
//
// The one error type that crosses the Pretty ID API seam (`PrettyIdApi`).
// The seam maps a failed HTTP call onto it, so composables branch on `code`.

import type { PrettyIdErrorCode } from '~/types/pretty-id'
import { normalizeFetchError, type NormalizedError } from '~/utils/api/normalizeFetchError'

const UNKNOWN_MESSAGE = 'Something went wrong. Please try again.'

const KNOWN_CODES: readonly PrettyIdErrorCode[] = ['level_required', 'already_claimed', 'taken', 'invalid']

const MESSAGES: Record<PrettyIdErrorCode, string> = {
  level_required: 'Your level is too low for this Pretty ID.',
  already_claimed: 'You already claimed a Pretty ID for this level.',
  taken: 'That Pretty ID was just taken.',
  invalid: 'That is not a valid Pretty ID.',
  unknown: UNKNOWN_MESSAGE,
}

export class PrettyIdApiError extends Error {
  readonly code: PrettyIdErrorCode

  constructor(code: PrettyIdErrorCode, message: string = MESSAGES[code]) {
    super(message)
    this.name = 'PrettyIdApiError'
    this.code = code
  }
}

/**
 * The machine-readable `errors.error_code` of a failed call. The shared
 * normalizer drops it on 422 (there `errors` is read as a field bag), so the
 * raw response body is the fallback.
 */
function readErrorCode(normalized: NormalizedError): string | undefined {
  if (normalized.errorCode) return normalized.errorCode
  const metaCode = normalized.meta?.error_code
  if (typeof metaCode === 'string') return metaCode
  const body = (normalized.raw as { response?: { _data?: { errors?: { error_code?: unknown } } } } | undefined)
    ?.response?._data
  const bodyCode = body?.errors?.error_code
  return typeof bodyCode === 'string' ? bodyCode : undefined
}

/** Normalise anything caught at the seam into a `PrettyIdApiError`. */
export function toPrettyIdError(error: unknown): PrettyIdApiError {
  if (error instanceof PrettyIdApiError) return error

  const normalized = normalizeFetchError(error)
  const rawCode = readErrorCode(normalized)
  const code = KNOWN_CODES.find(known => known === rawCode)
  if (code) return new PrettyIdApiError(code)

  // No HTTP status = the request never got an answer: "Check your connection" is more useful than the generic line.
  return new PrettyIdApiError('unknown', normalized.status === undefined ? normalized.message : UNKNOWN_MESSAGE)
}
