// ========================================
// Playlist Track Store (IndexedDB) — room-music-playlist/01
// ========================================
//
// Device-local copy of the DJ's picked songs so the Playlist survives the app
// process dying (swipe-kill, OOM, WebView renderer kill, OTA bundle swap). The
// picked `File` is stored as-is: structured clone copies the blob bytes into
// IndexedDB — no `arrayBuffer()` read on the main thread, no worker. Proven on
// the A6x (Android WebView, Chrome 156) 2026-11-09: bytes intact and decodable
// after a force-stop.
//
// Two object stores so metadata writes (reorder, last-played) never rewrite or
// re-copy the blob:
//   tracks — SavedTrackRecord, keyPath `key`, index `userId`
//   blobs  — the File itself, out-of-line key = the record's `key`
//
// Service rules: no store imports (callers pass `userId`), no UI. Every public
// function RESOLVES — failures are logged and mapped to a neutral value — so a
// device without IndexedDB (private mode, SSR, tests) silently degrades to the
// old session-only Playlist. Open/upgrade/stale-connection handling mirrors
// `assetIndex.ts`; the database is separate (`PLAYLIST_IDB_NAME`).
// ========================================

import { PLAYLIST_IDB_NAME, PLAYLIST_IDB_VERSION } from '~/constants/room'
import { createLogger } from '~/utils/logger'

const log = createLogger('[PlaylistTrackStore]')

const TRACKS_STORE = 'tracks'
const BLOBS_STORE = 'blobs'
const USER_INDEX = 'userId'

/** Metadata for one saved song. The bytes live in the `blobs` store under `key`. */
export interface SavedTrackRecord {
  /** Storage key (random UUID minted at add time) — NOT the queue's track id. */
  key: string
  /** Owning account (stringified user id) — one device may hold several accounts. */
  userId: string
  name: string
  type: string
  size: number
  /** Queue order for restore; rewritten after every reorder/remove. */
  position: number
  addedAt: number
  lastPlayedAt: number | null
}

/**
 * A saved song ready to re-enter the queue. `file` is `null` when the record's
 * bytes are gone (storage evicted under the record) — the caller shows the row
 * as unavailable so the DJ can see what was lost and remove it.
 */
export interface SavedTrack {
  record: SavedTrackRecord
  file: File | null
}

/** Outcome of a save — the caller decides what (if anything) to tell the user. */
export type SaveTrackResult = 'saved' | 'quota' | 'unavailable' | 'error'

// ========================================
// Database
// ========================================

let dbPromise: Promise<IDBDatabase> | null = null

/** Whether this runtime has IndexedDB at all (false in SSR/tests without a shim). */
export function isPlaylistStorageAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDatabase(): Promise<IDBDatabase> {
  if (!isPlaylistStorageAvailable()) {
    return Promise.reject(new Error('IndexedDB not available'))
  }
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(PLAYLIST_IDB_NAME, PLAYLIST_IDB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(TRACKS_STORE)) {
        const tracks = db.createObjectStore(TRACKS_STORE, { keyPath: 'key' })
        tracks.createIndex(USER_INDEX, 'userId', { unique: false })
      }
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE)
      }
    }

    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      db.onclose = () => {
        dbPromise = null
      }
      resolve(db)
    }

    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })

  // A failed open must not poison every later call for the rest of the session.
  dbPromise.catch(() => { dbPromise = null })
  return dbPromise
}

/** Open a transaction, retrying once on a stale (closed) connection — as assetIndex does. */
async function transaction(stores: string[], mode: IDBTransactionMode): Promise<IDBTransaction> {
  const db = await openDatabase()
  try {
    return db.transaction(stores, mode)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'InvalidStateError') {
      dbPromise = null
      const fresh = await openDatabase()
      return fresh.transaction(stores, mode)
    }
    throw e
  }
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Resolve when the transaction commits; reject with its error on error/abort. */
function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'))
  })
}

function isQuotaError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'QuotaExceededError'
}

/** A stored blob normally round-trips as a `File`; wrap a bare Blob (no byte copy). */
function asFile(blob: Blob, record: SavedTrackRecord): File {
  if (blob instanceof File) return blob
  return new File([blob], record.name, { type: record.type })
}

// ========================================
// Public API
// ========================================

/**
 * Every saved song for `userId`, in queue order (ties broken by `addedAt`),
 * with its File handle. Reading the blob from IndexedDB returns a lazy handle —
 * no bytes are read here; the playback engine reads them on decode. A record
 * whose blob is missing comes back with `file: null`.
 *
 * Returns `null` when the read itself failed (vs `[]` for "nothing saved"), so
 * the caller can retry later instead of treating the account as empty. Without
 * IndexedDB at all it returns `[]` — the feature is simply off.
 */
