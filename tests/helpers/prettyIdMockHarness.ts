// ========================================
// Pretty ID mock backend — shared test harness
// ========================================
//
// The mock keeps no state in memory: every call loads from localStorage, so the
// specs stub localStorage and read it back to prove persistence. System time is
// pinned (built from LOCAL parts) so `server_now` is predictable.
//
// Each spec file must call `useMockBackendEnvironment()` once at its top level and
// keep its own `vi.mock('~/utils/logger', ...)` (mocks are hoisted per file).

import { afterEach, beforeEach, vi } from 'vitest'
import { createPrettyIdMockApi } from '~/services/prettyIdMockApi'
import { PRETTY_ID_MOCK_STORAGE_KEY } from '~/services/prettyIdMock/state'
import type { PrettyIdApi, PrettyIdMockProfile } from '~/types/pretty-id'
import { PrettyIdApiError } from '~/utils/pretty-id-error'

// ========================================
// Fixtures
// ========================================

export const PROFILE: PrettyIdMockProfile = { id: 4242 }

/** Wednesday 2026-11-18 12:00, device-local. */
export const NOON = new Date(2026, 10, 18, 12, 0, 0, 0).getTime()

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
// Builders & assertions
// ========================================

export interface Harness {
  api: PrettyIdApi
  storage: MemoryStorage
}

/** A mock backend for `PROFILE`. */
export function make(): Harness {
  return { api: createPrettyIdMockApi(PROFILE), storage }
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

export interface StoredData {
  version: number
  owner_id: number
  level: number
}

/** The persisted blob, parsed. */
export function stored(): StoredData {
  const raw = storage.getItem(PRETTY_ID_MOCK_STORAGE_KEY)
  if (raw === null) throw new Error('nothing was persisted')
  return JSON.parse(raw) as StoredData
}

/** Sets the persisted user level (seeds the blob first if nothing was saved yet). */
export async function setLevel(api: PrettyIdApi, level: number): Promise<void> {
  await api.me()
  storage.setItem(PRETTY_ID_MOCK_STORAGE_KEY, JSON.stringify({ ...stored(), level }))
}
