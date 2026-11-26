// ========================================
// Pretty ID — Big Winners / Weekly Record pure helpers
// ========================================
//
// No Vue, no stores. The server buckets finished auctions by month and week in PKT
// (Asia/Karachi, UTC+5, no DST), so every date these pages show is a PKT date.
// `month` is `YYYY-MM`; a week's `starts_on` / `ends_on` are `YYYY-MM-DD` PKT dates.

import { PRETTY_ID_ROUTES } from '~/constants/pretty-id'
import { PRETTY_ID_AUCTION_HOUR_MS } from '~/constants/pretty-id-auction'

/** PKT is UTC+5 all year. */
const PKT_OFFSET_MS = 5 * PRETTY_ID_AUCTION_HOUR_MS
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const DATE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const
const HOURS_ON_CLOCK = 12

export type PrettyIdHistoryKind = 'winners' | 'weekly'

export interface PrettyIdMonthNeighbours {
  /** The next older month with data, or `null` at the oldest. */
  older: string | null
  /** The next newer month with data, or `null` at the newest. */
  newer: string | null
}

/** The `?month=` of a history URL when it is a valid `YYYY-MM` string; otherwise `null` (the server then uses the current month). */
export function parsePrettyIdHistoryMonth(raw: unknown): string | null {
  return typeof raw === 'string' && MONTH_PATTERN.test(raw) ? raw : null
}

/** The history page, optionally on one month. */
export function prettyIdHistoryRoute(kind: PrettyIdHistoryKind, month?: string | null): { path: string; query?: { month: string } } {
  const path = PRETTY_ID_ROUTES[kind]
  return month ? { path, query: { month } } : { path }
}

/** The PKT `YYYY-MM` of an instant, or `null` when it is not a date. */
export function prettyIdPktMonth(iso: string): string | null {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  return new Date(ms + PKT_OFFSET_MS).toISOString().slice(0, 7)
}

/** `November 2026`; an unrecognised value is returned as is. */
export function prettyIdMonthLabel(month: string): string {
  if (!MONTH_PATTERN.test(month)) return month
  const name = MONTH_NAMES[Number(month.slice(5, 7)) - 1]
  return `${name} ${month.slice(0, 4)}`
}

/**
 * The nearest month with data on each side of `month`. `months` is newest first. `month` need not
 * be listed (a URL can ask for an empty month): the neighbours are still the closest listed ones.
 */
export function prettyIdMonthNeighbours(months: readonly string[], month: string): PrettyIdMonthNeighbours {
  // `YYYY-MM` strings order the same as the months do.
  const older = months.find(candidate => candidate < month) ?? null
  const newer = [...months].reverse().find(candidate => candidate > month) ?? null
  return { older, newer }
}

/** `26 Nov 2026, 3:00 PM` — an instant on the PKT clock. */
export function formatPrettyIdPktDateTime(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ''
  const pkt = new Date(ms + PKT_OFFSET_MS)
  const hours = pkt.getUTCHours()
  const hour12 = hours % HOURS_ON_CLOCK === 0 ? HOURS_ON_CLOCK : hours % HOURS_ON_CLOCK
  const minutes = String(pkt.getUTCMinutes()).padStart(2, '0')
  const suffix = hours < HOURS_ON_CLOCK ? 'AM' : 'PM'
  const monthName = MONTH_NAMES[pkt.getUTCMonth()]?.slice(0, 3) ?? ''
  return `${pkt.getUTCDate()} ${monthName} ${pkt.getUTCFullYear()}, ${hour12}:${minutes} ${suffix}`
}

/** `23 – 29 Nov` for a week (always inside one month); `1 Nov` for a one-day week. Empty for a bad date. */
export function formatPrettyIdWeekRange(startsOn: string, endsOn: string): string {
  const start = DATE_PATTERN.exec(startsOn)
  const end = DATE_PATTERN.exec(endsOn)
  if (start === null || end === null) return ''
  const monthName = MONTH_NAMES[Number(end[2]) - 1]?.slice(0, 3) ?? ''
  const firstDay = Number(start[3])
  const lastDay = Number(end[3])
  return firstDay === lastDay ? `${lastDay} ${monthName}` : `${firstDay} – ${lastDay} ${monthName}`
}
