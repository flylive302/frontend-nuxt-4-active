/**
 * Retry / rate-limit policy for the rooms feed (home-room-feed/12, /13).
 *
 * Pure functions only — no Vue reactivity, no store imports. `server/api/rooms.get.ts`
 * runs in a Cloudflare Worker and imports `ROOMS_RETRY_STATUS_CODES` from here, so
 * nothing in this file may assume a browser (`window`, `document`, etc.).
 */

/**
 * `ofetch`'s default retry set, minus `429`.
 *
 * `ofetch@1.5.1` retries `[408, 409, 425, 429, 500, 502, 503, 504]` by default for a
 * GET. `429` is the one status where retrying is definitionally wrong — the server is
 * explicitly asking for less traffic, not reporting a transient blip. Pass this to
 * every bare `$fetch`/`ofetch` call site that talks to `/rooms`, so the built-in retry
 * keeps working for 5xx and stops touching 429.
 */
export const ROOMS_RETRY_STATUS_CODES = [408, 409, 425, 500, 502, 503, 504] as const

/** The shape both a browser `ofetch` error and a Worker-side one carry. */
interface FetchErrorLike {
  response?: {
    status?: number
    headers?: { get?: (name: string) => string | null | undefined }
  }
}

/**
 * Parses the `Retry-After` header's seconds form (`Retry-After: 30`).
 *
 * The HTTP-date form (`Retry-After: Wed, 21 Oct query...`) is not handled — the
 * backend only ever sends seconds (`ApiErrorResponder.php:159-172`), and guessing at
 * a date format we don't emit would only add a silent failure mode. Anything absent,
 * blank, non-numeric, or negative resolves to `null` so callers fall back explicitly
 * rather than blocking on a garbage value.
 */
export function parseRetryAfterSeconds(value: string | null | undefined): number | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const seconds = Number(trimmed)
  if (!Number.isFinite(seconds) || seconds < 0) return null

  return Math.floor(seconds)
}

/** True when `error` is the `ofetch`/`$fetch` shape for an HTTP 429. */
export function isTooManyRequestsError(error: unknown): boolean {
  const e = error as FetchErrorLike | undefined
  return e?.response?.status === 429
}

/** Reads and parses the `Retry-After` header off an `ofetch`/`$fetch` error, if present. */
export function getRetryAfterSeconds(error: unknown): number | null {
  const e = error as FetchErrorLike | undefined
  const headers = e?.response?.headers
  const raw = headers?.get?.('retry-after') ?? headers?.get?.('Retry-After')
  return parseRetryAfterSeconds(raw ?? null)
}

/** Used when a 429 arrives with no (or an unparsable) `Retry-After`. */
const DEFAULT_RATE_LIMIT_WAIT_SECONDS = 30

/**
 * The timestamp (ms epoch) rooms requests should stay blocked until, given a 429's
 * `Retry-After` seconds (or `null` if it was absent/garbage).
 */
export function rateLimitedUntilFromRetryAfter(
  retryAfterSeconds: number | null,
  now: number = Date.now(),
): number {
  const seconds = retryAfterSeconds && retryAfterSeconds > 0 ? retryAfterSeconds : DEFAULT_RATE_LIMIT_WAIT_SECONDS
  return now + seconds * 1000
}

/** Whether rooms requests are still blocked by an earlier 429. */
export function isRateLimitActive(rateLimitedUntil: number | null, now: number = Date.now()): boolean {
  return typeof rateLimitedUntil === 'number' && rateLimitedUntil > now
}

/** Seconds left until a rooms request may be sent again, floored at 0. */
export function remainingRateLimitSeconds(rateLimitedUntil: number | null, now: number = Date.now()): number {
  if (!isRateLimitActive(rateLimitedUntil, now)) return 0
  return Math.ceil((rateLimitedUntil! - now) / 1000)
}

/**
 * User-facing copy for a failed rooms fetch. A 429 reads very differently from a
 * generic failure — "we are throttled, wait Ns" is actionable in a way "something
 * broke" is not.
 */
export function roomsFetchErrorMessage(error: unknown, retryAfterSeconds: number): string {
  if (isTooManyRequestsError(error)) {
    return retryAfterSeconds > 0
      ? `Too many requests — retrying available in ${retryAfterSeconds}s`
      : 'Too many requests — please wait a moment and try again.'
  }
  return 'Something went wrong. Please try again.'
}
