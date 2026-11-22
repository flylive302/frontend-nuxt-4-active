// ========================================
// Pretty ID mock backend — response mappers
// ========================================
//
// Persisted data (epoch-ms numbers, user references) → the `PrettyIdApi` response
// shapes (ISO strings, user cards). Pure: no mutation, no rules beyond display.

import { PRETTY_ID_SLOT_LENGTH } from '~/constants/pretty-id'
import { toIso } from '~/services/prettyIdMock/clock'
import { userCard } from '~/services/prettyIdMock/people'
import { PRETTY_ID_MOCK_RULES, minNextBid, nextChangeAt, toContractRules } from '~/services/prettyIdMock/rules'
import type {
  MockAllotment,
  MockBid,
  MockData,
  MockHolding,
  MockLot,
  MockWin,
} from '~/services/prettyIdMock/state'
import type {
  PrettyIdAllotment,
  PrettyIdAuctionHolding,
  PrettyIdBid,
  PrettyIdLot,
  PrettyIdMe,
  PrettyIdMockProfile,
  PrettyIdSlot,
  PrettyIdSlotKey,
  PrettyIdWinner,
} from '~/types/pretty-id'

function slotView(data: MockData, key: PrettyIdSlotKey, now: number): PrettyIdSlot {
  const slot = data.slots[key]
  const requiredLevel = PRETTY_ID_MOCK_RULES.slotLevel[key]
  const nextChange = slot ? nextChangeAt(slot) : 0
  return {
    key,
    required_level: requiredLevel,
    length: PRETTY_ID_SLOT_LENGTH[key],
    unlocked: data.level >= requiredLevel,
    id: slot?.id ?? null,
    claimed_at: slot ? toIso(slot.claimed_at) : null,
    change_tokens: slot?.tokens ?? 0,
    next_change_at: slot && nextChange > now ? toIso(nextChange) : null,
  }
}

function holdingView(holding: MockHolding): PrettyIdAuctionHolding {
  return { id: holding.id, won_at: toIso(holding.won_at), expires_at: toIso(holding.expires_at) }
}

export function buildMe(data: MockData, profile: PrettyIdMockProfile, now: number): PrettyIdMe {
  return {
    server_now: toIso(now),
    user: userCard('me', profile),
    level: data.level,
    coins: data.coins,
    slots: { lv17: slotView(data, 'lv17', now), lv34: slotView(data, 'lv34', now) },
    auction_ids: data.holdings.map(holdingView),
    rules: toContractRules(),
  }
}

function bidView(bid: MockBid, profile: PrettyIdMockProfile): PrettyIdBid {
  return { user: userCard(bid.user, profile), amount: bid.amount, at: toIso(bid.at), is_me: bid.user === 'me' }
}

export function buildLot(lot: MockLot, profile: PrettyIdMockProfile): PrettyIdLot {
  const top = lot.bids[0]
  return {
    id: Number(lot.number),
    number: lot.number,
    status: lot.ended ? 'ended' : 'live',
    starts_at: toIso(lot.starts_at),
    ends_at: toIso(lot.ends_at),
    entry_fee: PRETTY_ID_MOCK_RULES.entryFee,
    opening_bid: PRETTY_ID_MOCK_RULES.openingBid,
    min_increment: PRETTY_ID_MOCK_RULES.minIncrement,
    highest_bid: top ? top.amount : null,
    min_next_bid: minNextBid(lot),
    entered: lot.entered,
    you_are_highest: top?.user === 'me',
    winner: lot.ended && top ? userCard(top.user, profile) : null,
    winning_bid: lot.ended && top ? top.amount : null,
    top_bids: lot.bids.map(bid => bidView(bid, profile)),
  }
}

export function buildWinner(win: MockWin, profile: PrettyIdMockProfile): PrettyIdWinner {
  return {
    auction_id: Number(win.number),
    user: userCard(win.user, profile),
    id_number: win.number,
    winning_bid: win.amount,
    won_at: toIso(win.at),
  }
}

export function buildAllotment(allotment: MockAllotment, profile: PrettyIdMockProfile): PrettyIdAllotment {
  const user = userCard(allotment.user, profile)
  return {
    id: allotment.id,
    week_start: toIso(allotment.week_start),
    week_end: toIso(allotment.week_end),
    id_number: allotment.number,
    user,
    signature_text: user.name,
  }
}
