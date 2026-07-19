export interface NormalizedError {
  status?: number
  message: string
  fieldErrors?: Record<string, string[]>
  /** Machine-readable code from the backend `errors.error_code` (e.g. EMAIL_NOT_VERIFIED). */
  errorCode?: string
  raw?: unknown
}

/**
 * Coerce the `errors` bag of a 422 into the `Record<string, string[]>` this module
 * claims to return.
 *
 * The backend uses that key for two different things: Laravel's validation bag
 * (`{code: ['Enter the 6-digit code']}`) and `ApiResponse::error()`'s machine-readable
 * envelope (`{error_code: 'INVALID_VERIFICATION_CODE'}` — a bare string). The old code
 * cast the payload to the array shape and trusted it, so the second form crashed on
 * `.find` and took the whole submit down with it (Sentry JAVASCRIPT-VUE-5B: a mistyped
 * OTP threw instead of showing "Invalid or expired verification code").
 *
 * Anything that is not an array of usable strings is dropped rather than coerced: it
 * names no form field, so passing it on would only make `setErrors` target an input
 * that does not exist. Returns undefined when nothing survives, so callers can keep
 * using a simple truthiness check.
 */
function normalizeFieldErrors(errors: unknown): Record<string, string[]> | undefined {
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return undefined

  const normalized: Record<string, string[]> = {}

  for (const [field, messages] of Object.entries(errors as Record<string, unknown>)) {
    if (!Array.isArray(messages)) continue

    const usable = messages.filter(
      (message): message is string => typeof message === 'string' && message.trim().length > 0,
    )
    if (usable.length > 0) normalized[field] = usable
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

/**
 * First message of the first field, or `fallback` when there are no field errors.
 * `normalizeFieldErrors` guarantees every retained field has at least one non-blank
 * string, so no per-field fallback is needed here.
 */
function firstValidationMessage(
  fieldErrors: Record<string, string[]> | undefined,
  fallback: string,
): string {
  const first = fieldErrors && Object.values(fieldErrors)[0]?.[0]

  return first ?? fallback
}

export function normalizeFetchError(error: unknown): NormalizedError {
  const e = error as Record<string, unknown> & { name?: string; message?: string }
  const response = e?.response as { status?: number; _data?: unknown } | undefined
  const status: number | undefined = response?.status
  const data = response?._data ?? (e?.data as Record<string, unknown> | undefined)

  if (e?.name === 'AbortError') {
    return { status, message: 'Request was cancelled.', raw: error }
  }

  if (status === 422 && data && typeof data === 'object') {
    const d = data as { errors?: unknown; message?: string }
    const fieldErrors = normalizeFieldErrors(d.errors)
    const fallback = d.message && d.message !== 'Validation failed'
      ? d.message
      : 'Please check your profile details and try again.'
    const message = firstValidationMessage(fieldErrors, fallback)
    return { status, message, fieldErrors, raw: error }
  }

  if (status) {
    const d = data as { message?: string; error?: string; errors?: { error_code?: string } } | undefined
    const message: string = d?.message || d?.error || e?.message || 'Request failed.'
    return { status, message, errorCode: d?.errors?.error_code, raw: error }
  }

  return { message: 'Network error. Check your connection.', raw: error }
}
