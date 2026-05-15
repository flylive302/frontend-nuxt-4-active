export interface NormalizedError {
  status?: number
  message: string
  fieldErrors?: Record<string, string[]>
  raw?: unknown
}

function humanizeFieldName(field: string): string {
  return field
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function firstValidationMessage(
  fieldErrors: Record<string, string[]> | undefined,
  fallback: string,
): string {
  if (!fieldErrors) return fallback

  for (const [field, messages] of Object.entries(fieldErrors)) {
    const first = messages.find((message) => typeof message === 'string' && message.trim().length > 0)
    if (first) return first

    if (messages.length > 0) {
      return `${humanizeFieldName(field)} is invalid.`
    }
  }

  return fallback
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
    const d = data as { errors?: Record<string, string[]>; message?: string }
    const fieldErrors = d.errors
    const fallback = d.message && d.message !== 'Validation failed'
      ? d.message
      : 'Please check your profile details and try again.'
    const message = firstValidationMessage(fieldErrors, fallback)
    return { status, message, fieldErrors, raw: error }
  }

  if (status) {
    const d = data as { message?: string; error?: string } | undefined
    const message: string = d?.message || d?.error || e?.message || 'Request failed.'
    return { status, message, raw: error }
  }

  return { message: 'Network error. Check your connection.', raw: error }
}
