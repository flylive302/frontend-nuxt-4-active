import { describe, it, expect } from 'vitest'
import { assembleBadgeCatalog } from '../../app/utils/badgeCatalog'
import type { Badge, UserBadge } from '../../app/types/progression/badge'

// ========================================
// Fixtures
// ========================================

function makeBadge(id: number): Badge {
  return { id, name: `Badge ${id}`, description: `Desc ${id}`, image_url: `https://cdn/badge-${id}.png` }
}

function makeUserBadge(
  id: number,
  badgeId: number,
  earnedAt: string,
  overrides: Partial<Pick<UserBadge, 'status' | 'active_count' | 'expires_at' | 'days_remaining'>> = {},
): UserBadge {
  return {
    id,
    badge: makeBadge(badgeId),
    earned_at: earnedAt,
    source_type: 'achievement',
    status: 'active',
    active_count: 1,
    expires_at: null,
    days_remaining: null,
    ...overrides,
  }
}

// ========================================
// Tests
// ========================================

describe('assembleBadgeCatalog', () => {
  it('returns an empty array when catalog and userBadges are both empty', () => {
    expect(assembleBadgeCatalog([], [], [])).toEqual([])
  })

  it('marks catalog badges not in userBadges as locked', () => {
    const catalog = [makeBadge(1), makeBadge(2)]
    const result = assembleBadgeCatalog(catalog, [], [])

    expect(result).toHaveLength(2)
    expect(result[0]!.isLocked).toBe(true)
    expect(result[0]!.count).toBe(0)
    expect(result[0]!.earnedAt).toBeNull()
  })

  it('marks owned badges as earned (not locked)', () => {
    const catalog = [makeBadge(1)]
    const userBadges = [makeUserBadge(10, 1, '2024-01-01T00:00:00Z')]
    const result = assembleBadgeCatalog(catalog, userBadges, [])

    expect(result).toHaveLength(1)
    expect(result[0]!.isLocked).toBe(false)
    expect(result[0]!.count).toBe(1)
  })

  it('deduplicates: N owned instances of the same badge_id → one entry with count=N', () => {
    const catalog = [makeBadge(5)]
    const userBadges = [
      makeUserBadge(1, 5, '2024-01-01T00:00:00Z'),
      makeUserBadge(2, 5, '2024-03-15T00:00:00Z'),
      makeUserBadge(3, 5, '2024-02-10T00:00:00Z'),
    ]
    const result = assembleBadgeCatalog(catalog, userBadges, [])

    expect(result).toHaveLength(1)
    expect(result[0]!.count).toBe(3)
    expect(result[0]!.isLocked).toBe(false)
  })

  it('earnedAt is the most recent earned_at across all instances', () => {
    const catalog = [makeBadge(5)]
    const userBadges = [
      makeUserBadge(1, 5, '2024-01-01T00:00:00Z'),
      makeUserBadge(2, 5, '2024-03-15T00:00:00Z'),
      makeUserBadge(3, 5, '2024-02-10T00:00:00Z'),
    ]
    const result = assembleBadgeCatalog(catalog, userBadges, [])

    expect(result[0]!.earnedAt).toBe('2024-03-15T00:00:00Z')
  })

  it('sorts earned badges by earnedAt DESC before locked badges', () => {
    const catalog = [makeBadge(1), makeBadge(2), makeBadge(3)]
    const userBadges = [
      makeUserBadge(10, 1, '2024-01-01T00:00:00Z'),
      makeUserBadge(11, 3, '2024-06-01T00:00:00Z'),
    ]
    // badge 2 is locked
    const result = assembleBadgeCatalog(catalog, userBadges, [])

    expect(result[0]!.badge.id).toBe(3) // earnedAt 2024-06-01 > 2024-01-01
    expect(result[1]!.badge.id).toBe(1)
    expect(result[2]!.badge.id).toBe(2) // locked
  })

  it('sorts locked badges by badge.id ASC', () => {
    const catalog = [makeBadge(30), makeBadge(10), makeBadge(20)]
    const result = assembleBadgeCatalog(catalog, [], [])

    expect(result[0]!.badge.id).toBe(10)
    expect(result[1]!.badge.id).toBe(20)
    expect(result[2]!.badge.id).toBe(30)
  })

  it('subtracts equipped badge_ids entirely (regardless of owned count)', () => {
    const catalog = [makeBadge(1), makeBadge(2), makeBadge(3)]
    const userBadges = [
      makeUserBadge(10, 1, '2024-01-01T00:00:00Z'),
      makeUserBadge(11, 1, '2024-02-01T00:00:00Z'), // owned twice
    ]
    const result = assembleBadgeCatalog(catalog, userBadges, [1])

    expect(result.every(e => e.badge.id !== 1)).toBe(true)
    expect(result).toHaveLength(2)
  })

  it('subtracts equipped locked badges too', () => {
    const catalog = [makeBadge(1), makeBadge(2)]
    const result = assembleBadgeCatalog(catalog, [], [2])

    expect(result).toHaveLength(1)
    expect(result[0]!.badge.id).toBe(1)
  })

  it('includes owned badges not present in the active catalog (union edge case)', () => {
    const catalog = [makeBadge(1)]
    const userBadges = [makeUserBadge(99, 99, '2024-05-01T00:00:00Z')] // badge 99 not in catalog
    const result = assembleBadgeCatalog(catalog, userBadges, [])

    expect(result.some(e => e.badge.id === 99)).toBe(true)
    const deactivated = result.find(e => e.badge.id === 99)!
    expect(deactivated.isLocked).toBe(false)
    expect(deactivated.count).toBe(1)
  })

  it('places owned-but-not-in-catalog badges in the earned section (sorted by earnedAt)', () => {
    const catalog = [makeBadge(1)]
    const userBadges = [
      makeUserBadge(10, 1, '2024-01-01T00:00:00Z'),
      makeUserBadge(99, 99, '2024-07-01T00:00:00Z'),
    ]
    const result = assembleBadgeCatalog(catalog, userBadges, [])

    const ids = result.map(e => e.badge.id)
    // badge 99 earned more recently, should appear first in earned section
    expect(ids.indexOf(99)).toBeLessThan(ids.indexOf(1))
  })
})