export async function listSavedTracks(userId: string): Promise<SavedTrack[] | null> {
  if (!isPlaylistStorageAvailable()) return []
  try {
    const tx = await transaction([TRACKS_STORE, BLOBS_STORE], 'readonly')
    const records = await promisifyRequest<SavedTrackRecord[]>(
      tx.objectStore(TRACKS_STORE).index(USER_INDEX).getAll(userId),
    )
    records.sort((a, b) => a.position - b.position || a.addedAt - b.addedAt)

    const blobs = tx.objectStore(BLOBS_STORE)
    const out: SavedTrack[] = []
    for (const record of records) {
      const blob = await promisifyRequest<Blob | undefined>(blobs.get(record.key))
      if (!(blob instanceof Blob)) log.warn('Saved track has no blob', record.key)
      out.push({ record, file: blob instanceof Blob ? asFile(blob, record) : null })
    }
    return out
  } catch (e) {
    log.warn('Failed to list saved tracks', e)
    return null
  }
}

/** Metadata for every saved song on the device (all accounts) — for the byte budget. */
export async function listAllRecords(): Promise<SavedTrackRecord[]> {
  try {
    const tx = await transaction([TRACKS_STORE], 'readonly')
    return await promisifyRequest<SavedTrackRecord[]>(tx.objectStore(TRACKS_STORE).getAll())
  } catch (e) {
    log.warn('Failed to list saved track records', e)
    return []
  }
}

/** Save one song (metadata + bytes) atomically. */
export async function saveTrack(record: SavedTrackRecord, file: Blob): Promise<SaveTrackResult> {
  if (!isPlaylistStorageAvailable()) return 'unavailable'
  let tx: IDBTransaction | null = null
  try {
    tx = await transaction([TRACKS_STORE, BLOBS_STORE], 'readwrite')
    const done = transactionDone(tx)
    done.catch(() => {}) // observed below; avoid an unhandled rejection if put() throws first
    tx.objectStore(TRACKS_STORE).put(record)
    tx.objectStore(BLOBS_STORE).put(file, record.key)
    await done
    return 'saved'
  } catch (e) {
    // A synchronous put() throw does not abort the transaction by itself — abort
    // so the metadata row never commits without its bytes (it would count
    // against the byte budget forever while `listSavedTracks` skips it).
    try { tx?.abort() } catch { /* already finished/aborted */ }
    if (isQuotaError(e)) {
      log.warn('Saved-track write hit the storage quota', record.key)
      return 'quota'
    }
    log.warn('Failed to save track', e)
    return 'error'
  }
}

/** Delete saved songs (metadata + bytes). Unknown keys are a no-op. */
export async function deleteTracks(keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return
  try {
    const tx = await transaction([TRACKS_STORE, BLOBS_STORE], 'readwrite')
    const tracks = tx.objectStore(TRACKS_STORE)
    const blobs = tx.objectStore(BLOBS_STORE)
    for (const key of keys) {
      tracks.delete(key)
      blobs.delete(key)
    }
    await transactionDone(tx)
  } catch (e) {
    log.warn('Failed to delete saved tracks', e)
  }
}

/** Rewrite `position` so restore reproduces `orderedKeys`. Metadata only. */
export async function writePositions(orderedKeys: readonly string[]): Promise<void> {
  if (orderedKeys.length === 0) return
  try {
    const tx = await transaction([TRACKS_STORE], 'readwrite')
    const tracks = tx.objectStore(TRACKS_STORE)
    for (const [position, key] of orderedKeys.entries()) {
      const record = await promisifyRequest<SavedTrackRecord | undefined>(tracks.get(key))
      if (record && record.position !== position) tracks.put({ ...record, position })
    }
    await transactionDone(tx)
  } catch (e) {
    log.warn('Failed to write saved track positions', e)
  }
}

/** Stamp a song as just played — drives least-recently-played eviction. */
export async function touchLastPlayed(key: string, at: number): Promise<void> {
  try {
    const tx = await transaction([TRACKS_STORE], 'readwrite')
    const tracks = tx.objectStore(TRACKS_STORE)
    const record = await promisifyRequest<SavedTrackRecord | undefined>(tracks.get(key))
    if (record) tracks.put({ ...record, lastPlayedAt: at })
    await transactionDone(tx)
  } catch (e) {
    log.warn('Failed to stamp saved track as played', e)
  }
}

/**
 * Ask the browser to make this origin's storage durable (exempt from eviction
 * under disk pressure). Best-effort: the A6x WebView answered `false`. Returns
 * `null` where the API is missing.
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return null
    return await navigator.storage.persist()
  } catch (e) {
    log.warn('navigator.storage.persist() failed', e)
    return null
  }
}

/** The origin quota in bytes from `navigator.storage.estimate()`, or `null` if unknown. */
export async function estimateQuotaBytes(): Promise<number | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
    const { quota } = await navigator.storage.estimate()
    return typeof quota === 'number' && quota > 0 ? quota : null
  } catch (e) {
    log.warn('navigator.storage.estimate() failed', e)
    return null
  }
}
