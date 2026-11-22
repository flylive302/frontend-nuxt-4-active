// ========================================
// Pretty ID mock backend — housekeeping
// ========================================
//
// The lazy replacement for the demo's 1 s `tick`: it runs at the start of every
// API call. Lots whose end time has passed are settled, then holdings past their
// expiry are released. Settlement is stamped from the lot's own end time, so a
// long clock skip can never mint a fresh 30-day holding.

import { PRETTY_ID_DAY_MS } from '~/constants/pretty-id'
import { weekEndOf } from '~/services/prettyIdMock/clock'
import { PRETTY_ID_MOCK_RULES } from '~/services/prettyIdMock/rules'
import type { MockData, MockLot } from '~/services/prettyIdMock/state'
import { prettyIdWeekStart } from '~/utils/pretty-id-format'

function nextAllotmentId(data: MockData): number {
  return data.allotments.reduce((max, allotment) => Math.max(max, allotment.id), 0) + 1
}

/** Close a lot at its own end time: record the winner, week allotment and (if mine) the holding. */
function settleLot(data: MockData, lot: MockLot): void {
  lot.ended = true
  const top = lot.bids[0]
  if (!top) return
  const endedAt = lot.ends_at
  data.owned[lot.number] = top.user
  if (top.user === 'me') {
    data.holdings.push({
      id: lot.number,
      won_at: endedAt,
      expires_at: endedAt + PRETTY_ID_MOCK_RULES.ownershipDays * PRETTY_ID_DAY_MS,
    })
  }
  data.wins.unshift({ user: top.user, number: lot.number, amount: top.amount, at: endedAt })
  const weekStart = prettyIdWeekStart(endedAt)
  data.allotments.unshift({
    id: nextAllotmentId(data),
    user: top.user,
    number: lot.number,
    week_start: weekStart,
    week_end: weekEndOf(weekStart),
  })
}

function expireHoldings(data: MockData, now: number): void {
  data.holdings = data.holdings.filter((holding) => {
    if (holding.expires_at > now) return true
    Reflect.deleteProperty(data.owned, holding.id)
    return false
  })
}

function purgeReleased(data: MockData, now: number): void {
  for (const [id, until] of Object.entries(data.released)) {
    if (until <= now) Reflect.deleteProperty(data.released, id)
  }
}

/** Settle finished lots first, then expire holdings — so a long skip cannot mint a fresh 30 days. */
export function runHousekeeping(data: MockData, now: number): void {
  for (const lot of data.lots) {
    if (!lot.ended && now >= lot.ends_at) settleLot(data, lot)
  }
  expireHoldings(data, now)
  purgeReleased(data, now)
}
