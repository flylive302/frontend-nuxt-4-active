// ========================================
// Playlist Track Store (IndexedDB) Tests — room-music-playlist/01
// ========================================
//
// Runs the real service against `fake-indexeddb`. The service caches its
// database promise at module level, so every test re-imports a fresh module AND
// installs a brand-new `IDBFactory` — each test starts with an empty database.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'

import { PLAYLIST_IDB_NAME } from '~/constants/room'
import type { SavedTrackRecord } from '~/services/playlistTrackStore'

// ========================================
// Mocks
// ========================================

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }))

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() }),
}))

// ========================================
// Helpers
// ========================================

type Store = typeof import('~/services/playlistTrackStore')

/** Fresh module instance + empty database (or a custom IndexedDB factory). */
async function loadStore(factory: IDBFactory = new IDBFactory()): Promise<{
  store: Store
  factory: IDBFactory
}> {
  vi.resetModules()
  vi.stubGlobal('indexedDB', factory)
  const store = await import('~/services/playlistTrackStore')
  return { store, factory }
}

/** Fresh module instance in a runtime with no `indexedDB` global at all. */
async function loadStoreWithoutIndexedDb(): Promise<Store> {
  vi.resetModules()
  vi.stubGlobal('indexedDB', undefined)
  return import('~/services/playlistTrackStore')
}

function makeRecord(overrides: Partial<SavedTrackRecord> = {}): SavedTrackRecord {
  return {
    key: 'key-1',
    userId: 'u1',
    name: 'song.mp3',
    type: 'audio/mpeg',
    size: 4,
    position: 0,
    addedAt: 1_000,
    lastPlayedAt: null,
    ...overrides,
  }
}

function makeFile(name = 'song.mp3', bytes: number[] = [1, 2, 3, 4], type = 'audio/mpeg'): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

/** `listSavedTracks` on a healthy store: asserts the read succeeded and every blob is present. */
async function listOk(store: Store, userId: string): Promise<Array<{ record: SavedTrackRecord; file: File }>> {
  const out = await store.listSavedTracks(userId)
  expect(out).not.toBeNull()
  return out!.map(({ record, file }) => {
    expect(file).not.toBeNull()
    return { record, file: file! }
  })
}

async function bytesOf(blob: Blob): Promise<number[]> {
  return Array.from(new Uint8Array(await blob.arrayBuffer()))
}

