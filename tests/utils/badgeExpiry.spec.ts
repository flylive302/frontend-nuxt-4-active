import { describe, it, expect } from 'vitest'
import { formatBadgeExpiryLabel, badgeExpiryColorClass } from '../../app/utils/badgeExpiry'

describe('formatBadgeExpiryLabel', () => {
  it('returns empty string for locked (status null)', () => {
    expect(formatBadgeExpiryLabel(null, null)).toBe('')
  })

  it('returns "Expired" for an expired badge, regardless of daysRemaining', () => {
    expect(formatBadgeExpiryLabel('expired', null)).toBe('Expired')
    expect(formatBadgeExpiryLabel('expired', 5)).toBe('Expired')
  })

  it('returns empty string for a permanent active badge (daysRemaining null)', () => {
    expect(formatBadgeExpiryLabel('active', null)).toBe('')
  })

  it('returns "Expires today" when daysRemaining is 0', () => {
    expect(formatBadgeExpiryLabel('active', 0)).toBe('Expires today')
  })

  it('returns "Expires today" when daysRemaining is negative', () => {
    expect(formatBadgeExpiryLabel('active', -1)).toBe('Expires today')
  })

  it('returns "1 day left" for exactly 1 day remaining', () => {
    expect(formatBadgeExpiryLabel('active', 1)).toBe('1 day left')
  })

  it('returns "N days left" for multiple days remaining', () => {
    expect(formatBadgeExpiryLabel('active', 5)).toBe('5 days left')
  })
})

describe('badgeExpiryColorClass', () => {
  it('returns error color for expired', () => {
    expect(badgeExpiryColorClass('expired', null)).toBe('text-error')
  })

  it('returns warning color when daysRemaining is at or below the threshold', () => {
    expect(badgeExpiryColorClass('active', 3)).toBe('text-warning')
    expect(badgeExpiryColorClass('active', 0)).toBe('text-warning')
  })

  it('returns muted color when daysRemaining is above the threshold', () => {
    expect(badgeExpiryColorClass('active', 4)).toBe('text-muted')
  })

  it('returns muted color for permanent badges (daysRemaining null, active)', () => {
    expect(badgeExpiryColorClass('active', null)).toBe('text-muted')
  })
})
