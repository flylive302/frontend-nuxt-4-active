import type { Badge, CatalogBadgeEntry, UserBadge } from '~/types/progression/badge'

/**
 * Assembles the unified badge catalog grid client-side.
 *
 * - Unions catalog badges with user-owned badges (keyed by badge_id).
 *   Owned badges absent from the active catalog are still included.
 * - Groups duplicate ownership: count = times earned, earnedAt = most recent.
 * - Excludes any badge_id currently equipped (full removal, regardless of count).
 * - Sort order: earned badges by earnedAt DESC, then locked badges by id ASC.
 */
export function assembleBadgeCatalog(
  catalog: Badge[],
  userBadges: UserBadge[],
  equippedBadgeIds: number[],
): CatalogBadgeEntry[] {
  // Build union map seeded from catalog
  const map = new Map<number, { badge: Badge; earnedAts: string[] }>()
  for (const badge of catalog) {
    map.set(badge.id, { badge, earnedAts: [] })
  }

  // Merge user-owned badges (may include deactivated badges not in catalog)
  for (const ub of userBadges) {
    const existing = map.get(ub.badge.id)
    if (existing) {
      existing.earnedAts.push(ub.earned_at)
    } else {
      map.set(ub.badge.id, { badge: ub.badge, earnedAts: [ub.earned_at] })
    }
  }

  const equippedSet = new Set(equippedBadgeIds)
  const earned: CatalogBadgeEntry[] = []
  const locked: CatalogBadgeEntry[] = []

  for (const [id, { badge, earnedAts }] of map) {
    if (equippedSet.has(id)) continue

    if (earnedAts.length > 0) {
      const mostRecent = earnedAts.reduce((a, b) => (a > b ? a : b))
      earned.push({ badge, count: earnedAts.length, earnedAt: mostRecent, isLocked: false })
    } else {
      locked.push({ badge, count: 0, earnedAt: null, isLocked: true })
    }
  }

  earned.sort((a, b) => b.earnedAt!.localeCompare(a.earnedAt!))
  locked.sort((a, b) => a.badge.id - b.badge.id)

  return [...earned, ...locked]
}
