// ========================================
// Pretty ID mock backend — clock & calendar helpers
// ========================================

import { PRETTY_ID_HOUR_MS } from '~/constants/pretty-id'
import type { MockData } from '~/services/prettyIdMock/state'

/** Last day of a Monday-based week relative to its Monday. */
const WEEK_END_OFFSET_DAYS = 6

/** The mock clock: the device clock shifted by the skipped hours. */
export function mockNow(data: MockData): number {
  return Date.now() + data.offset_hours * PRETTY_ID_HOUR_MS
}

export function toIso(ms: number): string {
  return new Date(ms).toISOString()
}

/** `ms` shifted by whole local calendar days (DST-safe, unlike adding 24 h). */
export function addLocalDays(ms: number, days: number): number {
  const date = new Date(ms)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

/** Start of the Sunday that closes the Monday-based week beginning at `weekStart`. */
export function weekEndOf(weekStart: number): number {
  return addLocalDays(weekStart, WEEK_END_OFFSET_DAYS)
}
