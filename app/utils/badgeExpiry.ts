// ========================================
// Badge Expiry Display Helpers (pure)
// ========================================
// Mirrors app/components/mall/MyPropCard.vue's expiry display conventions.
// status/daysRemaining are STATIC snapshots from the fetch — no live countdown.

import type { BadgeStatus } from '~/types/progression/badge'
import { BADGE_EXPIRY_WARNING_DAYS } from '~/constants/badges'

/**
 * Human-readable expiry label for a badge entry.
 * - status === null (locked / never owned) → '' (no label)
 * - status === 'expired' → 'Expired'
 * - daysRemaining === null (permanent, still active) → '' (no timer label)
 * - daysRemaining <= 0 → 'Expires today'
 * - daysRemaining === 1 → '1 day left'
 * - otherwise → 'N days left'
 */
export function formatBadgeExpiryLabel(status: BadgeStatus | null, daysRemaining: number | null): string {
  if (status === null) return ''
  if (status === 'expired') return 'Expired'
  if (daysRemaining === null) return ''
  if (daysRemaining <= 0) return 'Expires today'
  if (daysRemaining === 1) return '1 day left'
  return `${daysRemaining} days left`
}

/**
 * Text color class for the expiry label — error when expired, warning near expiry,
 * muted otherwise (permanent or plenty of time left).
 */
export function badgeExpiryColorClass(status: BadgeStatus | null, daysRemaining: number | null): string {
  if (status === 'expired') return 'text-error'
  if (daysRemaining !== null && daysRemaining <= BADGE_EXPIRY_WARNING_DAYS) return 'text-warning'
  return 'text-muted'
}
