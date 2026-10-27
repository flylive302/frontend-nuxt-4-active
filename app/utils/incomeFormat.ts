/**
 * Income Formatting Utilities
 *
 * Pure formatting helpers for the run-centric income page (member-income-runs
 * epic). Diamonds and Gift coins are always shown as exact integers with
 * thousands separators on the income screens — never abbreviated.
 */

// ========================================
// Constants
// ========================================

const EXACT_INTEGER_FORMATTER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

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

const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 24 * MS_PER_HOUR

/** A run with this much time or less left renders its countdown in the urgent colour. */
export const RUN_URGENT_DAYS_LEFT = 3

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
  return EXACT_INTEGER_FORMATTER.format(value)
}

/**
 * Exact Gift coins figure with thousands separators, e.g. 241000 -> "241,000".
 * Any fraction is truncated, never rounded: 315312.7 -> "315,312".
 */
export function formatGiftCoinsExact(value: number): string {
  return EXACT_INTEGER_FORMATTER.format(Math.trunc(value))
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
 * Time left in an agency run, floored to whole days and hours so the label
 * never over-promises (a run with 2d 23h left reads "2d 23h left", not "3 days").
 *
 * Pure: `nowMs` is injected so callers (and tests) control the clock.
 *
 *   ≥ 1 day   → "2d 5h left"
 *   < 1 day   → "5h left"
 *   < 1 hour  → "Ends soon"
 *   ≤ 0       → "Ended"
 */
export function formatRunTimeLeft(endsAtIso: string, nowMs: number): string {
  const msLeft = new Date(endsAtIso).getTime() - nowMs

  if (!Number.isFinite(msLeft) || msLeft <= 0) return 'Ended'

  const days = Math.floor(msLeft / MS_PER_DAY)
  const hours = Math.floor((msLeft % MS_PER_DAY) / MS_PER_HOUR)

  if (days > 0) return `${days}d ${hours}h left`
  if (hours > 0) return `${hours}h left`
  return 'Ends soon'
}

/**
 * True when `RUN_URGENT_DAYS_LEFT` days or less remain (compared in
 * milliseconds, so 3d 1h is NOT urgent while 3d 0h is). Drives the
 * countdown badge colour. An unparseable date counts as urgent.
 */
export function isRunEndingSoon(endsAtIso: string, nowMs: number): boolean {
  const msLeft = new Date(endsAtIso).getTime() - nowMs
  if (!Number.isFinite(msLeft)) return true
  return msLeft <= RUN_URGENT_DAYS_LEFT * MS_PER_DAY
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
