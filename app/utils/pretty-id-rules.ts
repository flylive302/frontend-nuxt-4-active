// ========================================
// Pretty ID — rules engine
// ========================================
//
// Pure port of the reference `core.js`: pattern tiers and ID validation. The
// "similar free IDs" suggester lives in `pretty-id-suggest.ts`. No Vue, no stores,
// no I/O — the mock backend (`services/prettyIdMockApi.ts`) and any future
// client-side preview share it.

import type { PrettyIdTier } from '~/types/pretty-id'

// ========================================
// Constants
// ========================================

/** Why a typed ID is not a well-formed, claimable Pretty ID. */
export type PrettyIdInvalidReason = 'digits_only' | 'wrong_length' | 'leading_zero' | 'reserved'

/** Substrings that make an otherwise plain ID a "lucky" one. */
const LUCKY = ['520', '1314', '888', '666', '168', '999'] as const

/** Blocked IDs: system ranges, test numbers, offensive numbers. */
const BLOCKED: ReadonlySet<string> = new Set([
  '0000', '1000', '1000000', '100000', '110110', '120120', '119119', '250250',
  '444444', '4444', '1234', '10000', '10001', '10086',
])

/** Reserved numeric ranges (inclusive), keyed by ID length. */
const RESERVED_RANGE_6_DIGIT = { length: 6, from: 100_000, to: 100_999 } as const // staff / admin
const RESERVED_RANGE_4_DIGIT = { length: 4, from: 1_000, to: 1_099 } as const // system

const AUCTION_NUMBER_PATTERN = /^[1-9]\d?$/
const DIGITS_ONLY_PATTERN = /^\d+$/
const LEGEND_PATTERN = /^(\d)\1+$/
const COUPLE_PATTERNS = [/^(520|1314)+$/, /^(520)+1314$|^1314(520)+$/] as const
const COUPLE_EXACT = ['5201314', '1314520'] as const

const LEGEND_MIN_LENGTH = 4
const RUN_MIN_LENGTH = 3
const MIRROR_MIN_LENGTH = 4
const REPEAT_BLOCK_MIN_LENGTH = 2

/** `prettyIdShape()` names letters from "A" upwards. */
const SHAPE_FIRST_LETTER_CODE = 65

// ========================================
// Pattern helpers
// ========================================

function digitAt(id: string, index: number): number {
  return Number(id.charAt(index))
}

/** Auction-only rare IDs: 1–99. Never listed, searched, suggested or claimed. */
export function isPrettyIdAuctionNumber(id: string): boolean {
  return AUCTION_NUMBER_PATTERN.test(id)
}

/** Letter shape by first occurrence: 520520 → ABCABC, 888888 → AAAAAA, 1221 → ABBA. */
export function prettyIdShape(id: string): string {
  const letters = new Map<string, string>()
  let out = ''
  for (const digit of id) {
    let letter = letters.get(digit)
    if (letter === undefined) {
      letter = String.fromCharCode(SHAPE_FIRST_LETTER_CODE + letters.size)
      letters.set(digit, letter)
    }
    out += letter
  }
  return out
}

/** Ascending or descending consecutive digits (123456, 654321, 4567). Shared with the suggester. */
export function isPrettyIdRun(id: string): boolean {
  if (id.length < RUN_MIN_LENGTH) return false
  const step = digitAt(id, 1) - digitAt(id, 0)
  if (step !== 1 && step !== -1) return false
  for (let i = 2; i < id.length; i++) {
    if (digitAt(id, i) - digitAt(id, i - 1) !== step) return false
  }
  return true
}

export function isPrettyIdMirror(id: string): boolean {
  return id.length >= MIRROR_MIN_LENGTH && id === [...id].reverse().join('')
}

/** Smallest block (length ≥ 2) that, repeated at least twice, makes up the whole ID. */
export function prettyIdRepeatBlock(id: string): string | null {
  for (let length = REPEAT_BLOCK_MIN_LENGTH; length <= id.length / 2; length++) {
    if (id.length % length === 0 && id === id.slice(0, length).repeat(id.length / length)) {
      return id.slice(0, length)
    }
  }
  return null
}

function isCouple(id: string): boolean {
  return COUPLE_PATTERNS.some(pattern => pattern.test(id)) || COUPLE_EXACT.some(exact => exact === id)
}

// ========================================
// Classification
// ========================================

/** Pattern tier of an ID. The check order is the tier priority — do not reorder. */
export function classifyPrettyId(id: string): PrettyIdTier {
  if (LEGEND_PATTERN.test(id) && id.length >= LEGEND_MIN_LENGTH) return 'legend'
  if (isCouple(id)) return 'couple'
  if (isPrettyIdRun(id)) return 'sequence'
  if (LUCKY.some(pattern => id.includes(pattern))) return 'lucky'
  if (isPrettyIdMirror(id)) return 'mirror'
  if (prettyIdRepeatBlock(id)) return 'repeat'
  return 'standard'
}

// ========================================
// Validation
// ========================================

function isReservedRange(id: string): boolean {
  const value = Number(id)
  return [RESERVED_RANGE_6_DIGIT, RESERVED_RANGE_4_DIGIT].some(
    range => id.length === range.length && value >= range.from && value <= range.to,
  )
}

/**
 * Validate a typed ID for a slot of `length` digits. Returns `null` when it is a
 * well-formed, non-reserved ID; otherwise the first reason it is not. Says nothing
 * about ownership — a valid ID may still be taken.
 */
export function validatePrettyId(id: string, length: number): PrettyIdInvalidReason | null {
  if (!DIGITS_ONLY_PATTERN.test(id)) return 'digits_only'
  if (id.length !== length) return 'wrong_length'
  if (id.startsWith('0')) return 'leading_zero'
  if (BLOCKED.has(id) || isReservedRange(id)) return 'reserved'
  return null
}
