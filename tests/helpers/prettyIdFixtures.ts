// ========================================
// Pretty ID test fixtures
// ========================================
// Plain data builders + a vi.fn() stand-in for the `PrettyIdApi` seam. Specs
// mock `~/composables/pretty-id/usePrettyIdApi` with this.

import { vi } from 'vitest'
import type {
  PrettyIdCategory,
  PrettyIdClaimed,
  PrettyIdItem,
  PrettyIdListResponse,
  PrettyIdMe,
  PrettyIdTier,
  PrettyIdTierState,
} from '../../app/types/pretty-id'

export function makeClaimed(signature: string, category: PrettyIdCategory = 'lucky'): PrettyIdClaimed {
  return { signature, category, claimed_at: '2026-11-21T10:00:00.000Z' }
}

export function makeTier(tier: PrettyIdTier, overrides: Partial<PrettyIdTierState> = {}): PrettyIdTierState {
  return {
    tier,
    required_level: tier === 6 ? 17 : 34,
    unlocked: true,
    claimed: null,
    ...overrides,
  }
}

export interface TierOverrides {
  six?: Partial<PrettyIdTierState>
  four?: Partial<PrettyIdTierState>
}

/** Level 20: the 6-digit tier is unlocked and unclaimed, the 4-digit tier is locked. */
export function makeMe(overrides: Partial<PrettyIdMe> = {}, tiers: TierOverrides = {}): PrettyIdMe {
  return {
    wealth_level: 20,
    tiers: [
      makeTier(6, tiers.six),
      makeTier(4, { unlocked: false, ...tiers.four }),
    ],
    ...overrides,
  }
}

export function makeItem(signature: string, category: PrettyIdCategory = 'lucky'): PrettyIdItem {
  return { signature, category }
}

export function makeList(items: PrettyIdItem[], overrides: Partial<PrettyIdListResponse> = {}): PrettyIdListResponse {
  return { items, total: items.length, next_cursor: null, ...overrides }
}

/** One `vi.fn()` per `PrettyIdApi` method. Reset it in `beforeEach` with `resetApiMock`. */
export function createApiMock() {
  return {
    me: vi.fn(),
    list: vi.fn(),
    claim: vi.fn(),
  }
}

export type ApiMock = ReturnType<typeof createApiMock>

/** Clears every call and gives the methods that every flow touches a harmless default. */
export function resetApiMock(api: ApiMock): void {
  for (const fn of Object.values(api)) fn.mockReset()
  api.me.mockResolvedValue(makeMe())
  api.list.mockResolvedValue(makeList([]))
}

/** A promise the test settles by hand. */
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
