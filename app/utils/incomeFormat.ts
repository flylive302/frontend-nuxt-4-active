/**
 * Income Formatting Utilities
 *
 * Pure formatting helpers for the run-centric income page (member-income-runs
 * epic). Diamonds are always shown as exact integers with thousands
 * separators — never abbreviated — unlike XP, which uses the existing short
 * formatters in `~/utils/currency`.
 */

// ========================================
// Constants
// ========================================

const DIAMOND_FORMATTER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

const RUN_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

const RUN_MONTH_DAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

const STATUS_BADGE_COLORS = ['info', 'success', 'warning', 'neutral'] as const

// ========================================
// Types
// ========================================

export type IncomeStatusBadgeColor = (typeof STATUS_BADGE_COLORS)[number]

// ========================================
// Helpers
// ========================================

/**
 * Exact diamond figure with thousands separators, e.g. 1234567 -> "1,234,567".
 * Negative values keep their leading minus, e.g. -50 -> "-50".
 */
export function formatDiamondsExact(value: number): string {
  return DIAMOND_FORMATTER.format(value)
}

/**
 * Single run date, e.g. "Sep 1, 2026". Formatted in UTC so the result is
 * deterministic regardless of the runtime's local timezone.
 */
export function formatRunDate(iso: string): string {
  return RUN_DATE_FORMATTER.format(new Date(iso))
}

/**
 * Run date range, e.g. "Sep 1 – Sep 11, 2026" when both dates fall in the
 * same UTC year, or "Dec 28, 2026 – Jan 7, 2027" when they don't.
 */
export function formatRunRange(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear()

  const startLabel = sameYear ? RUN_MONTH_DAY_FORMATTER.format(start) : formatRunDate(startIso)
  const endLabel = formatRunDate(endIso)

  return `${startLabel} – ${endLabel}`
}

/**
 * Maps a backend `status_color` (typed as a plain `string` in `income.ts`)
 * to a known NuxtUI badge color, falling back to `neutral` for anything
 * unrecognized.
 */
export function toStatusBadgeColor(statusColor: string): IncomeStatusBadgeColor {
  return (STATUS_BADGE_COLORS as readonly string[]).includes(statusColor)
    ? (statusColor as IncomeStatusBadgeColor)
    : 'neutral'
}
