// ========================================
// Pretty ID mock backend — event rules
// ========================================
//
// One named constant object for every number the mock plays by, plus the few
// calculations derived purely from it. The server-owned subset is surfaced to
// clients through `me().rules` (`toContractRules`).

import { PRETTY_ID_HOUR_MS } from '~/constants/pretty-id'
import type { MockLot, MockSlot } from '~/services/prettyIdMock/state'
import type { PrettyIdRules, PrettyIdSlotKey } from '~/types/pretty-id'

const SECOND_MS = 1_000

/** Event rules and mock-only knobs. */
export const PRETTY_ID_MOCK_RULES = {
  entryFee: 2_000,
  openingBid: 1_200_000,
  minIncrement: 50_000,
  auctionDurationHours: 72,
  antiSnipeSeconds: 60,
  ownershipDays: 30,
  changeCooldownHours: 24,
  /** How long a released (changed-away) ID stays unclaimable. */
  releaseCooldownHours: 72,
  minLevelAuction: 17,
  initialChangeTokens: 1,
  slotLevel: { lv17: 17, lv34: 34 } satisfies Record<PrettyIdSlotKey, number>,
} as const

/** A bid landing with less than this left extends the lot to this much from the bid. */
export const ANTI_SNIPE_MS = PRETTY_ID_MOCK_RULES.antiSnipeSeconds * SECOND_MS

/** The `PrettyIdRules` shape exposed on `me().rules`. */
export function toContractRules(): PrettyIdRules {
  return {
    entry_fee: PRETTY_ID_MOCK_RULES.entryFee,
    opening_bid: PRETTY_ID_MOCK_RULES.openingBid,
    min_increment: PRETTY_ID_MOCK_RULES.minIncrement,
    ownership_days: PRETTY_ID_MOCK_RULES.ownershipDays,
    change_cooldown_hours: PRETTY_ID_MOCK_RULES.changeCooldownHours,
    min_level_auction: PRETTY_ID_MOCK_RULES.minLevelAuction,
  }
}

/** When the next change of `slot` is allowed. */
export function nextChangeAt(slot: MockSlot): number {
  return slot.last_change_at + PRETTY_ID_MOCK_RULES.changeCooldownHours * PRETTY_ID_HOUR_MS
}

/** Smallest amount the next bid on `lot` must reach. */
export function minNextBid(lot: MockLot): number {
  const top = lot.bids[0]
  return top ? top.amount + PRETTY_ID_MOCK_RULES.minIncrement : PRETTY_ID_MOCK_RULES.openingBid
}
