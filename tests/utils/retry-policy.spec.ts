import { describe, it, expect } from 'vitest'
import {
  ROOMS_RETRY_STATUS_CODES,
  getRetryAfterSeconds,
  isRateLimitActive,
  isTooManyRequestsError,
  parseRetryAfterSeconds,
  rateLimitedUntilFromRetryAfter,
  remainingRateLimitSeconds,
  roomsFetchErrorMessage,
} from '../../app/utils/api/retry-policy'

describe('ROOMS_RETRY_STATUS_CODES', () => {
  it('never includes 429 — the one status retrying is definitionally wrong for', () => {
    expect(ROOMS_RETRY_STATUS_CODES).not.toContain(429)
  })

  it('keeps ofetch defaults for genuine transient failures', () => {
    expect([...ROOMS_RETRY_STATUS_CODES].sort()).toEqual([408, 409, 425, 500, 502, 503, 504])
  })
})

describe('parseRetryAfterSeconds', () => {
  it('parses a plain seconds value', () => {
    expect(parseRetryAfterSeconds('30')).toBe(30)
    expect(parseRetryAfterSeconds('0')).toBe(0)
  })

  it('floors a fractional value', () => {
    expect(parseRetryAfterSeconds('12.9')).toBe(12)
  })

  it('is null for absent input', () => {
    expect(parseRetryAfterSeconds(null)).toBeNull()
    expect(parseRetryAfterSeconds(undefined)).toBeNull()
    expect(parseRetryAfterSeconds('')).toBeNull()
    expect(parseRetryAfterSeconds('   ')).toBeNull()
  })

  it('is null for garbage — including the HTTP-date form this does not handle', () => {
    expect(parseRetryAfterSeconds('not-a-number')).toBeNull()
    expect(parseRetryAfterSeconds('Wed, 21 Oct 2026 07:28:00 GMT')).toBeNull()
  })

  it('is null for a negative value', () => {
    expect(parseRetryAfterSeconds('-5')).toBeNull()
  })
})

function fetchError(status: number, retryAfter?: string) {
  return {
    response: {
      status,
      headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' ? retryAfter ?? null : null) },
    },
  }
}

describe('isTooManyRequestsError', () => {
  it('is true only for a 429', () => {
    expect(isTooManyRequestsError(fetchError(429))).toBe(true)
    expect(isTooManyRequestsError(fetchError(500))).toBe(false)
    expect(isTooManyRequestsError(fetchError(200))).toBe(false)
  })

  it('is false for a non-fetch-error value', () => {
    expect(isTooManyRequestsError(undefined)).toBe(false)
    expect(isTooManyRequestsError(new Error('boom'))).toBe(false)
  })
})

describe('getRetryAfterSeconds', () => {
  it('reads the header off a 429', () => {
    expect(getRetryAfterSeconds(fetchError(429, '45'))).toBe(45)
  })

  it('is null when the header is missing', () => {
    expect(getRetryAfterSeconds(fetchError(429))).toBeNull()
  })
})

describe('rateLimitedUntilFromRetryAfter', () => {
  const now = 1_000_000

  it('uses the given seconds', () => {
    expect(rateLimitedUntilFromRetryAfter(20, now)).toBe(now + 20_000)
  })

  it('falls back to a default wait when Retry-After was absent or garbage', () => {
    expect(rateLimitedUntilFromRetryAfter(null, now)).toBe(now + 30_000)
  })

  it('falls back when Retry-After was zero or negative', () => {
    expect(rateLimitedUntilFromRetryAfter(0, now)).toBe(now + 30_000)
  })
})

describe('isRateLimitActive / remainingRateLimitSeconds', () => {
  const now = 1_000_000

  it('is inactive with no rate limit set', () => {
    expect(isRateLimitActive(null, now)).toBe(false)
    expect(remainingRateLimitSeconds(null, now)).toBe(0)
  })

  it('is active before the deadline, inactive after', () => {
    expect(isRateLimitActive(now + 5_000, now)).toBe(true)
    expect(isRateLimitActive(now - 1, now)).toBe(false)
    expect(isRateLimitActive(now, now)).toBe(false)
  })

  it('reports whole seconds remaining, rounded up', () => {
    expect(remainingRateLimitSeconds(now + 5_500, now)).toBe(6)
    expect(remainingRateLimitSeconds(now + 1, now)).toBe(1)
  })

  it('is 0 once the deadline has passed', () => {
    expect(remainingRateLimitSeconds(now - 5_000, now)).toBe(0)
  })
})

describe('roomsFetchErrorMessage', () => {
  it('names the rate limit on a 429, with the countdown', () => {
    expect(roomsFetchErrorMessage(fetchError(429), 12)).toBe('Too many requests — retrying available in 12s')
  })

  it('reads generically on a 429 with no time left to show', () => {
    expect(roomsFetchErrorMessage(fetchError(429), 0)).toBe('Too many requests — please wait a moment and try again.')
  })

  it('is a generic message for any other failure', () => {
    expect(roomsFetchErrorMessage(fetchError(500), 0)).toBe('Something went wrong. Please try again.')
    expect(roomsFetchErrorMessage(new Error('network down'), 0)).toBe('Something went wrong. Please try again.')
  })
})
