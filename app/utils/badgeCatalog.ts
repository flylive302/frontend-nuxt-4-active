import type { Badge, BadgeStatus, CatalogBadgeEntry, UserBadge } from '~/types/progression/badge'

/**
 * Assembles the unified badge catalog grid client-side.
 *
 * - Unions catalog badges with user-owned badges (keyed by badge_id).
 *   Owned badges absent from the active catalog are still included.
 * - Groups duplicate ownership: count = number of merged entries, activeCount = sum of
 *   active_count across them, earnedAt = most recent. Backend now sends one UserBadge
 *   entry per badge, so in practice count/entries.length is 1 — the merge logic stays
 *   defensive for callers that pass multiple raw grant rows.
 * - status = 'active' if any merged entry is active, else 'expired'.
 * - expiresAt/daysRemaining = the soonest-expiring active entry, else null.
 * - Excludes any badge_id currently equipped (full removal, regardless of count).
 * - Sort order: earned badges by earnedAt DESC, then locked badges by id ASC.
 */
export function assembleBadgeCatalog(
  catalog: Badge[],
  userBadges: UserBadge[],
  equippedBadgeIds: number[],
): CatalogBadgeEntry[] {
  // Build union map seeded from catalog
  const map = new Map<number, { badge: Badge; entries: UserBadge[] }>()
  for (const badge of catalog) {
    map.set(badge.id, { badge, entries: [] })
  }

  // Merge user-owned badges (may include deactivated badges not in catalog)
  for (const ub of userBadges) {
    const existing = map.get(ub.badge.id)
    if (existing) {
      existing.entries.push(ub)
    } else {
      map.set(ub.badge.id, { badge: ub.badge, entries: [ub] })
    }
  }

  const equippedSet = new Set(equippedBadgeIds)
  const earned: CatalogBadgeEntry[] = []
  const locked: CatalogBadgeEntry[] = []

  for (const [id, { badge, entries }] of map) {
    if (equippedSet.has(id)) continue

    if (entries.length > 0) {
      const mostRecent = entries.reduce((a, b) => (a.earned_at > b.earned_at ? a : b))
      const activeCount = entries.reduce((sum, e) => sum + e.active_count, 0)
      const status: BadgeStatus = entries.some(e => e.status === 'active') ? 'active' : 'expired'
      const activeEntries = entries.filter(e => e.status === 'active' && e.days_remaining !== null)
      const soonest = activeEntries.length > 0
        ? activeEntries.reduce((a, b) => (a.days_remaining! < b.days_remaining! ? a : b))
        : null

      earned.push({
        badge,
        count: entries.length,
        activeCount,
        status,
        earnedAt: mostRecent.earned_at,
        expiresAt: soonest?.expires_at ?? null,
        daysRemaining: soonest?.days_remaining ?? null,
        isLocked: false,
      })
    } else {
      locked.push({
        badge,
        count: 0,
        activeCount: 0,
        status: null,
        earnedAt: null,
        expiresAt: null,
        daysRemaining: null,
        isLocked: true,
      })
    }
  }

  earned.sort((a, b) => b.earnedAt!.localeCompare(a.earnedAt!))
  locked.sort((a, b) => a.badge.id - b.badge.id)

  return [...earned, ...locked]
}
