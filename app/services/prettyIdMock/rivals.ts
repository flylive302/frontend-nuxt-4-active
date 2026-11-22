// ========================================
// Pretty ID mock backend — rival bots
// ========================================
//
// The demo's 7 s interval, made lazy: nothing runs in the background. A lot's
// dice are rolled when `auction()` finds a roll is due (at most once per
// `RIVAL_ROLL_INTERVAL_MS` of mock-clock time, only while the user has entered
// and the lot is live), and the dev panel can force a round with `tryRivalBid`.
// The RNG is injected so tests can script every draw.

import { executeBid } from '~/services/prettyIdMock/auctions'
import { MOCK_RIVALS, rivalAt } from '~/services/prettyIdMock/people'
import { PRETTY_ID_MOCK_RULES } from '~/services/prettyIdMock/rules'
import type { MockCtx, MockLot } from '~/services/prettyIdMock/state'

// ========================================
// Constants
// ========================================

const SECOND_MS = 1_000

/**
 * At most one rival-bot dice roll per lot per this much mock-clock time.
 * Deliberately a little SHORTER than the lot page's poll (`PRETTY_ID_LOT_POLL_MS`,
 * 7 s): the bots only roll inside `auction()`, and a timer-driven poll can land
 * a few ms early — an equal interval would then silently skip that roll.
 */
const RIVAL_ROLL_INTERVAL_MS = 6 * SECOND_MS
/** Chance a due roll attempts a rival bid. */
const RIVAL_ATTEMPT_CHANCE = 0.6
/** Chance a rival stays quiet while someone else already leads. */
const RIVAL_SKIP_CHANCE = 0.5
/** A rival raises by 1..N minimum increments. */
const RIVAL_MAX_INCREMENTS = 3

// ========================================
// Bots
// ========================================

/** One rival bid on `lot` by the demo's rules. Returns whether a bid was actually placed. */
export function tryRivalBid(ctx: MockCtx, lot: MockLot, random: () => number): boolean {
  if (lot.ended) return false
  const top = lot.bids[0]
  if (top && top.user !== 'me' && random() < RIVAL_SKIP_CHANCE) return false
  const rival = rivalAt(Math.floor(random() * MOCK_RIVALS.length))
  if (top && top.user === rival.id) return false
  const base = top ? top.amount : PRETTY_ID_MOCK_RULES.openingBid - PRETTY_ID_MOCK_RULES.minIncrement
  const steps = 1 + Math.floor(random() * RIVAL_MAX_INCREMENTS)
  executeBid(ctx, lot, rival.id, base + PRETTY_ID_MOCK_RULES.minIncrement * steps)
  return true
}

/** Roll the dice for `lot` when a roll is due. */
export function rollRivalBots(ctx: MockCtx, lot: MockLot, random: () => number): void {
  if (lot.ended || !lot.entered) return
  if (ctx.now - lot.last_rival_roll_at < RIVAL_ROLL_INTERVAL_MS) return
  lot.last_rival_roll_at = ctx.now
  if (random() < RIVAL_ATTEMPT_CHANCE) tryRivalBid(ctx, lot, random)
}
