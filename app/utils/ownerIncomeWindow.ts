/**
 * Owner Income Window Utilities
 *
 * Pure helpers shared by the owner-income store, its actions composable and
 * the Custom dates picker (agency-member-income-runs epic, Phase 2). A
 * reporting window is either one "Run N" preset or a custom range of UTC
 * calendar days; these functions turn a selection into the cache key, the
 * request URL and the display label, and validate a range against the bounds
 * the API published.
 *
 * Names are deliberately `ownerIncome…`-prefixed: `app/utils/` is
 * auto-imported app-wide, and a generic name here can silently shadow a
 * same-named export elsewhere.
 *
 * Everything is string/UTC arithmetic — no `Date.now()`, no local timezone.
 * `YYYY-MM-DD` compares lexicographically in calendar order, so ordering and
 * bounds are plain string comparisons; only the span needs real date math.
 */

import type {
  OwnerIncomeRangeLimits,
  OwnerIncomeWindowSelection,
} from '~/types/income/ownerIncome'

// ========================================
// Constants
// ========================================

const API_BASE = '/user/agency/income'

/** `YYYY-MM-DD`, the only day format the range endpoints accept. */
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const MS_PER_DAY = 86_400_000

/**
 * Days the picker pre-fills when no range has been chosen yet. Deliberately
 * NOT the full `min_day … max_day` span — that is the whole programme and is
 * normally wider than `max_span_days`, so it would open the picker already
 * invalid with Apply disabled.
 */
const DEFAULT_RANGE_DAYS = 30

/**
 * Matches the server's `format('M')` so a locally built label is identical to
 * the one the API sends back on `window.label` — no flicker when the summary
 * lands and replaces it.
 */
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** The en dash + spaces the server's range label uses. */
const RANGE_SEPARATOR = ' – '

// ========================================
// Types
// ========================================

/** A range that may be shown to the API, or the reason it may not. */
export type OwnerIncomeRangeCheck = { valid: true } | { valid: false; message: string }

// ========================================
// Helpers
// ========================================

export function isOwnerIncomeDay(value: string): boolean {
  return DAY_PATTERN.test(value)
}

/** Midnight UTC for a `YYYY-MM-DD` day, or `NaN` for anything else. */
function dayToUtcMs(day: string): number {
  if (!isOwnerIncomeDay(day)) return Number.NaN

  const year = Number(day.slice(0, 4))
  const month = Number(day.slice(5, 7))
  const date = Number(day.slice(8, 10))

  return Date.UTC(year, month - 1, date)
}

/**
 * Days covered by `[from, to]` counting BOTH ends — the same span the API's
 * 422 measures, so `from === to` is 1, not 0. `NaN` when either day is
 * malformed.
 */
export function ownerIncomeRangeSpanDays(from: string, to: string): number {
  const fromMs = dayToUtcMs(from)
  const toMs = dayToUtcMs(to)

  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return Number.NaN

  return Math.round((toMs - fromMs) / MS_PER_DAY) + 1
}

/** `YYYY-MM-DD` for a UTC millisecond instant. */
function utcMsToDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** `day` moved by `deltaDays` UTC days. Returns the input unchanged if it is not a day. */
export function shiftOwnerIncomeDay(day: string, deltaDays: number): string {
  const ms = dayToUtcMs(day)

  if (Number.isNaN(ms)) return day

  return utcMsToDay(ms + deltaDays * MS_PER_DAY)
}

/** "2026-09-01" → "1 Sep 2026". Returns the input unchanged if it is not a day. */
export function ownerIncomeDayLabel(day: string): string {
  if (!isOwnerIncomeDay(day)) return day

  const month = SHORT_MONTHS[Number(day.slice(5, 7)) - 1] ?? day.slice(5, 7)

  return `${Number(day.slice(8, 10))} ${month} ${day.slice(0, 4)}`
}

