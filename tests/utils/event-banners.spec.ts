import { describe, it, expect } from 'vitest'
import { shouldRefreshBannersOnMount, type EventBannersPayload } from '../../app/utils/event-banners'
import type { BannersApiResponse } from '../../app/types/banner'

describe('shouldRefreshBannersOnMount (home-page-runtime-audit/2)', () => {
  const NOW = 1_000_000
  const MAX_AGE = 300_000
  const payloadAt = (fetchedAt?: number): EventBannersPayload =>
    ({ res: { status: 'success', message: 'ok', data: [] } as BannersApiResponse, fetchedAt })

  it('returns false with no payload — the in-flight initial fetch is the freshness', () => {
    expect(shouldRefreshBannersOnMount(null, NOW)).toBe(false)
  })

  it('skips the refresh while the payload is younger than the max age (cold load)', () => {
    expect(shouldRefreshBannersOnMount(payloadAt(NOW - 1), NOW, MAX_AGE)).toBe(false)
    expect(shouldRefreshBannersOnMount(payloadAt(NOW), NOW, MAX_AGE)).toBe(false)
  })

  it('refreshes once the payload reaches the max age (returning to home later)', () => {
    expect(shouldRefreshBannersOnMount(payloadAt(NOW - MAX_AGE), NOW, MAX_AGE)).toBe(true)
    expect(shouldRefreshBannersOnMount(payloadAt(NOW - 3_600_000), NOW, MAX_AGE)).toBe(true)
  })

  it('treats a payload without a fetchedAt tag as stale', () => {
    expect(shouldRefreshBannersOnMount(payloadAt(undefined), NOW, MAX_AGE)).toBe(true)
  })

  it('a clock that went backwards reads as fresh, not stale', () => {
    expect(shouldRefreshBannersOnMount(payloadAt(NOW + 5_000), NOW, MAX_AGE)).toBe(false)
  })
})
