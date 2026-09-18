// ========================================
// Purchase Journal Tests
// ========================================
// `createPurchaseJournal` is the durable outbox for store transactions the
// backend has not settled yet (see services/iap/purchase-journal.ts). These
// tests drive it against an in-memory storage double — `environment: 'node'`
// has no global `localStorage` to stub.
// ========================================

import { describe, it, expect, vi } from 'vitest'
import { createPurchaseJournal, type JournalStorage } from '~/services/iap/purchase-journal'
import {
  IAP_JOURNAL_MAX_AGE_MS,
  IAP_JOURNAL_MAX_ENTRIES,
  IAP_JOURNAL_MAX_SETTLED,
  IAP_JOURNAL_STORAGE_KEY,
} from '~/constants/economy/iapConstants'
import type { StoreTransaction } from '~/types/economy/iap'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

// ========================================
// Fixtures
// ========================================

function createMemoryStorage(): JournalStorage {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
  }
}

function makeTx(id: string, overrides: Partial<StoreTransaction> = {}): StoreTransaction {
  return { id, jws: `jws-${id}`, productId: 'coins_100', pending: false, ...overrides }
}

// ========================================
// Tests
// ========================================

describe('createPurchaseJournal', () => {
  it('round-trips record → snapshot → settle → snapshot', () => {
    const journal = createPurchaseJournal(createMemoryStorage(), () => 1_000)

    journal.record('apple', 7, makeTx('tx-1'))
    let snap = journal.snapshot('apple')
    expect(snap.unsettled).toHaveLength(1)
    expect(snap.unsettled[0]!.tx.id).toBe('tx-1')
    expect(snap.unsettled[0]!.userId).toBe(7)
    expect(snap.settledIds.size).toBe(0)

    journal.settle('apple', 'tx-1')
    snap = journal.snapshot('apple')
    expect(snap.unsettled).toHaveLength(0)
    expect(snap.settledIds.has('tx-1')).toBe(true)
  })

  it('record is idempotent: first owner + first sighting stand, a missing jws gets filled in', () => {
    let now = 1_000
    const journal = createPurchaseJournal(createMemoryStorage(), () => now)

    journal.record('apple', 7, makeTx('tx-1', { jws: undefined }))
    now = 2_000
    journal.record('apple', 99, makeTx('tx-1', { jws: 'jws-late' }))

    const snap = journal.snapshot('apple')
    expect(snap.unsettled).toHaveLength(1)
    expect(snap.unsettled[0]!.userId).toBe(7)
    expect(snap.unsettled[0]!.savedAt).toBe(1_000)
    expect(snap.unsettled[0]!.tx.jws).toBe('jws-late')
  })

  it('record ignores an id that is already settled', () => {
    const journal = createPurchaseJournal(createMemoryStorage(), () => 1_000)

    journal.record('apple', 7, makeTx('tx-1'))
    journal.settle('apple', 'tx-1')
    journal.record('apple', 7, makeTx('tx-1'))

    const snap = journal.snapshot('apple')
    expect(snap.unsettled).toHaveLength(0)
    expect(snap.settledIds.has('tx-1')).toBe(true)
  })

  it('keeps apple and google separate for the same transaction id', () => {
    const journal = createPurchaseJournal(createMemoryStorage(), () => 1_000)

    journal.record('apple', 7, makeTx('same-id'))
    journal.record('google', 7, makeTx('same-id'))
    journal.settle('apple', 'same-id')

    expect(journal.snapshot('apple').unsettled).toHaveLength(0)
    expect(journal.snapshot('apple').settledIds.has('same-id')).toBe(true)
    expect(journal.snapshot('google').unsettled).toHaveLength(1)
    expect(journal.snapshot('google').settledIds.has('same-id')).toBe(false)
  })

  it('prunes an entry older than the age limit out of the snapshot', () => {
    let now = 1_000
    const journal = createPurchaseJournal(createMemoryStorage(), () => now)

    journal.record('apple', 7, makeTx('tx-1'))
    now = 1_000 + IAP_JOURNAL_MAX_AGE_MS + 1

    expect(journal.snapshot('apple').unsettled).toHaveLength(0)
  })

  it('keeps an entry saved within the age limit', () => {
    let now = 1_000
    const journal = createPurchaseJournal(createMemoryStorage(), () => now)

    journal.record('apple', 7, makeTx('tx-1'))
    now = 1_000 + IAP_JOURNAL_MAX_AGE_MS - 1

    expect(journal.snapshot('apple').unsettled).toHaveLength(1)
  })

  it('caps unsettled entries at IAP_JOURNAL_MAX_ENTRIES, dropping the oldest', () => {
    const storage = createMemoryStorage()
    const seeded = Array.from({ length: IAP_JOURNAL_MAX_ENTRIES }, (_, i) => ({
      store: 'apple',
      userId: 7,
      savedAt: i,
      tx: { id: `tx-${i}`, productId: 'coins_100' },
    }))
    storage.setItem(IAP_JOURNAL_STORAGE_KEY, JSON.stringify({ entries: seeded, settled: [] }))
    const journal = createPurchaseJournal(storage, () => 100_000)

    journal.record('apple', 7, makeTx('tx-new'))

    const snap = journal.snapshot('apple')
    expect(snap.unsettled).toHaveLength(IAP_JOURNAL_MAX_ENTRIES)
    expect(snap.unsettled.some(entry => entry.tx.id === 'tx-0')).toBe(false)
    expect(snap.unsettled.some(entry => entry.tx.id === 'tx-1')).toBe(true)
    expect(snap.unsettled.some(entry => entry.tx.id === 'tx-new')).toBe(true)
  })

  it('caps settled ids at IAP_JOURNAL_MAX_SETTLED, dropping the oldest', () => {
    const storage = createMemoryStorage()
    const seeded = Array.from({ length: IAP_JOURNAL_MAX_SETTLED }, (_, i) => `apple:tx-${i}`)
    storage.setItem(IAP_JOURNAL_STORAGE_KEY, JSON.stringify({ entries: [], settled: seeded }))
    const journal = createPurchaseJournal(storage, () => 1_000)

    journal.settle('apple', 'tx-new')

    const snap = journal.snapshot('apple')
    expect(snap.settledIds.size).toBe(IAP_JOURNAL_MAX_SETTLED)
    expect(snap.settledIds.has('tx-0')).toBe(false)
    expect(snap.settledIds.has('tx-1')).toBe(true)
    expect(snap.settledIds.has('tx-new')).toBe(true)
  })

  it('corrupt JSON in storage → empty snapshot, no throw', () => {
    const storage = createMemoryStorage()
    storage.setItem(IAP_JOURNAL_STORAGE_KEY, '{not json')
    const journal = createPurchaseJournal(storage, () => 1_000)

    expect(() => journal.snapshot('apple')).not.toThrow()
    const snap = journal.snapshot('apple')
    expect(snap.unsettled).toHaveLength(0)
    expect(snap.settledIds.size).toBe(0)
  })

  it('storage whose getItem/setItem throw → no throw, behaves as empty', () => {
    const throwingStorage: JournalStorage = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    }
    const journal = createPurchaseJournal(throwingStorage, () => 1_000)

    expect(() => journal.record('apple', 7, makeTx('tx-1'))).not.toThrow()
    expect(() => journal.settle('apple', 'tx-1')).not.toThrow()
    let snap: ReturnType<typeof journal.snapshot> | undefined
    expect(() => { snap = journal.snapshot('apple') }).not.toThrow()
    expect(snap!.unsettled).toHaveLength(0)
    expect(snap!.settledIds.size).toBe(0)
  })

  it('null storage → every call is a safe no-op', () => {
    const journal = createPurchaseJournal(null, () => 1_000)

    expect(() => journal.record('apple', 7, makeTx('tx-1'))).not.toThrow()
    expect(() => journal.settle('apple', 'tx-1')).not.toThrow()
    const snap = journal.snapshot('apple')
    expect(snap.unsettled).toHaveLength(0)
    expect(snap.settledIds.size).toBe(0)
  })

  it('filters out malformed entries and settled keys on read', () => {
    const storage = createMemoryStorage()
    storage.setItem(IAP_JOURNAL_STORAGE_KEY, JSON.stringify({
      entries: [
        { store: 'apple', userId: 7, savedAt: 1000, tx: { id: 'ok-1', productId: 'coins_100' } }, // valid
        { store: 'apple', userId: 7, savedAt: 1000, tx: { id: '', productId: 'coins_100' } }, // empty tx id
        { store: 'apple', userId: '7', savedAt: 1000, tx: { id: 'bad-2', productId: 'coins_100' } }, // userId not a number
        { store: 'bogus', userId: 7, savedAt: 1000, tx: { id: 'bad-3', productId: 'coins_100' } }, // unknown store
        { store: 'apple', userId: 7, savedAt: 1000, tx: { id: 'bad-4' } }, // missing productId
        { store: 'apple', userId: 7, tx: { id: 'bad-5', productId: 'coins_100' } }, // missing savedAt
        null,
        'garbage',
      ],
      settled: ['apple:settled-1', 42, null],
    }))
    const journal = createPurchaseJournal(storage, () => 1_000)

    const snap = journal.snapshot('apple')
    expect(snap.unsettled.map(entry => entry.tx.id)).toEqual(['ok-1'])
    expect(snap.settledIds.size).toBe(1)
    expect(snap.settledIds.has('settled-1')).toBe(true)
  })

  it('record on a transaction with no id is a no-op', () => {
    const journal = createPurchaseJournal(createMemoryStorage(), () => 1_000)

    journal.record('apple', 7, makeTx(''))

    expect(journal.snapshot('apple').unsettled).toHaveLength(0)
  })
})
