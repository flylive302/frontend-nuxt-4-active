// ========================================
// Blocked screen constants (account-bans 03)
// ========================================

import type { BlockErrorCode, BlockKind } from '~/types/user/block'

/** The blocked reply's `meta.error_code` → the kind of block it describes. */
export const BLOCK_ERROR_CODES: Readonly<Record<BlockErrorCode, BlockKind>> = {
  ACCOUNT_BLOCKED: 'account',
  IP_BLOCKED: 'ip',
  DEVICE_BLOCKED: 'device',
}

/** The route a blocked account / IP / device lands on. */
export const BLOCKED_PATH = '/blocked'

/** How often /blocked re-reads the clock, so "Try again" appears once a timed block ends. */
export const BLOCKED_NOW_TICK_MS = 30_000

/** Support contact shown on /blocked. */
export const BLOCKED_SUPPORT_EMAIL = 'support@flylive.app'

/** Where /blocked sends a user who has no block to show (stale bookmark, direct visit). */
export const BLOCKED_FALLBACK_PATH = '/'

export const MS_PER_MINUTE = 60_000
export const MS_PER_HOUR = 60 * MS_PER_MINUTE
export const HOURS_PER_DAY = 24

/** How the block end date is shown to the user ("Nov 3, 2026, 4:30 PM"). */
export const BLOCKED_END_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
}
