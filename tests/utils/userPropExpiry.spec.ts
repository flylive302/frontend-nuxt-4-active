import { describe, it, expect } from 'vitest'
import { formatUserPropExpiryLabel, userPropExpiryColorClass } from '../../app/utils/userPropExpiry'

const permanent = { expires_at: null, days_remaining: null, is_valid: true }
const dated = (days: number) => ({ expires_at: '2026-12-01T00:00:00+00:00', days_remaining: days, is_valid: true })

describe('formatUserPropExpiryLabel', () => {
  it('reads "Permanent" for a permanent active row (ADR 0051)', () => {
    expect(formatUserPropExpiryLabel(permanent)).toBe('Permanent')
  })

  it('reads "Expired" for a permanent row that is no longer valid', () => {
    expect(formatUserPropExpiryLabel({ ...permanent, is_valid: false })).toBe('Expired')
  })

  it('reads "Expired" for an invalid dated row', () => {
    expect(formatUserPropExpiryLabel({ ...dated(0), is_valid: false })).toBe('Expired')
  })

  it('reads "Expires today" at 0 days', () => {
    expect(formatUserPropExpiryLabel(dated(0))).toBe('Expires today')
  })

  it('reads "1 day left" at 1 day', () => {
    expect(formatUserPropExpiryLabel(dated(1))).toBe('1 day left')
  })

  it('reads "N days left" otherwise', () => {
    expect(formatUserPropExpiryLabel(dated(12))).toBe('12 days left')
  })
})

describe('userPropExpiryColorClass', () => {
  it('is muted for a permanent row, never warning', () => {
    expect(userPropExpiryColorClass(permanent)).toBe('text-muted')
  })

  it('is error for an invalid row', () => {
    expect(userPropExpiryColorClass({ ...permanent, is_valid: false })).toBe('text-error')
  })

  it('is warning within 3 days', () => {
    expect(userPropExpiryColorClass(dated(3))).toBe('text-warning')
  })

  it('is muted with plenty of time left', () => {
    expect(userPropExpiryColorClass(dated(10))).toBe('text-muted')
  })
})
