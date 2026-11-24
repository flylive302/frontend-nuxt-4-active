// ========================================
// Pretty ID — similar-ID suggester
// ========================================
//
// Port of the reference `core.js` `suggest()`: generate candidates that share a
// taken ID's pattern, score their closeness, and return the best ones the caller
// says are available. Pure and synchronous — ownership lives in the caller's
// `isAvailable`. The pattern helpers come from `pretty-id-rules.ts`.

import type { PrettyIdItem } from '~/types/pretty-id'
import {
  classifyPrettyId,
  isPrettyIdAuctionNumber,
  isPrettyIdMirror,
  isPrettyIdRun,
  prettyIdRepeatBlock,
  prettyIdShape,
  validatePrettyId,
} from '~/utils/pretty-id-rules'

// ========================================
// Constants
// ========================================

const DIGITS = '0123456789'
const DIGIT_COUNT = DIGITS.length
/** Shapes with at most this many distinct digits are re-filled with every other digit combination. */
const MAX_SHAPE_ALPHABET = 3

// ----- Scoring -----
const SCORE_SAME_SHAPE = 60
const SCORE_SAME_TIER = 30
const SCORE_SAME_BLOCK_LENGTH = 15
const SCORE_BOTH_RUNS = 20
const SCORE_BOTH_MIRRORS = 15
const SCORE_PER_DIFFERING_DIGIT = 8
const SCORE_PER_SHARED_END_DIGIT = 3
/** Candidates scoring at or below this are too dissimilar to suggest. */
const SCORE_CUTOFF = -20

// ========================================
// Scoring
// ========================================

function hammingDistance(a: string, b: string): number {
  let distance = 0
  for (let i = 0; i < a.length; i++) {
    if (a.charAt(i) !== b.charAt(i)) distance++
  }
  return distance
}

/** Longer of the shared prefix and the shared suffix. */
function sharedEnds(a: string, b: string): number {
  let prefix = 0
  while (prefix < a.length && a.charAt(prefix) === b.charAt(prefix)) prefix++
  let suffix = 0
  while (suffix < a.length && a.charAt(a.length - 1 - suffix) === b.charAt(b.length - 1 - suffix)) suffix++
  return Math.max(prefix, suffix)
}

/** Closeness of a candidate to the target — higher is closer. */
function score(target: string, candidate: string): number {
  let total = 0
  if (prettyIdShape(candidate) === prettyIdShape(target)) total += SCORE_SAME_SHAPE
  if (classifyPrettyId(candidate) === classifyPrettyId(target)) total += SCORE_SAME_TIER
  const targetBlock = prettyIdRepeatBlock(target)
  const candidateBlock = prettyIdRepeatBlock(candidate)
  if (targetBlock && candidateBlock && targetBlock.length === candidateBlock.length) total += SCORE_SAME_BLOCK_LENGTH
  if (isPrettyIdRun(target) && isPrettyIdRun(candidate)) total += SCORE_BOTH_RUNS
  if (isPrettyIdMirror(target) && isPrettyIdMirror(candidate)) total += SCORE_BOTH_MIRRORS
  total -= hammingDistance(target, candidate) * SCORE_PER_DIFFERING_DIGIT
  total += sharedEnds(target, candidate) * SCORE_PER_SHARED_END_DIGIT
  return total
}

// ========================================
// Candidates
// ========================================

/** Fill a letter shape with digits (each distinct letter takes the next digit). */
function fillShape(shape: string, digits: string): string {
  const mapping = new Map<string, string>()
  let next = 0
  for (const letter of shape) {
    if (!mapping.has(letter)) mapping.set(letter, digits.charAt(next++))
  }
  return [...shape].map(letter => mapping.get(letter) ?? '').join('')
}

