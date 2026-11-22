// ========================================
// Pretty ID mock backend — shared test harness
// ========================================
//
// The mock keeps no state in memory: every call loads from localStorage, so the
// specs stub localStorage and read it back to prove persistence. System time is
// pinned (built from LOCAL parts, mid-month and mid-week) and the RNG is always
// injected: the default one throws, so any unexpected rival-bot dice roll fails
// loudly, and scripted queues throw when exhausted.
//
// Each spec file must call `useMockBackendEnvironment()` once at its top level and
// keep its own `vi.mock('~/utils/logger', ...)` (mocks are hoisted per file).

import { afterEach, beforeEach, vi } from 'vitest'
import { createPrettyIdMockApi } from '~/services/prettyIdMockApi'
import { PRETTY_ID_MOCK_STORAGE_KEY } from '~/services/prettyIdMock/state'
import type { PrettyIdApi, PrettyIdLot, PrettyIdMockControls, PrettyIdMockProfile } from '~/types/pretty-id'
import { PrettyIdApiError } from '~/utils/pretty-id-error'

// ========================================
// Fixtures
// ========================================

export const SECOND = 1_000
export const MINUTE = 60 * SECOND
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

export const PROFILE: PrettyIdMockProfile = { id: 4242, name: 'Tester', avatar_url: 'https://example.test/me.webp' }

/** Wednesday 2026-11-18 12:00, device-local. */
export const NOON = new Date(2026, 10, 18, 12, 0, 0, 0).getTime()

export const START_COINS = 5_000_000
export const OPENING_BID = 1_200_000
export const MIN_INCREMENT = 50_000
export const ENTRY_FEE = 2_000
export const SEEDED_LOT_NUMBERS = [7, 8, 9, 66, 88, 99]
/** Lot 7 closes this long after NOON (66 h). */
export const LOT_7_ENDS_AFTER = 66 * HOUR

// ========================================
// Storage & environment
// ========================================

export class MemoryStorage {
  private readonly items = new Map<string, string>()
  getItem(key: string): string | null { return this.items.get(key) ?? null }
  setItem(key: string, value: string): void { this.items.set(key, value) }
  removeItem(key: string): void { this.items.delete(key) }
  clear(): void { this.items.clear() }
}

let storage = new MemoryStorage()

/** The localStorage stub installed for the running test. */
export function currentStorage(): MemoryStorage {
  return storage
}

/** Pin the clock to `NOON` and give every test a fresh, empty localStorage stub. */
export function useMockBackendEnvironment(): void {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOON)
    storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
}

// ========================================
// RNG
// ========================================

/** An RNG that must not be consulted. */
export function unusedRandom(): number {
  throw new Error('the RNG was consulted but this test expects no dice roll')
}

/** An RNG that replays `values` in order and throws once they run out. */
export function scriptedRandom(values: number[]): { random: () => number, remaining: () => number } {
  const queue = [...values]
  return {
    random: () => {
      const next = queue.shift()
      if (next === undefined) throw new Error('scripted RNG exhausted — more draws than expected')
      return next
    },
    remaining: () => queue.length,
  }
}

// ========================================
// Builders & assertions
// ========================================

export interface Harness {
  api: PrettyIdApi
  controls: PrettyIdMockControls
  storage: MemoryStorage
}

/** A mock backend for `PROFILE`; the default RNG throws if the bots try to roll. */
export function make(random: () => number = unusedRandom): Harness {
  const { api, controls } = createPrettyIdMockApi(PROFILE, { random })
  return { api, controls, storage }
}

/** Run `promise` and return the `PrettyIdApiError` it was refused with. */
export async function refusal(promise: Promise<unknown>): Promise<PrettyIdApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof PrettyIdApiError) return error
    throw error
  }
  throw new Error('expected the call to be refused')
}

export async function lotOf(api: PrettyIdApi, number: number): Promise<PrettyIdLot> {
  return api.auction(number)
}

export interface StoredData {
  version: number
  owner_id: number
  base_bid: Record<string, number>
}

/** The persisted blob, parsed. */
export function stored(): StoredData {
  const raw = storage.getItem(PRETTY_ID_MOCK_STORAGE_KEY)
  if (raw === null) throw new Error('nothing was persisted')
  return JSON.parse(raw) as StoredData
}
