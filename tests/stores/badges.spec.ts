import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'
import type { UserBadge } from '../../app/types/progression/badge'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

beforeEach(() => {
  setActivePinia(createPinia())
})

// ========================================
// Fixtures
// ========================================

function makeUserBadge(
  id: number,
  badgeId: number,
  overrides: Partial<Pick<UserBadge, 'status' | 'active_count' | 'expires_at' | 'days_remaining'>> = {},
): UserBadge {
  return {
    id,
    badge: { id: badgeId, name: `Badge ${badgeId}`, description: '', image_url: `https://cdn/b${badgeId}.png` },
    earned_at: '2024-01-01T00:00:00Z',
    source_type: 'achievement',
    status: 'active',
    active_count: 1,
    expires_at: null,
    days_remaining: null,
    ...overrides,
  }
}

// ========================================
// validUserBadges / totalActiveBadgeCount
// ========================================

describe('useBadgesStore — validity derivations', () => {
  it('validUserBadges excludes expired entries', async () => {
    const { useBadgesStore } = await import('../../app/stores/badges')
    const store = useBadgesStore()

    store.setUserBadges([
      makeUserBadge(1, 10, { status: 'active' }),
      makeUserBadge(2, 20, { status: 'expired', active_count: 0 }),
    ])

    expect(store.validUserBadges).toHaveLength(1)
    expect(store.validUserBadges[0]!.badge.id).toBe(10)
  })

  it('totalActiveBadgeCount sums active_count only across valid badges', async () => {
    const { useBadgesStore } = await import('../../app/stores/badges')
    const store = useBadgesStore()

    store.setUserBadges([
      makeUserBadge(1, 10, { status: 'active', active_count: 2 }),
      makeUserBadge(2, 20, { status: 'active', active_count: 3 }),
      makeUserBadge(3, 30, { status: 'expired', active_count: 0 }),
    ])

    expect(store.totalActiveBadgeCount).toBe(5)
  })

  it('totalActiveBadgeCount is 0 when there are no user badges', async () => {
    const { useBadgesStore } = await import('../../app/stores/badges')
    const store = useBadgesStore()

    expect(store.totalActiveBadgeCount).toBe(0)
  })
})

// ========================================
// isUserBadgeValid
// ========================================

describe('useBadgesStore.isUserBadgeValid', () => {
  it('returns true for an owned, active badge', async () => {
    const { useBadgesStore } = await import('../../app/stores/badges')
    const store = useBadgesStore()

    store.setUserBadges([makeUserBadge(1, 10, { status: 'active' })])

    expect(store.isUserBadgeValid(10)).toBe(true)
  })

  it('returns false for an owned but expired badge', async () => {
    const { useBadgesStore } = await import('../../app/stores/badges')
    const store = useBadgesStore()

    store.setUserBadges([makeUserBadge(1, 10, { status: 'expired', active_count: 0 })])

    expect(store.isUserBadgeValid(10)).toBe(false)
  })

  it('returns false for a badge the user does not own', async () => {
    const { useBadgesStore } = await import('../../app/stores/badges')
    const store = useBadgesStore()

    store.setUserBadges([makeUserBadge(1, 10, { status: 'active' })])

    expect(store.isUserBadgeValid(999)).toBe(false)
  })
})

// ========================================
// getActiveCount
// ========================================

describe('useBadgesStore.getActiveCount', () => {
  it('returns active_count for an owned badge', async () => {
    const { useBadgesStore } = await import('../../app/stores/badges')
    const store = useBadgesStore()

    store.setUserBadges([makeUserBadge(1, 10, { status: 'active', active_count: 4 })])

    expect(store.getActiveCount(10)).toBe(4)
  })

  it('returns 0 for a badge the user does not own', async () => {
    const { useBadgesStore } = await import('../../app/stores/badges')
    const store = useBadgesStore()

    expect(store.getActiveCount(999)).toBe(0)
  })
})
