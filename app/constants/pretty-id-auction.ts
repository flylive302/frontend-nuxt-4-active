/**
 * Rare Auction (pretty-id-step2) constants: time units, polling cadence, clock
 * tick and list sizes. Kept apart from `constants/pretty-id.ts` on purpose.
 */

// ========================================
// Time units
// ========================================

export const PRETTY_ID_AUCTION_SECOND_MS = 1_000
export const PRETTY_ID_AUCTION_MINUTE_MS = 60 * PRETTY_ID_AUCTION_SECOND_MS
export const PRETTY_ID_AUCTION_HOUR_MS = 60 * PRETTY_ID_AUCTION_MINUTE_MS
export const PRETTY_ID_AUCTION_DAY_MS = 24 * PRETTY_ID_AUCTION_HOUR_MS

// ========================================
// Polling
// ========================================

/** Auction page: delay between fetches once the auction is in its final hour (or past its end, awaiting settlement). */
export const PRETTY_ID_AUCTION_POLL_FAST_MS = 3_000

/** Auction page: delay between fetches while more than an hour remains, and the cap while upcoming. */
export const PRETTY_ID_AUCTION_POLL_SLOW_MS = 60_000

/** A live auction polls fast while less than this remains to its ACTUAL end (so it stays fast through extensions). */
export const PRETTY_ID_AUCTION_FAST_WINDOW_MS = PRETTY_ID_AUCTION_HOUR_MS

/** An upcoming page refetches this long after the planned start, so it sees the live state. */
export const PRETTY_ID_AUCTION_START_SLACK_MS = 1_000

/** The tab's grid refetch cadence. */
export const PRETTY_ID_AUCTION_TAB_POLL_MS = 60_000

// ========================================
// Clock & lists
// ========================================

/** Repaint interval of the shared server-adjusted clock behind every countdown. */
export const PRETTY_ID_AUCTION_CLOCK_TICK_MS = 1_000

/** Bidders listed on the auction page (the server sends at most this many). */
export const PRETTY_ID_AUCTION_BIDDERS_SHOWN = 8
