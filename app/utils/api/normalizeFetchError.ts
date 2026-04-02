export interface NormalizedError {
  status?: number
  message: string
  fieldErrors?: Record<string, string[]>
  raw?: unknown
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
    const message: string = d.message || 'Validation failed'
    return { status, message, fieldErrors, raw: error }
  }

  if (status) {
    const d = data as { message?: string; error?: string } | undefined
    const message: string = d?.message || d?.error || e?.message || 'Request failed.'
    return { status, message, raw: error }
  }

  return { message: 'Network error. Check your connection.', raw: error }
}