// ========================================
// status / activeCount / expiresAt / daysRemaining (issue 03)
// ========================================

describe('assembleBadgeCatalog — expiry fields', () => {
  it('propagates active status, active_count, expires_at and days_remaining for a time-limited badge', () => {
    const catalog = [makeBadge(1)]
    const userBadges = [makeUserBadge(10, 1, '2024-01-01T00:00:00Z', {
      status: 'active',
      active_count: 2,
      expires_at: '2024-02-01T00:00:00Z',
      days_remaining: 5,
    })]
    const result = assembleBadgeCatalog(catalog, userBadges, [])

    expect(result[0]!.status).toBe('active')
    expect(result[0]!.activeCount).toBe(2)
    expect(result[0]!.expiresAt).toBe('2024-02-01T00:00:00Z')
    expect(result[0]!.daysRemaining).toBe(5)
  })

  it('permanent badge: status active, expiresAt/daysRemaining null', () => {
    const catalog = [makeBadge(1)]
    const userBadges = [makeUserBadge(10, 1, '2024-01-01T00:00:00Z', {
      status: 'active',
      active_count: 1,
      expires_at: null,
      days_remaining: null,
    })]
    const result = assembleBadgeCatalog(catalog, userBadges, [])

    expect(result[0]!.status).toBe('active')
    expect(result[0]!.expiresAt).toBeNull()
    expect(result[0]!.daysRemaining).toBeNull()
  })

  it('expired badge: status expired, activeCount 0, no expiry fields', () => {
    const catalog = [makeBadge(1)]
    const userBadges = [makeUserBadge(10, 1, '2024-01-01T00:00:00Z', {
      status: 'expired',
      active_count: 0,
      expires_at: null,
      days_remaining: null,
    })]
    const result = assembleBadgeCatalog(catalog, userBadges, [])

    expect(result[0]!.status).toBe('expired')
    expect(result[0]!.activeCount).toBe(0)
    expect(result[0]!.daysRemaining).toBeNull()
  })

  it('locked badges have null status/activeCount 0/null expiry fields', () => {
    const catalog = [makeBadge(1)]
    const result = assembleBadgeCatalog(catalog, [], [])

    expect(result[0]!.status).toBeNull()
    expect(result[0]!.activeCount).toBe(0)
    expect(result[0]!.expiresAt).toBeNull()
    expect(result[0]!.daysRemaining).toBeNull()
  })

  it('picks the soonest-expiring active entry when multiple grant rows are merged', () => {
    const catalog = [makeBadge(5)]
    const userBadges = [
      makeUserBadge(1, 5, '2024-01-01T00:00:00Z', { status: 'active', active_count: 1, expires_at: '2024-03-01T00:00:00Z', days_remaining: 20 }),
      makeUserBadge(2, 5, '2024-01-02T00:00:00Z', { status: 'active', active_count: 1, expires_at: '2024-01-10T00:00:00Z', days_remaining: 3 }),
    ]
    const result = assembleBadgeCatalog(catalog, userBadges, [])

    expect(result[0]!.daysRemaining).toBe(3)
    expect(result[0]!.activeCount).toBe(2)
  })
})
