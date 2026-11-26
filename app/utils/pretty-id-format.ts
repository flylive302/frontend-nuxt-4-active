// ========================================
// Pretty ID — display formatters
// ========================================
//
// Pure formatters for the event screens. Whole-coin amounts with thousands
// separators are NOT here: use `formatCoins` from `~/utils/currency`.

import {
  PRETTY_ID_AUCTION_DAY_MS,
  PRETTY_ID_AUCTION_HOUR_MS,
  PRETTY_ID_AUCTION_MINUTE_MS,
  PRETTY_ID_AUCTION_SECOND_MS,
} from '~/constants/pretty-id-auction'

const MILLION = 1_000_000
const THOUSAND = 1_000
/** Trailing zeros (and a bare trailing dot) of a fixed-point number. */
const TRAILING_ZEROS = /\.?0+$/

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** Compact amount: `50K`, `1.2M`, `1.25M`, `10M`; below 1,000 it is the plain number. */
export function formatPrettyIdShort(n: number): string {
  if (n >= MILLION) {
    const fixed = (n / MILLION).toFixed(n % MILLION ? 2 : 1)
    return `${fixed.replace(TRAILING_ZEROS, '')}M`
  }
  if (n >= THOUSAND) return `${(n / THOUSAND).toFixed(0)}K`
  return String(n)
}

/** Countdown text: `[<d>D ]HH:MM:SS`. Negative (or non-finite) input clamps to `00:00:00`. */
export function formatPrettyIdDuration(ms: number): string {
  const total = Number.isFinite(ms) ? Math.max(0, ms) : 0
  const days = Math.floor(total / PRETTY_ID_AUCTION_DAY_MS)
  const hours = Math.floor((total % PRETTY_ID_AUCTION_DAY_MS) / PRETTY_ID_AUCTION_HOUR_MS)
  const minutes = Math.floor((total % PRETTY_ID_AUCTION_HOUR_MS) / PRETTY_ID_AUCTION_MINUTE_MS)
  const seconds = Math.floor((total % PRETTY_ID_AUCTION_MINUTE_MS) / PRETTY_ID_AUCTION_SECOND_MS)
  const clock = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
  return days > 0 ? `${days}D ${clock}` : clock
}

/** `1 day` / `7 days`. */
export function formatPrettyIdDays(days: number): string {
  return days === 1 ? '1 day' : `${days} days`
}