/** Save a record + file pair through the service and assert it was accepted. */
async function seed(
  store: Store,
  overrides: Partial<SavedTrackRecord> = {},
  bytes: number[] = [1, 2, 3, 4],
): Promise<SavedTrackRecord> {
  const record = makeRecord({ size: bytes.length, ...overrides })
  const result = await store.saveTrack(record, makeFile(record.name, bytes, record.type))
  expect(result).toBe('saved')
  return record
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** A second, raw connection to the same database — bypasses the service entirely. */
async function openRaw(factory: IDBFactory): Promise<IDBDatabase> {
  const request = factory.open(PLAYLIST_IDB_NAME)
  return requestToPromise(request)
}

async function rawBlobKeys(factory: IDBFactory): Promise<IDBValidKey[]> {
  const db = await openRaw(factory)
  try {
    const tx = db.transaction('blobs', 'readonly')
    return await requestToPromise(tx.objectStore('blobs').getAllKeys())
  } finally {
    db.close()
  }
}

async function rawDeleteBlob(factory: IDBFactory, key: string): Promise<void> {
  const db = await openRaw(factory)
  try {
    const tx = db.transaction('blobs', 'readwrite')
    tx.objectStore('blobs').delete(key)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

/**
 * Simulate the browser's real quota failure: the blob write is accepted
 * synchronously, then the whole transaction aborts asynchronously with
 * `tx.error = QuotaExceededError` (this is how Chrome/WebView report it).
 */
function failBlobWritesWithQuota() {
  const originalPut = IDBObjectStore.prototype.put
  return vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
    this: IDBObjectStore,
    ...args: Parameters<IDBObjectStore['put']>
  ) {
    const request = originalPut.apply(this, args)
    if (this.name === 'blobs') {
      const tx = this.transaction as unknown as { _abort: (errName: string | null) => void }
      tx._abort('QuotaExceededError')
    }
    return request
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  warn.mockClear()
})

// ========================================
// Tests
// ========================================

describe('playlistTrackStore', () => {
  describe('saveTrack + listSavedTracks', () => {
    it('round-trips the record and a File with the same name, size, type and bytes', async () => {
      const { store } = await loadStore()
      const record = makeRecord({ name: 'banger.mp3', type: 'audio/mpeg', size: 5 })
      const bytes = [9, 8, 7, 6, 5]

      const result = await store.saveTrack(record, makeFile('banger.mp3', bytes, 'audio/mpeg'))
      const saved = await listOk(store, 'u1')

      expect(result).toBe('saved')
      expect(saved).toHaveLength(1)
      expect(saved[0]!.record).toEqual(record)
      const file = saved[0]!.file
      expect(file).toBeInstanceOf(File)
      expect(file.name).toBe('banger.mp3')
      expect(file.size).toBe(5)
      expect(file.type).toBe('audio/mpeg')
      expect(await bytesOf(file)).toEqual(bytes)
    })

    it('keeps the bytes of different songs separate', async () => {
      const { store } = await loadStore()
      await seed(store, { key: 'k1', name: 'one.mp3', position: 0 }, [1, 1, 1])
      await seed(store, { key: 'k2', name: 'two.wav', type: 'audio/wav', position: 1 }, [2, 2])

      const saved = await listOk(store, 'u1')

      expect(saved.map((s) => s.file.name)).toEqual(['one.mp3', 'two.wav'])
      expect(await bytesOf(saved[0]!.file)).toEqual([1, 1, 1])
      expect(await bytesOf(saved[1]!.file)).toEqual([2, 2])
      expect(saved[1]!.file.type).toBe('audio/wav')
    })

    it('overwrites an existing song saved under the same key', async () => {
      const { store } = await loadStore()
      await seed(store, { key: 'k1', name: 'old.mp3' }, [1, 2])
      await seed(store, { key: 'k1', name: 'new.mp3' }, [3, 4, 5])

      const saved = await listOk(store, 'u1')

      expect(saved).toHaveLength(1)
      expect(saved[0]!.record.name).toBe('new.mp3')
      expect(await bytesOf(saved[0]!.file)).toEqual([3, 4, 5])
    })

    it('returns an empty list for a user with nothing saved', async () => {
      const { store } = await loadStore()

      expect(await listOk(store, 'u1')).toEqual([])
    })
  })

  describe('per-user isolation', () => {
    it('does not return tracks saved for another user', async () => {
      const { store } = await loadStore()
      await seed(store, { key: 'a-1', userId: 'a', name: 'a-song.mp3' })
      await seed(store, { key: 'b-1', userId: 'b', name: 'b-song.mp3' })

      const forA = await listOk(store, 'a')
      const forB = await listOk(store, 'b')
      const forNobody = await listOk(store, 'c')

      expect(forA.map((s) => s.record.key)).toEqual(['a-1'])
      expect(forB.map((s) => s.record.key)).toEqual(['b-1'])
      expect(forNobody).toEqual([])
    })

    it('listAllRecords spans every account', async () => {
      const { store } = await loadStore()
      await seed(store, { key: 'a-1', userId: 'a' })
      await seed(store, { key: 'b-1', userId: 'b' })

      const all = await store.listAllRecords()

      expect(all.map((r) => r.key).sort()).toEqual(['a-1', 'b-1'])
    })
  })

  describe('ordering', () => {
    it('lists records sorted by position regardless of insert order', async () => {
      const { store } = await loadStore()
      await seed(store, { key: 'third', position: 2 })
      await seed(store, { key: 'first', position: 0 })
      await seed(store, { key: 'second', position: 1 })

      const saved = await listOk(store, 'u1')

      expect(saved.map((s) => s.record.key)).toEqual(['first', 'second', 'third'])
    })

    it('writePositions reorders the restored list', async () => {
      const { store } = await loadStore()
      await seed(store, { key: 'a', position: 0 })
      await seed(store, { key: 'b', position: 1 })
      await seed(store, { key: 'c', position: 2 })

      await store.writePositions(['c', 'a', 'b'])
      const saved = await listOk(store, 'u1')

      expect(saved.map((s) => s.record.key)).toEqual(['c', 'a', 'b'])
      expect(saved.map((s) => s.record.position)).toEqual([0, 1, 2])
    })

    it('writePositions touches metadata only — blobs and other fields survive', async () => {
      const { store } = await loadStore()
      await seed(store, { key: 'a', position: 0, name: 'a.mp3', addedAt: 111 }, [1, 2, 3])
      await seed(store, { key: 'b', position: 1, name: 'b.mp3', addedAt: 222 }, [4, 5])

      await store.writePositions(['b', 'a'])
      const saved = await listOk(store, 'u1')

      expect(saved.map((s) => s.record.key)).toEqual(['b', 'a'])
      expect(saved[0]!.record).toMatchObject({ name: 'b.mp3', addedAt: 222, size: 2 })
      expect(await bytesOf(saved[0]!.file)).toEqual([4, 5])
      expect(await bytesOf(saved[1]!.file)).toEqual([1, 2, 3])
    })

    it('writePositions ignores unknown keys and still positions the rest', async () => {
      const { store } = await loadStore()
      await seed(store, { key: 'a', position: 0 })
      await seed(store, { key: 'b', position: 1 })

      await expect(store.writePositions(['ghost', 'b', 'a'])).resolves.toBeUndefined()
      const saved = await listOk(store, 'u1')

      // 'ghost' still consumes position 0, so b → 1 (unchanged) and a → 2.
      expect(saved.map((s) => s.record.key)).toEqual(['b', 'a'])
    })

    it('writePositions with no keys resolves without opening a transaction', async () => {
      const { store } = await loadStore()
      await seed(store, { key: 'a', position: 3 })

      await expect(store.writePositions([])).resolves.toBeUndefined()

      expect((await listOk(store, 'u1'))[0]!.record.position).toBe(3)
    })
  })

  describe('deleteTracks', () => {
    it('removes the metadata AND the blob', async () => {
      const { store, factory } = await loadStore()
      await seed(store, { key: 'a', position: 0 })
      await seed(store, { key: 'b', position: 1 })
      await seed(store, { key: 'c', position: 2 })

      await store.deleteTracks(['a', 'c'])

      expect((await store.listAllRecords()).map((r) => r.key)).toEqual(['b'])
      expect((await listOk(store, 'u1')).map((s) => s.record.key)).toEqual(['b'])
      expect(await rawBlobKeys(factory)).toEqual(['b'])
    })

    it('treats unknown keys as a no-op', async () => {
      const { store } = await loadStore()
      await seed(store, { key: 'a' })

      await expect(store.deleteTracks(['ghost'])).resolves.toBeUndefined()

      expect((await store.listAllRecords()).map((r) => r.key)).toEqual(['a'])
    })

    it('resolves immediately for an empty key list', async () => {
      const { store } = await loadStore()
      await seed(store, { key: 'a' })

      await expect(store.deleteTracks([])).resolves.toBeUndefined()

      expect(await store.listAllRecords()).toHaveLength(1)
    })
  })

  describe('touchLastPlayed', () => {
    it('sets lastPlayedAt and leaves the other fields and the blob alone', async () => {
      const { store } = await loadStore()
      const record = await seed(store, { key: 'a', lastPlayedAt: null, position: 4 }, [7, 7])

      await store.touchLastPlayed('a', 123_456)
      const [saved] = await listOk(store, 'u1')

      expect(saved!.record).toEqual({ ...record, lastPlayedAt: 123_456 })
      expect(await bytesOf(saved!.file)).toEqual([7, 7])
    })

    it('overwrites an earlier lastPlayedAt', async () => {
      const { store } = await loadStore()
      await seed(store, { key: 'a', lastPlayedAt: 100 })

      await store.touchLastPlayed('a', 200)

      expect((await store.listAllRecords())[0]!.lastPlayedAt).toBe(200)
    })

    it('does not create a record for an unknown key', async () => {
      const { store } = await loadStore()

      await expect(store.touchLastPlayed('ghost', 1)).resolves.toBeUndefined()

      expect(await store.listAllRecords()).toEqual([])
    })
  })

  describe('missing blob', () => {
    it('returns a record whose blob is gone with file: null (shown as unavailable) and logs a warning', async () => {
      const { store, factory } = await loadStore()
      await seed(store, { key: 'healthy', position: 0 })
      await seed(store, { key: 'orphan', position: 1 })
      await rawDeleteBlob(factory, 'orphan')

      const saved = (await store.listSavedTracks('u1'))!

      expect(saved.map((s) => s.record.key)).toEqual(['healthy', 'orphan'])
      expect(saved[0]!.file).toBeInstanceOf(File)
      expect(saved[1]!.file).toBeNull()
      expect(warn).toHaveBeenCalledWith('Saved track has no blob', 'orphan')
    })

    it('still reports the orphaned metadata in listAllRecords (byte-budget view)', async () => {
      const { store, factory } = await loadStore()
      await seed(store, { key: 'orphan' })
      await rawDeleteBlob(factory, 'orphan')

      expect((await store.listAllRecords()).map((r) => r.key)).toEqual(['orphan'])
    })
  })

  describe('failed saves', () => {
    it("returns 'quota' when the transaction aborts with QuotaExceededError, persisting nothing", async () => {
      const { store, factory } = await loadStore()
      const putSpy = failBlobWritesWithQuota()

      const result = await store.saveTrack(makeRecord({ key: 'big' }), makeFile())
      putSpy.mockRestore()

      expect(result).toBe('quota')
      expect(warn).toHaveBeenCalledWith('Saved-track write hit the storage quota', 'big')
      // Atomic: neither the metadata row nor the blob survived the abort.
      expect(await store.listAllRecords()).toEqual([])
      expect(await store.listSavedTracks('u1')).toEqual([])
      expect(await rawBlobKeys(factory)).toEqual([])
    })

    it('does not poison the store — a later save succeeds after a quota failure', async () => {
      const { store } = await loadStore()
      const putSpy = failBlobWritesWithQuota()
      expect(await store.saveTrack(makeRecord({ key: 'big' }), makeFile())).toBe('quota')
      putSpy.mockRestore()

      expect(await store.saveTrack(makeRecord({ key: 'small' }), makeFile())).toBe('saved')

      expect((await store.listAllRecords()).map((r) => r.key)).toEqual(['small'])
    })

    // A synchronous put() throw does not abort a transaction by itself —
    // saveTrack aborts explicitly, so the metadata row must not commit alone.
    it("returns 'quota' for a synchronous QuotaExceededError thrown by put() and persists nothing", async () => {
      const { store } = await loadStore()
      const originalPut = IDBObjectStore.prototype.put
      vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
        this: IDBObjectStore,
        ...args: Parameters<IDBObjectStore['put']>
      ) {
        if (this.name === 'blobs') throw new DOMException('full', 'QuotaExceededError')
        return originalPut.apply(this, args)
      })

      const result = await store.saveTrack(makeRecord({ key: 'big' }), makeFile())

      expect(result).toBe('quota')
      vi.mocked(IDBObjectStore.prototype.put).mockRestore()
      expect(await store.listAllRecords()).toEqual([])
    })

    it("returns 'error' (not 'quota') for any other transaction failure", async () => {
      const { store } = await loadStore()
      const originalPut = IDBObjectStore.prototype.put
      vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
        this: IDBObjectStore,
        ...args: Parameters<IDBObjectStore['put']>
      ) {
        const request = originalPut.apply(this, args)
        if (this.name === 'blobs') {
          const tx = this.transaction as unknown as { _abort: (errName: string | null) => void }
          tx._abort('UnknownError')
        }
        return request
      })

      const result = await store.saveTrack(makeRecord({ key: 'x' }), makeFile())

      expect(result).toBe('error')
      expect(warn).toHaveBeenCalledWith('Failed to save track', expect.anything())
    })
  })

  describe('open failures', () => {
    it('a failed open degrades to a neutral value without throwing', async () => {
      const real = new IDBFactory()
      let opens = 0
      const flaky = {
        open: (...args: Parameters<IDBFactory['open']>): IDBOpenDBRequest => {
          opens += 1
          if (opens > 1) return real.open(...args)
          const failing: { error: unknown; onerror: (() => void) | null } = {
            error: new Error('open failed'),
            onerror: null,
          }
          setTimeout(() => failing.onerror?.(), 0)
          return failing as unknown as IDBOpenDBRequest
        },
      } as unknown as IDBFactory
      const { store } = await loadStore(flaky)

      // First call: the open fails → neutral value, nothing thrown.
      expect(await store.saveTrack(makeRecord(), makeFile())).toBe('error')
      expect(opens).toBe(1)
    })

    it('a failed read returns null (retry later), not [] (nothing saved)', async () => {
      const failing = {
        open: (): IDBOpenDBRequest => {
          const req: { error: unknown; onerror: (() => void) | null } = { error: new Error('open failed'), onerror: null }
          setTimeout(() => req.onerror?.(), 0)
          return req as unknown as IDBOpenDBRequest
        },
      } as unknown as IDBFactory
      const { store } = await loadStore(failing)

      expect(await store.listSavedTracks('u1')).toBeNull()
    })

    it('a failed open is not cached — the next call retries and works', async () => {
      const real = new IDBFactory()
      let opens = 0
      const flaky = {
        open: (...args: Parameters<IDBFactory['open']>): IDBOpenDBRequest => {
          opens += 1
          if (opens > 1) return real.open(...args)
          const failing: { error: unknown; onerror: (() => void) | null } = {
            error: new Error('open failed'),
            onerror: null,
          }
          setTimeout(() => failing.onerror?.(), 0)
          return failing as unknown as IDBOpenDBRequest
        },
      } as unknown as IDBFactory
      const { store } = await loadStore(flaky)
      expect(await store.saveTrack(makeRecord(), makeFile())).toBe('error')
      expect(opens).toBe(1)

      // Next call: the failed open was not cached, so it is retried and works.
      expect(await store.saveTrack(makeRecord(), makeFile())).toBe('saved')
      expect(opens).toBe(2)
      expect((await store.listAllRecords()).map((r) => r.key)).toEqual(['key-1'])
    })
  })

  describe('no IndexedDB', () => {
    it('reports storage unavailable and degrades every call without throwing', async () => {
      const store = await loadStoreWithoutIndexedDb()

      expect(store.isPlaylistStorageAvailable()).toBe(false)
      expect(await store.saveTrack(makeRecord(), makeFile())).toBe('unavailable')
      expect(await store.listSavedTracks('u1')).toEqual([])
      expect(await store.listAllRecords()).toEqual([])
      await expect(store.deleteTracks(['a'])).resolves.toBeUndefined()
      await expect(store.writePositions(['a', 'b'])).resolves.toBeUndefined()
      await expect(store.touchLastPlayed('a', 1)).resolves.toBeUndefined()
    })

    it('reports storage available when IndexedDB exists', async () => {
      const { store } = await loadStore()

      expect(store.isPlaylistStorageAvailable()).toBe(true)
    })
  })

  describe('navigator.storage helpers', () => {
    it('requestPersistentStorage returns the browser answer', async () => {
      const { store } = await loadStore()
      vi.stubGlobal('navigator', { storage: { persist: vi.fn().mockResolvedValue(false) } })

      expect(await store.requestPersistentStorage()).toBe(false)
    })

    it('requestPersistentStorage returns null when the API is missing or throws', async () => {
      const { store } = await loadStore()

      vi.stubGlobal('navigator', {})
      expect(await store.requestPersistentStorage()).toBeNull()

      vi.stubGlobal('navigator', {
        storage: { persist: vi.fn().mockRejectedValue(new Error('denied')) },
      })
      expect(await store.requestPersistentStorage()).toBeNull()
    })

    it('estimateQuotaBytes returns the origin quota', async () => {
      const { store } = await loadStore()
      vi.stubGlobal('navigator', {
        storage: { estimate: vi.fn().mockResolvedValue({ quota: 1_000_000, usage: 5 }) },
      })

      expect(await store.estimateQuotaBytes()).toBe(1_000_000)
    })

    it('estimateQuotaBytes returns null for a missing API, bad quota, or a throw', async () => {
      const { store } = await loadStore()

      vi.stubGlobal('navigator', {})
      expect(await store.estimateQuotaBytes()).toBeNull()

      vi.stubGlobal('navigator', { storage: { estimate: vi.fn().mockResolvedValue({ quota: 0 }) } })
      expect(await store.estimateQuotaBytes()).toBeNull()

      vi.stubGlobal('navigator', { storage: { estimate: vi.fn().mockResolvedValue({}) } })
      expect(await store.estimateQuotaBytes()).toBeNull()

      vi.stubGlobal('navigator', {
        storage: { estimate: vi.fn().mockRejectedValue(new Error('nope')) },
      })
      expect(await store.estimateQuotaBytes()).toBeNull()
    })
  })
})