/** 1) The target's own shape with other digits (AAAAAA → 666666, ABCABC → 123123) when its alphabet is small. */
function addSameShapeCandidates(target: string, out: Set<string>): void {
  const shape = prettyIdShape(target)
  const alphabet = new Set(shape).size
  if (alphabet > MAX_SHAPE_ALPHABET) return
  const fill = (prefix: string): void => {
    if (prefix.length === alphabet) {
      out.add(fillShape(shape, prefix))
      return
    }
    for (const digit of DIGITS) {
      if (!prefix.includes(digit)) fill(prefix + digit)
    }
  }
  fill('')
}

/** 2) Ascending and descending sequences of the same length. */
function addSequenceCandidates(length: number, out: Set<string>): void {
  for (let start = 0; start < DIGIT_COUNT; start++) {
    let ascending = ''
    let descending = ''
    for (let i = 0; i < length; i++) {
      ascending += (start + i) % DIGIT_COUNT
      descending += (start - i + DIGIT_COUNT) % DIGIT_COUNT
    }
    if (isPrettyIdRun(ascending)) out.add(ascending)
    if (isPrettyIdRun(descending)) out.add(descending)
  }
}

/** 3) Repeated block: tweak one digit of the block in every copy (520520 → 521521) or in one copy (520521). */
function addRepeatCandidates(target: string, out: Set<string>): void {
  const block = prettyIdRepeatBlock(target)
  if (!block) return
  const copies = target.length / block.length
  for (let i = 0; i < block.length; i++) {
    for (let digit = 0; digit < DIGIT_COUNT; digit++) {
      const tweaked = block.slice(0, i) + digit + block.slice(i + 1)
      out.add(tweaked.repeat(copies))
      for (let copy = 0; copy < copies; copy++) {
        out.add(block.repeat(copy) + tweaked + block.repeat(copies - copy - 1))
      }
    }
  }
}

/** 4) Mirror: change a symmetric pair (123321 → 124421). */
function addMirrorCandidates(target: string, out: Set<string>): void {
  if (!isPrettyIdMirror(target)) return
  const last = target.length - 1
  for (let i = 0; i < Math.floor(target.length / 2); i++) {
    for (let digit = 0; digit < DIGIT_COUNT; digit++) {
      const chars = [...target]
      chars[i] = String(digit)
      chars[last - i] = String(digit)
      out.add(chars.join(''))
    }
  }
}

/** 5) Same ID with a single digit changed (888888 → 888889, 588888). */
function addNeighbourCandidates(target: string, out: Set<string>): void {
  for (let i = 0; i < target.length; i++) {
    for (let digit = 0; digit < DIGIT_COUNT; digit++) {
      const chars = [...target]
      chars[i] = String(digit)
      out.add(chars.join(''))
    }
  }
}

/** Candidate IDs sharing the target's pattern. Bounded (a few thousand), no I/O. */
function candidates(target: string): string[] {
  const out = new Set<string>()
  addSameShapeCandidates(target, out)
  addSequenceCandidates(target.length, out)
  addRepeatCandidates(target, out)
  addMirrorCandidates(target, out)
  addNeighbourCandidates(target, out)
  out.delete(target)
  return [...out].filter(candidate => candidate.length === target.length)
}

// ========================================
// Suggest
// ========================================

/**
 * Up to `limit` AVAILABLE IDs closest in pattern to `target`, best first. `isAvailable`
 * is the caller's ownership check; reserved, auction-only and malformed
 * candidates are dropped here. Ties on score break by ascending ID, so the result is
 * deterministic.
 */
export function suggestPrettyIds(
  target: string,
  isAvailable: (id: string) => boolean,
  limit: number,
): PrettyIdItem[] {
  const ranked = candidates(target)
    .filter(id => !isPrettyIdAuctionNumber(id))
    .filter(id => validatePrettyId(id, target.length) === null)
    .map(id => ({ id, score: score(target, id) }))
    .filter(entry => entry.score > SCORE_CUTOFF)
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))

  const picked: PrettyIdItem[] = []
  for (const { id } of ranked) {
    if (picked.length >= limit) break
    if (isAvailable(id)) picked.push({ id, tier: classifyPrettyId(id) })
  }
  return picked
}
