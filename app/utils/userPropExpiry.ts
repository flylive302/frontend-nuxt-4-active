// ========================================
// User Prop Expiry Display Helpers (pure)
// ========================================
// Shared by MyPropCard and MyPropDetailModal (My Props).
// ADR 0051: a signature prop may be permanent — the backend sends
// `expires_at: null`, `days_remaining: null`, `is_valid: true` for it.
// Equip/Unequip is gated on `is_valid` only, so a permanent row keeps both.

import type { UserProp } from '~/types/mall/prop'

type UserPropExpiry = Pick<UserProp, 'expires_at' | 'days_remaining' | 'is_valid'>

/**
 * Human-readable expiry label for an owned prop.
 * - not valid (expired / no longer active) → 'Expired' (checked first, so a
 *   permanent row that left `active` never reads "Permanent" under the EXPIRED overlay)
 * - expires_at === null (permanent) → 'Permanent'
 * - daysRemaining === null → ''
 * - daysRemaining <= 0 → 'Expires today'
 * - daysRemaining === 1 → '1 day left'
 * - otherwise → 'N days left'
 */
export function formatUserPropExpiryLabel(userProp: UserPropExpiry): string {
  if (!userProp.is_valid) return 'Expired'
  if (userProp.expires_at === null) return 'Permanent'

  const days = userProp.days_remaining
  if (days === null) return ''
  if (days <= 0) return 'Expires today'
  if (days === 1) return '1 day left'
  return `${days} days left`
}

/**
 * Text color class for the expiry label — error when expired, warning within
 * 3 days, muted otherwise (permanent or plenty of time left).
 */
export function userPropExpiryColorClass(userProp: UserPropExpiry): string {
  if (!userProp.is_valid) return 'text-error'
  const days = userProp.days_remaining
  if (days !== null && days <= 3) return 'text-warning'
  return 'text-muted'
}
