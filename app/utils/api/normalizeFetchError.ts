export interface NormalizedError {
  status?: number
  message: string
  fieldErrors?: Record<string, string[]>
  /** Machine-readable code from the backend `errors.error_code` (e.g. EMAIL_NOT_VERIFIED). */
  errorCode?: string
  /**
   * `ApiResponse::error()`'s `meta` bag verbatim (timestamp/correlation_id plus
   * whatever the endpoint merges in — e.g. IAP verify/restore's `finish`,
   * `outcome`, `purchase`, `balance`). `data` is null on an error response, so
   * this is the ONLY place those extra fields live — read it instead of
   * digging through `raw`.
   */
  meta?: Record<string, unknown>
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

/** `data.meta` when it's a usable object, else undefined. */
function extractMeta(data: unknown): Record<string, unknown> | undefined {
  const meta = (data as { meta?: unknown } | undefined)?.meta
  return meta && typeof meta === 'object' && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : undefined
}

export function normalizeFetchError(error: unknown): NormalizedError {
  const e = error as Record<string, unknown> & { name?: string; message?: string }
  const response = e?.response as { status?: number; _data?: unknown } | undefined
  const status: number | undefined = response?.status
  const data = response?._data ?? (e?.data as Record<string, unknown> | undefined)
  const meta = extractMeta(data)

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
    return { status, message, fieldErrors, meta, raw: error }
  }

  if (status) {
    const d = data as { message?: string; error?: string; errors?: { error_code?: string } } | undefined
    const message: string = d?.message || d?.error || e?.message || 'Request failed.'
    return { status, message, errorCode: d?.errors?.error_code, meta, raw: error }
  }

  return { message: 'Network error. Check your connection.', raw: error }
}
