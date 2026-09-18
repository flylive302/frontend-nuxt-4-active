// ========================================
// Purchase Journal — store transactions the backend has not settled yet
// ========================================
// in-app-purchase/09. The store's own list is not a safe outbox on iOS: the
// billing plugin's `Transaction.updates` listener finishes a transaction
// itself before our backend has credited it, and StoreKit hides finished
// consumables from `Transaction.all` (before iOS 18, or without
// SKIncludeConsumableInAppPurchaseHistory). One failed verify after that
// point used to leave nothing anywhere to retry — a paid purchase, lost.
//
// So the app writes every store transaction it sees here BEFORE the verify
// call, and removes it only when the backend answers `finish: true`. Restore
// re-submits what is left. Each entry remembers the buyer: another account
// signed in on the same device never re-submits it (the backend credits a
// first-seen transaction to whoever asks).
//
// The settled list lets restore skip transactions the backend already
// settled — on iOS 18+ StoreKit lists every finished consumable ever bought.
//
// localStorage, like the persisted session. Every access is guarded: blocked
// or full storage degrades to "no journal", never to an error in a purchase.
// Low-level infra: no stores, no Vue, no UI.
// ========================================

import {
  IAP_JOURNAL_MAX_AGE_MS,
  IAP_JOURNAL_MAX_ENTRIES,
  IAP_JOURNAL_MAX_SETTLED,
  IAP_JOURNAL_STORAGE_KEY,
} from '~/constants/economy/iapConstants'
import type { IapStore, StoreTransaction } from '~/types/economy/iap'
import { createLogger } from '~/utils/logger'

const log = createLogger('[PurchaseJournal]')

export type JournalStorage = Pick<Storage, 'getItem' | 'setItem'>

export interface JournalEntry {
  store: IapStore
  /** The signed-in user when the store took payment — the only account that re-submits it. */
  userId: number
  /** Epoch ms of the first sighting; drives the age limit. */
  savedAt: number
  tx: StoreTransaction
}

/** One read of the journal for one store, so a caller filters many transactions against it without re-reading storage. */
export interface JournalSnapshot {
  /** Oldest first. */
  unsettled: JournalEntry[]
  settledIds: Set<string>
}

export interface PurchaseJournal {
  /** Remember `tx` for `userId` until the backend settles it. Idempotent per store + id; already-settled ids are ignored. */
  record(store: IapStore, userId: number, tx: StoreTransaction): void
  /** The backend answered `finish: true`: forget the transaction and remember that it is done. */
  settle(store: IapStore, id: string): void
  snapshot(store: IapStore): JournalSnapshot
}

interface JournalState {
  entries: JournalEntry[]
  /** `store:id`, oldest first. */
  settled: string[]
}

function settledKey(store: IapStore, id: string): string {
  return `${store}:${id}`
}

function isJournalEntry(value: unknown): value is JournalEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<JournalEntry>
  return (entry.store === 'apple' || entry.store === 'google')
    && typeof entry.userId === 'number'
    && typeof entry.savedAt === 'number'
    && !!entry.tx
    && typeof entry.tx.id === 'string'
    && entry.tx.id !== ''
    && typeof entry.tx.productId === 'string'
}

function defaultStorage(): JournalStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function createPurchaseJournal(
  storage: JournalStorage | null = defaultStorage(),
  now: () => number = Date.now,
): PurchaseJournal {
  function read(): JournalState {
    const empty: JournalState = { entries: [], settled: [] }
    if (!storage) return empty

    try {
      const raw = storage.getItem(IAP_JOURNAL_STORAGE_KEY)
      if (!raw) return empty

      const parsed = JSON.parse(raw) as Partial<JournalState> | null
      return {
        entries: Array.isArray(parsed?.entries) ? parsed.entries.filter(isJournalEntry) : [],
        settled: Array.isArray(parsed?.settled) ? parsed.settled.filter((k): k is string => typeof k === 'string') : [],
      }
    } catch (error) {
      log.warn('Unreadable purchase journal — starting empty', error)
      return empty
    }
  }

  /**
   * Age limit + size caps. An entry dropped for age is logged: a paid purchase
   * the backend could not settle in that long needs support (the backend keeps
   * its own pending row for admin Re-verify).
   */
  function prune(state: JournalState): JournalState {
    const cutoff = now() - IAP_JOURNAL_MAX_AGE_MS
    const expired = state.entries.filter(entry => entry.savedAt < cutoff)
    if (expired.length > 0) {
      log.warn('Dropping unsettled purchases past the journal age limit', expired.map(e => settledKey(e.store, e.tx.id)))
    }

    return {
      entries: state.entries.filter(entry => entry.savedAt >= cutoff).slice(-IAP_JOURNAL_MAX_ENTRIES),
      settled: state.settled.slice(-IAP_JOURNAL_MAX_SETTLED),
    }
  }

  function write(state: JournalState): void {
    if (!storage) return

    try {
      storage.setItem(IAP_JOURNAL_STORAGE_KEY, JSON.stringify(prune(state)))
    } catch (error) {
      log.warn('Failed to write purchase journal', error)
    }
  }

  return {
    record(store, userId, tx) {
      if (!tx.id) return

      const state = read()
      if (state.settled.includes(settledKey(store, tx.id))) return

      const existing = state.entries.find(entry => entry.store === store && entry.tx.id === tx.id)
      if (existing) {
        // First owner and first sighting stand; only fill in a JWS the earlier copy lacked.
        if (!existing.tx.jws && tx.jws) existing.tx = { ...existing.tx, jws: tx.jws }
      } else {
        state.entries.push({ store, userId, savedAt: now(), tx })
      }

      write(state)
    },

    settle(store, id) {
      if (!id) return

      const state = read()
      const key = settledKey(store, id)
      state.entries = state.entries.filter(entry => !(entry.store === store && entry.tx.id === id))
      if (!state.settled.includes(key)) state.settled.push(key)

      write(state)
    },

    snapshot(store) {
      const state = prune(read())
      const prefix = `${store}:`

      return {
        unsettled: state.entries.filter(entry => entry.store === store),
        settledIds: new Set(state.settled.filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length))),
      }
    },
  }
}