/** "2026-09-01", "2026-09-15" → "1 Sep – 15 Sep", byte-for-byte the server's `window.label`. */
export function ownerIncomeRangeLabel(from: string, to: string): string {
  const short = (day: string): string => {
    if (!isOwnerIncomeDay(day)) return day
    const month = SHORT_MONTHS[Number(day.slice(5, 7)) - 1] ?? day.slice(5, 7)

    return `${Number(day.slice(8, 10))} ${month}`
  }

  return `${short(from)}${RANGE_SEPARATOR}${short(to)}`
}

// ========================================
// Window identity
// ========================================

/**
 * The cache key for a selection: `run:5` or `range:2026-09-01|2026-09-15`.
 * Mirrors the backend's `IncomeWindow::key()`. Always built from the
 * SELECTION, never from a response's `window.from`/`to` — those are ISO 8601
 * instants, not calendar days.
 */
export function ownerIncomeWindowKey(selection: OwnerIncomeWindowSelection): string {
  return selection.kind === 'run'
    ? `run:${selection.number}`
    : `range:${selection.from}|${selection.to}`
}

/** The sheet cache key for one member inside one window. */
export function ownerIncomeSheetKey(windowKey: string, userId: number): string {
  return `${windowKey}:${userId}`
}

/**
 * The endpoint for a selection. `suffix` is appended to the family root, e.g.
 * `''`, `'/members'`, `'/members/42'`:
 *
 *   run    → `/user/agency/income/cycles/5/members`
 *   range  → `/user/agency/income/range/members` + `?from&to`
 */
export function ownerIncomeWindowEndpoint(
  selection: OwnerIncomeWindowSelection,
  suffix = ''
): { url: string; query: Record<string, string> } {
  if (selection.kind === 'run') {
    return { url: `${API_BASE}/cycles/${selection.number}${suffix}`, query: {} }
  }

  return { url: `${API_BASE}/range${suffix}`, query: { from: selection.from, to: selection.to } }
}

// ========================================
// Range validation (GATE)
// ========================================

/**
 * The client half of the API's range rules, checked against the limits the
 * overview published — never against a locally computed "today". The device's
 * calendar day runs ahead of UTC for part of the day (UTC midnight is 05:00
 * PKT), so a local `new Date()` would offer a day the server answers 422 for.
 *
 * Rules, in the order the messages read best:
 *   both days present → well formed → from ≤ to → from ≥ min_day →
 *   to ≤ max_day → span ≤ max_span_days (both ends counted).
 */
export function checkOwnerIncomeRange(
  from: string,
  to: string,
  limits: OwnerIncomeRangeLimits | null
): OwnerIncomeRangeCheck {
  if (from === '' || to === '') {
    return { valid: false, message: 'Pick a start and an end date.' }
  }

  if (!isOwnerIncomeDay(from) || !isOwnerIncomeDay(to)) {
    return { valid: false, message: 'Those dates are not valid.' }
  }

  if (limits === null) {
    return { valid: false, message: 'Custom dates are not available right now.' }
  }

  if (from > to) {
    return { valid: false, message: 'The start date must be on or before the end date.' }
  }

  if (from < limits.min_day) {
    return { valid: false, message: `Start date cannot be before ${ownerIncomeDayLabel(limits.min_day)}.` }
  }

  if (to > limits.max_day) {
    return { valid: false, message: `End date cannot be after ${ownerIncomeDayLabel(limits.max_day)}.` }
  }

  if (ownerIncomeRangeSpanDays(from, to) > limits.max_span_days) {
    return { valid: false, message: `Pick ${limits.max_span_days} days or fewer.` }
  }

  return { valid: true }
}

/**
 * What the From / To pickers start on when no range is selected yet: the most
 * recent {@link DEFAULT_RANGE_DAYS} days, clamped to the published bounds, so
 * the picker opens on a range that already passes {@link checkOwnerIncomeRange}.
 */
export function defaultOwnerIncomeRange(limits: OwnerIncomeRangeLimits | null): { from: string; to: string } {
  if (limits === null) return { from: '', to: '' }

  const span = Math.max(1, Math.min(DEFAULT_RANGE_DAYS, limits.max_span_days))
  const from = shiftOwnerIncomeDay(limits.max_day, -(span - 1))

  return { from: from < limits.min_day ? limits.min_day : from, to: limits.max_day }
}
