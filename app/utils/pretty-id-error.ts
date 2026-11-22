// ========================================
// Pretty ID — API refusal
// ========================================
//
// The one error type that crosses the Pretty ID API seam (`PrettyIdApi`).
// The mock backend throws it directly; the real client will map HTTP error
// bodies onto it, so composables branch on `code` either way.

import type { PrettyIdErrorCode, PrettyIdItem } from '~/types/pretty-id'

const UNKNOWN_MESSAGE = 'Something went wrong. Please try again.'

export class PrettyIdApiError extends Error {
  readonly code: PrettyIdErrorCode
  /** Free IDs of the same pattern — only populated for `taken`. */
  readonly suggestions: PrettyIdItem[]

  constructor(code: PrettyIdErrorCode, message: string, suggestions: PrettyIdItem[] = []) {
    super(message)
    this.name = 'PrettyIdApiError'
    this.code = code
    this.suggestions = suggestions
  }
}

/** Normalise anything caught at the seam into a `PrettyIdApiError`. */
export function toPrettyIdError(error: unknown): PrettyIdApiError {
  if (error instanceof PrettyIdApiError) return error
  return new PrettyIdApiError('unknown', UNKNOWN_MESSAGE)
}
