// ========================================
// Pretty ID mock backend — Choose / search / claim / change
// ========================================
//
// Each helper is one pipeline stage: GATE helpers throw `PrettyIdApiError`,
// EXECUTE helpers mutate the data; `claimOrChange` just composes them. The check
// order is the demo's: level → race lever → availability → slot checks.

import {
  PRETTY_ID_HOUR_MS,
  PRETTY_ID_LIST_PAGE_SIZE,
  PRETTY_ID_SLOT_KEYS,
  PRETTY_ID_SLOT_LENGTH,
  PRETTY_ID_SUGGESTION_LIMIT,
} from '~/constants/pretty-id'
import { MOCK_RACE_THIEF } from '~/services/prettyIdMock/people'
import { buildMe } from '~/services/prettyIdMock/mappers'
import { PRETTY_ID_MOCK_RULES, nextChangeAt } from '~/services/prettyIdMock/rules'
import { PRETTY_ID_MOCK_POOLS } from '~/services/prettyIdMock/seed'
import type { MockCtx, MockData } from '~/services/prettyIdMock/state'
import type {
  PrettyIdClaimResult,
  PrettyIdItem,
  PrettyIdListQuery,
  PrettyIdListResponse,
  PrettyIdMockProfile,
  PrettyIdSearchResult,
  PrettyIdSlotKey,
} from '~/types/pretty-id'
import { PrettyIdApiError } from '~/utils/pretty-id-error'
import { formatPrettyIdDuration } from '~/utils/pretty-id-format'
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
  alreadyClaimed: 'Already claimed for this level. Use a change token in My ID.',
  nothingToChange: 'Nothing to change yet',
  noTokens: 'No change tokens left',
} as const

// ========================================
// Availability & ID input
// ========================================

/** Claimable right now: unowned, out of its release cooldown, well-formed and not reserved. */
export function isIdAvailable(data: MockData, id: string, now: number): boolean {
  if (data.owned[id] !== undefined) return false
  const releasedUntil = data.released[id]
  if (releasedUntil !== undefined && now < releasedUntil) return false
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

function suggestionsFor({ data, now }: MockCtx, id: string): PrettyIdItem[] {
  return suggestPrettyIds(id, candidate => isIdAvailable(data, candidate, now), PRETTY_ID_SUGGESTION_LIMIT)
}

function takenError(ctx: MockCtx, id: string): PrettyIdApiError {
  return new PrettyIdApiError('taken', MESSAGES.taken, suggestionsFor(ctx, id))
}

// ========================================
// Choose / search
// ========================================

export function listIds({ data, now }: MockCtx, { length, tier }: PrettyIdListQuery): PrettyIdListResponse {
  const matches = PRETTY_ID_MOCK_POOLS[length]
    .filter(id => isIdAvailable(data, id, now))
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
  if (isIdAvailable(ctx.data, id, ctx.now)) {
    return searchResult(id, { available: true, tier: classifyPrettyId(id) })
  }
  return searchResult(id, {
    reason: ctx.data.owned[id] !== undefined ? 'taken' : 'reserved',
    suggestions: suggestionsFor(ctx, id),
  })
}

// ========================================
// Claim / change
// ========================================

/** GATE: the ID is well-formed and (for a change) fits the slot being changed. */
function gateClaimInput(id: string, changeSlot: PrettyIdSlotKey | null): PrettyIdSlotKey {
  const input = inspectIdInput(id)
  if ('reason' in input) throw new PrettyIdApiError('invalid', input.message)
  if (changeSlot && input.slot !== changeSlot) {
    throw new PrettyIdApiError('invalid', `That slot takes ${PRETTY_ID_SLOT_LENGTH[changeSlot]}-digit IDs`)
  }
  return input.slot
}

function gateLevel({ data }: MockCtx, slot: PrettyIdSlotKey): void {
  const needed = PRETTY_ID_MOCK_RULES.slotLevel[slot]
  if (data.level >= needed) return
  throw new PrettyIdApiError('level_required', `Reach Lv ${needed} to unlock ${PRETTY_ID_SLOT_LENGTH[slot]}-digit IDs`)
}

/** GATE (test lever): an armed race hands the ID to a rival, disarms, and refuses. */
function gateRace(ctx: MockCtx, id: string): void {
  if (!ctx.data.race_armed) return
  ctx.data.race_armed = false
  ctx.data.owned[id] = MOCK_RACE_THIEF.id
  throw takenError(ctx, id)
}

function gateAvailable(ctx: MockCtx, id: string): void {
  if (!isIdAvailable(ctx.data, id, ctx.now)) throw takenError(ctx, id)
}

function gateFirstClaim({ data }: MockCtx, slot: PrettyIdSlotKey): void {
  if (data.slots[slot]) throw new PrettyIdApiError('already_claimed', MESSAGES.alreadyClaimed)
}

function gateChange({ data, now }: MockCtx, slot: PrettyIdSlotKey): void {
  const current = data.slots[slot]
  if (!current) throw new PrettyIdApiError('nothing_to_change', MESSAGES.nothingToChange)
  if (current.tokens <= 0) throw new PrettyIdApiError('no_tokens', MESSAGES.noTokens)
  const allowedAt = nextChangeAt(current)
  if (now < allowedAt) {
    throw new PrettyIdApiError('cooldown', `Too soon: next change in ${formatPrettyIdDuration(allowedAt - now)}`)
  }
}

function executeClaim({ data, now }: MockCtx, slot: PrettyIdSlotKey, id: string): void {
  data.slots[slot] = {
    id,
    tokens: PRETTY_ID_MOCK_RULES.initialChangeTokens,
    claimed_at: now,
    last_change_at: now,
  }
  data.owned[id] = 'me'
}

/** Swap the slot's ID: the old one cools down, a token is spent, the change cooldown restarts. */
function executeChange({ data, now }: MockCtx, slot: PrettyIdSlotKey, id: string): void {
  const current = data.slots[slot]
  if (!current) return
  Reflect.deleteProperty(data.owned, current.id)
  data.released[current.id] = now + PRETTY_ID_MOCK_RULES.releaseCooldownHours * PRETTY_ID_HOUR_MS
  current.id = id
  current.tokens -= 1
  current.last_change_at = now
  data.owned[id] = 'me'
}

/** First claim of a slot (`changeSlot` null) or a swap of an existing claim. */
export function claimOrChange(
  ctx: MockCtx,
  profile: PrettyIdMockProfile,
  id: string,
  changeSlot: PrettyIdSlotKey | null,
): PrettyIdClaimResult {
  const slot = gateClaimInput(id, changeSlot)
  gateLevel(ctx, slot)
  gateRace(ctx, id)
  gateAvailable(ctx, id)
  if (changeSlot) {
    gateChange(ctx, slot)
    executeChange(ctx, slot, id)
  } else {
    gateFirstClaim(ctx, slot)
    executeClaim(ctx, slot, id)
  }
  return { id, slot, changed: changeSlot !== null, me: buildMe(ctx.data, profile, ctx.now) }
}
