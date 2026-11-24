// ========================================
// Pretty ID mock backend — Choose / search / claim
// ========================================
//
// Each helper is one pipeline stage: GATE helpers throw `PrettyIdApiError`,
// EXECUTE helpers mutate the data; `claimId` just composes them. The check
// order is the demo's: level → availability → slot check.

import {
  PRETTY_ID_LIST_PAGE_SIZE,
  PRETTY_ID_SLOT_KEYS,
  PRETTY_ID_SLOT_LENGTH,
  PRETTY_ID_SUGGESTION_LIMIT,
} from '~/constants/pretty-id'
import { buildMe } from '~/services/prettyIdMock/mappers'
import { PRETTY_ID_MOCK_RULES } from '~/services/prettyIdMock/rules'
import { PRETTY_ID_MOCK_POOLS } from '~/services/prettyIdMock/seed'
import type { MockCtx, MockData } from '~/services/prettyIdMock/state'
import type {
  PrettyIdClaimResult,
  PrettyIdItem,
  PrettyIdListQuery,
  PrettyIdListResponse,
  PrettyIdSearchResult,
  PrettyIdSlotKey,
} from '~/types/pretty-id'
import { PrettyIdApiError } from '~/utils/pretty-id-error'
import { classifyPrettyId, isPrettyIdAuctionNumber, validatePrettyId } from '~/utils/pretty-id-rules'
import { suggestPrettyIds } from '~/utils/pretty-id-suggest'

// ========================================
// Constants
// ========================================

const MESSAGES = {
  digitsOnly: 'Digits only',
  badLength: 'Pretty IDs are 6 digits (Lv 17) or 4 digits (Lv 34)',
  leadingZero: 'That number can\'t be used (leading zero)',
  auctionOnly: '1–99 are rare auction-only IDs',
  taken: 'That ID is no longer available',
  alreadyClaimed: 'You already claimed an ID for this level.',
} as const

// ========================================
// Availability & ID input
// ========================================

/** Claimable right now: unowned, well-formed and not reserved. */
export function isIdAvailable(data: MockData, id: string): boolean {
  if (data.owned[id] !== undefined) return false
  if (isPrettyIdAuctionNumber(id)) return false
  return validatePrettyId(id, id.length) === null
}

type IdInput =
  | { slot: PrettyIdSlotKey }
  | { reason: 'invalid' | 'auction_only', message: string }

function slotForLength(length: number): PrettyIdSlotKey | null {
  return PRETTY_ID_SLOT_KEYS.find(key => PRETTY_ID_SLOT_LENGTH[key] === length) ?? null
}

/** What a typed ID is: a slot's worth of digits, or why it is not. Check order is the demo's. */
function inspectIdInput(id: string): IdInput {
  if (!/^\d+$/.test(id)) return { reason: 'invalid', message: MESSAGES.digitsOnly }
  if (isPrettyIdAuctionNumber(id)) return { reason: 'auction_only', message: MESSAGES.auctionOnly }
  const slot = slotForLength(id.length)
  if (!slot) return { reason: 'invalid', message: MESSAGES.badLength }
  if (validatePrettyId(id, id.length) === 'leading_zero') return { reason: 'invalid', message: MESSAGES.leadingZero }
  return { slot }
}

function suggestionsFor({ data }: MockCtx, id: string): PrettyIdItem[] {
  return suggestPrettyIds(id, candidate => isIdAvailable(data, candidate), PRETTY_ID_SUGGESTION_LIMIT)
}

function takenError(ctx: MockCtx, id: string): PrettyIdApiError {
  return new PrettyIdApiError('taken', MESSAGES.taken, suggestionsFor(ctx, id))
}

// ========================================
// Choose / search
// ========================================

export function listIds({ data }: MockCtx, { length, tier }: PrettyIdListQuery): PrettyIdListResponse {
  const matches = PRETTY_ID_MOCK_POOLS[length]
    .filter(id => isIdAvailable(data, id))
    .map((id): PrettyIdItem => ({ id, tier: classifyPrettyId(id) }))
    .filter(item => !tier || item.tier === tier)
  return { items: matches.slice(0, PRETTY_ID_LIST_PAGE_SIZE), total: matches.length }
}

function searchResult(id: string, fields: Partial<PrettyIdSearchResult>): PrettyIdSearchResult {
  return { id, available: false, reason: null, message: null, tier: null, suggestions: [], ...fields }
}

export function searchId(ctx: MockCtx, id: string): PrettyIdSearchResult {
  const input = inspectIdInput(id)
  if ('reason' in input) {
    // Auction-only numbers carry no message — the reason says it all.
    return searchResult(id, {
      reason: input.reason,
      message: input.reason === 'invalid' ? input.message : null,
    })
  }
  if (isIdAvailable(ctx.data, id)) {
    return searchResult(id, { available: true, tier: classifyPrettyId(id) })
  }
  return searchResult(id, {
    reason: ctx.data.owned[id] !== undefined ? 'taken' : 'reserved',
    suggestions: suggestionsFor(ctx, id),
  })
}

// ========================================
// Claim
// ========================================

/** GATE: the ID is well-formed and fits a slot. */
function gateClaimInput(id: string): PrettyIdSlotKey {
  const input = inspectIdInput(id)
  if ('reason' in input) throw new PrettyIdApiError('invalid', input.message)
  return input.slot
}

function gateLevel({ data }: MockCtx, slot: PrettyIdSlotKey): void {
  const needed = PRETTY_ID_MOCK_RULES.slotLevel[slot]
  if (data.level >= needed) return
  throw new PrettyIdApiError('level_required', `Reach Lv ${needed} to unlock ${PRETTY_ID_SLOT_LENGTH[slot]}-digit IDs`)
}

function gateAvailable(ctx: MockCtx, id: string): void {
  if (!isIdAvailable(ctx.data, id)) throw takenError(ctx, id)
}

function gateFirstClaim({ data }: MockCtx, slot: PrettyIdSlotKey): void {
  if (data.slots[slot]) throw new PrettyIdApiError('already_claimed', MESSAGES.alreadyClaimed)
}

function executeClaim({ data }: MockCtx, slot: PrettyIdSlotKey, id: string): void {
  data.slots[slot] = { id }
  data.owned[id] = 'me'
}

/** Claim `id` for the slot its length belongs to. */
export function claimId(ctx: MockCtx, id: string): PrettyIdClaimResult {
  const slot = gateClaimInput(id)
  gateLevel(ctx, slot)
  gateAvailable(ctx, id)
  gateFirstClaim(ctx, slot)
  executeClaim(ctx, slot, id)
  return { id, slot, me: buildMe(ctx.data) }
}
