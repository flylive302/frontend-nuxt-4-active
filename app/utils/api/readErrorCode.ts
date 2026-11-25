import type { NormalizedError } from '~/utils/api/normalizeFetchError'

/**
 * The machine-readable error code of a failed call: `errors.error_code`, or the
 * `meta.error_code` bag. `normalizeFetchError` drops `errors.error_code` on a 422
 * (there `errors` is read as a field bag), so the raw response body is the fallback.
 */
export function readErrorCode(normalized: NormalizedError): string | undefined {
  if (normalized.errorCode) return normalized.errorCode
  const metaCode = normalized.meta?.error_code
  if (typeof metaCode === 'string') return metaCode
  const body = (normalized.raw as { response?: { _data?: { errors?: { error_code?: unknown } } } } | undefined)
    ?.response?._data
  const bodyCode = body?.errors?.error_code
  return typeof bodyCode === 'string' ? bodyCode : undefined
}
