// ========================================
// Pretty ID mock backend — persisted state
// ========================================
//
// The data model, its schema version, and the guarded localStorage load / save.

import type { PrettyIdSlotKey } from '~/types/pretty-id'
import { createLogger } from '~/utils/logger'

const log = createLogger('[PrettyIdMock]')

// ========================================
// Constants
// ========================================

export const PRETTY_ID_MOCK_STORAGE_KEY = 'flylive.prettyId.mock.v2'
export const PRETTY_ID_MOCK_VERSION = 2

// ========================================
// Model
// ========================================

/** Who owns a claimed ID: the signed-in user, or a fictional other user. */
export type MockOwner = 'me' | 'other'

export interface MockSlot {
  id: string
}

export interface MockData {
  version: number
  /** Profile id the data was seeded for — a different signed-in user reseeds. */
  owner_id: number
  level: number
  slots: Partial<Record<PrettyIdSlotKey, MockSlot>>
  /** Claimed ID → owner. */
  owned: Record<string, MockOwner>
}

/** What every operation works on: the loaded data. */
export interface MockCtx {
  data: MockData
}

// ========================================
// Persistence (localStorage, guarded)
// ========================================

/** Last snapshot whose localStorage write failed (private mode / quota); newer than storage. */
let memoryFallback: string | null = null
let warnedStorage = false

function warnStorageOnce(error: unknown): void {
  if (warnedStorage) return
  warnedStorage = true
  log.warn('localStorage unavailable — keeping mock state in memory only', error)
}

function readStorage(): string | null {
  if (memoryFallback !== null) return memoryFallback
  try {
    return globalThis.localStorage.getItem(PRETTY_ID_MOCK_STORAGE_KEY)
  } catch (error) {
    warnStorageOnce(error)
    return null
  }
}

function writeStorage(json: string): void {
  try {
    globalThis.localStorage.setItem(PRETTY_ID_MOCK_STORAGE_KEY, json)
    memoryFallback = null
  } catch (error) {
    warnStorageOnce(error)
    memoryFallback = json
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Shallow structural check — enough to refuse a hand-edited or old-schema blob. */
function isMockData(value: unknown): value is MockData {
  if (!isRecord(value)) return false
  return value.version === PRETTY_ID_MOCK_VERSION
    && typeof value.owner_id === 'number'
    && typeof value.level === 'number'
    && isRecord(value.slots) && isRecord(value.owned)
}

function parseStored(json: string | null): unknown {
  if (json === null) return null
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** Stored data for `ownerId`; `null` when missing / unreadable / old-schema / someone else's. */
export function loadStoredData(ownerId: number): MockData | null {
  const stored = parseStored(readStorage())
  return isMockData(stored) && stored.owner_id === ownerId ? stored : null
}

export function saveMockData(data: MockData): void {
  writeStorage(JSON.stringify(data))
}
