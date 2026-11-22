// ========================================
// Pretty ID — display formatters
// ========================================
//
// Pure formatters for the event screens. Dates are rendered in the device's
// local timezone. Whole-coin amounts with thousands separators are NOT here —
// use `formatCoins` from `~/utils/currency`.

import { PRETTY_ID_DAY_MS, PRETTY_ID_HOUR_MS } from '~/constants/pretty-id'

// ========================================
// Constants
// ========================================

const MINUTE_MS = 60_000
const SECOND_MS = 1_000
const MILLION = 1_000_000
const THOUSAND = 1_000
const MONDAY_OFFSET = 6
const DAYS_PER_WEEK = 7
const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/
/** Trailing zeros (and a bare trailing dot) of a fixed-point number. */
const TRAILING_ZEROS = /\.?0+$/

// ========================================
// Helpers
// ========================================

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

/** `YYYY-MM` → `[year, monthIndex0]`, or `null` when malformed. */
function parseMonthKey(key: string): [number, number] | null {
  const match = MONTH_KEY_PATTERN.exec(key)
  if (!match) return null
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return [Number(match[1]), month - 1]
}

// ========================================
// Amounts & durations
// ========================================

/** Compact amount: `50K`, `1.2M`, `1.25M`, `10M`; below 1,000 it is the plain number. */
export function formatPrettyIdShort(n: number): string {
  if (n >= MILLION) {
    const fixed = (n / MILLION).toFixed(n % MILLION ? 2 : 1)
    return `${fixed.replace(TRAILING_ZEROS, '')}M`
  }
  if (n >= THOUSAND) return `${(n / THOUSAND).toFixed(0)}K`
  return String(n)
}

/** Countdown text: `[<d>D ]HH:MM:SS`. Negative input clamps to `00:00:00`. */
export function formatPrettyIdDuration(ms: number): string {
  const total = Math.max(0, ms)
  const days = Math.floor(total / PRETTY_ID_DAY_MS)
  const hours = Math.floor((total % PRETTY_ID_DAY_MS) / PRETTY_ID_HOUR_MS)
  const minutes = Math.floor((total % PRETTY_ID_HOUR_MS) / MINUTE_MS)
  const seconds = Math.floor((total % MINUTE_MS) / SECOND_MS)
  const clock = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
  return days > 0 ? `${days}D ${clock}` : clock
}

// ========================================
// Dates
// ========================================

/** Local `YYYY/MM/DD`; empty string for an unparseable timestamp. */
export function formatPrettyIdDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`
}

/** Local `YYYY/MM/DD HH:mm`; empty string for an unparseable timestamp. */
export function formatPrettyIdDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${formatPrettyIdDate(iso)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

// ========================================
// Months & weeks
// ========================================

/** Local `YYYY-MM` of an epoch-ms instant. */
export function prettyIdMonthKey(ms: number): string {
  return monthKeyOf(new Date(ms))
}

/** `"2026-10"` → `"October 2026"`. A malformed key is returned unchanged. */
export function prettyIdMonthName(key: string): string {
  const parsed = parseMonthKey(key)
  if (!parsed) return key
  const [year, monthIndex] = parsed
  const month = new Date(year, monthIndex, 1).toLocaleString('en-US', { month: 'long' })
  return `${month} ${year}`
}

/** The month before `key` — `"2026-01"` → `"2025-12"`. A malformed key is returned unchanged. */
export function prettyIdPreviousMonthKey(key: string): string {
  const parsed = parseMonthKey(key)
  if (!parsed) return key
  const [year, monthIndex] = parsed
  // `Date` normalises a month index of -1 to December of the previous year.
  return monthKeyOf(new Date(year, monthIndex - 1, 1))
}

/** Epoch ms of the local Monday 00:00 of the week containing `ms`. */
export function prettyIdWeekStart(ms: number): number {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - ((date.getDay() + MONDAY_OFFSET) % DAYS_PER_WEEK))
  return date.getTime()
}
