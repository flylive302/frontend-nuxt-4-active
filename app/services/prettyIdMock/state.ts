// ========================================
// Pretty ID mock backend — persisted state
// ========================================
//
// The data model, its schema version, and the guarded localStorage load / save.
// The model keeps raw epoch-ms numbers (mock-clock domain); only the mappers turn
// them into ISO strings. "Me" is the flag `'me'`, never an id or name — the card
// is resolved from the live profile at response time, so a rename needs no
// migration and no rival id can collide with a real user id (rivals are negative).

import type { PrettyIdSlotKey } from '~/types/pretty-id'
import { createLogger } from '~/utils/logger'

const log = createLogger('[PrettyIdMock]')

// ========================================
// Constants
// ========================================

export const PRETTY_ID_MOCK_STORAGE_KEY = 'flylive.prettyId.mock.v1'
export const PRETTY_ID_MOCK_VERSION = 1

// ========================================
// Model
// ========================================

/** Stored reference to a user: the live profile (`'me'`) or a fictional person's id. */
export type MockUserRef = 'me' | number

export interface MockBid {
  user: MockUserRef
  amount: number
  at: number
}

export interface MockLot {
  number: string
  starts_at: number
  ends_at: number
  entered: boolean
  ended: boolean
  /** Highest (newest) first. */
  bids: MockBid[]
  /** Mock-clock time of the last rival-bot dice roll; throttles `auction()`. */
  last_rival_roll_at: number
}

export interface MockSlot {
  id: string
  tokens: number
  claimed_at: number
  last_change_at: number
}

export interface MockHolding {
  id: string
  won_at: number
  expires_at: number
}

export interface MockWin {
  user: MockUserRef
  number: string
  amount: number
  at: number
}

export interface MockAllotment {
  id: number
  user: MockUserRef
  number: string
  week_start: number
  week_end: number
}

export interface MockBidLogEntry {
  amount: number
  at: number
}

export interface MockData {
  version: number
  /** Profile id the data was seeded for — a different signed-in user reseeds. */
  owner_id: number
  level: number
  coins: number
  offset_hours: number
  race_armed: boolean
  slots: Partial<Record<PrettyIdSlotKey, MockSlot>>
  holdings: MockHolding[]
  /** Claimed / won ID → owner. */
  owned: Record<string, MockUserRef>
  /** Released ID → mock-clock time its cooldown ends. */
  released: Record<string, number>
  lots: MockLot[]
  /** Newest first. */
  wins: MockWin[]
  /** Newest first. */
  allotments: MockAllotment[]
  bid_log: MockBidLogEntry[]
  /** Month key → coins bid before this session (the "everyone else" baseline). */
  base_bid: Record<string, number>
}

/** What every operation works on: the loaded data and the mock clock, fixed for one call. */
export interface MockCtx {
  data: MockData
  now: number
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
    && typeof value.coins === 'number'
    && typeof value.offset_hours === 'number'
    && typeof value.race_armed === 'boolean'
    && isRecord(value.slots) && isRecord(value.owned) && isRecord(value.released) && isRecord(value.base_bid)
    && Array.isArray(value.holdings) && Array.isArray(value.lots) && Array.isArray(value.wins)
    && Array.isArray(value.allotments) && Array.isArray(value.bid_log)
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
