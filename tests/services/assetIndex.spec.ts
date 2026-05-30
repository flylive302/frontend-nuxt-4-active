// ========================================
// Asset Index Service Tests
// ========================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  initAssetIndex,
  upsert,
  get,
  remove,
  getByGiftId,
  getAllByPriority,
  getStale,
  getAll,
  clearAll,
  updateLastAccessed,
  count,
} from '~/services/assetIndex'
import type { AssetMetadata } from '~/types/asset/asset'

// ========================================
// Mocks
// ========================================

// Mock logger
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

// ========================================
// IndexedDB Mock
// ========================================

// In-memory store backing the mock IndexedDB
const mockStore: Map<string, AssetMetadata> = new Map()

/**
 * Wrap mock result to behave like IDBRequest — assigns onsuccess async.
 */
function createMockRequest<T>(result: T): IDBRequest<T> {
  const request = {
    result,
    error: null,
    onsuccess: null as ((e: unknown) => void) | null,
    onerror: null as ((e: unknown) => void) | null,
  } as unknown as IDBRequest<T>

  // Simulate async callback
  queueMicrotask(() => {
    if (request.onsuccess) {
      request.onsuccess(new Event('success'))
    }
  })

  return request
}

const mockObjectStore = {
  put: vi.fn((data: AssetMetadata) => {
    mockStore.set(data.url, data)
    return createMockRequest(undefined)
  }),
  get: vi.fn((key: string) => {
    return createMockRequest(mockStore.get(key) ?? undefined)
  }),
  delete: vi.fn((key: string) => {
    mockStore.delete(key)
    return createMockRequest(undefined)
  }),
  getAll: vi.fn(() => {
    return createMockRequest(Array.from(mockStore.values()))
  }),
  clear: vi.fn(() => {
    mockStore.clear()
    return createMockRequest(undefined)
  }),
  count: vi.fn(() => {
    return createMockRequest(mockStore.size)
  }),
  index: vi.fn((_indexName: string) => ({
    getAll: vi.fn((giftId: number) => {
      return createMockRequest(
        Array.from(mockStore.values()).filter((m) => m.giftId === giftId)
      )
    }),
  })),
}

const mockTransaction = {
  objectStore: vi.fn(() => mockObjectStore),
}

const mockDb = {
  transaction: vi.fn(() => mockTransaction),
  objectStoreNames: {
    contains: vi.fn(() => false),
  },
  createObjectStore: vi.fn(() => ({
    createIndex: vi.fn(),
  })),
}

// Mock indexedDB.open
const mockIndexedDB = {
  open: vi.fn(() => {
    const request = {
      onsuccess: null as ((e: unknown) => void) | null,
      onerror: null as ((e: unknown) => void) | null,
      onupgradeneeded: null as ((e: unknown) => void) | null,
      result: mockDb,
    }
    // Simulate async success
    queueMicrotask(() => {
      if (request.onupgradeneeded) {
        request.onupgradeneeded({ target: request })
      }
      if (request.onsuccess) {
        request.onsuccess({})
      }
    })
    return request
  }),
}

Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
})

// ========================================
// Test Data
// ========================================

function createMetadata(overrides: Partial<AssetMetadata> = {}): AssetMetadata {
  return {
    url: 'https://example.com/asset.webm',
    assetType: 'video',
    priority: 'normal',
    scope: 'gift',
    sizeBytes: 1000000,
    giftId: 123,
    downloadedAt: Date.now(),
    lastAccessedAt: Date.now(),
    retryCount: 0,
    ...overrides,
  }
}

// ========================================
// Tests
// ========================================

describe('assetIndex', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockStore.clear()
    // Re-init for each test to get a fresh DB handle
    await initAssetIndex()
  })

  describe('initAssetIndex', () => {
    it('should open IndexedDB with correct name and version', async () => {
      expect(mockIndexedDB.open).toHaveBeenCalledWith('flylive-assets', 1)
    })
  })

  describe('upsert', () => {
    it('should store metadata via put()', async () => {
      const metadata = createMetadata()
      await upsert(metadata)

      expect(mockObjectStore.put).toHaveBeenCalledWith(metadata)
    })

    it('should overwrite existing metadata with same URL', async () => {
      const first = createMetadata({ sizeBytes: 100 })
      const second = createMetadata({ sizeBytes: 200 })

      await upsert(first)
      await upsert(second)

      expect(mockStore.get('https://example.com/asset.webm')?.sizeBytes).toBe(200)
    })
  })

  describe('get', () => {
    it('should return null for missing URL', async () => {
      const result = await get('https://example.com/missing.webm')
      expect(result).toBeNull()
    })

    it('should return metadata for existing URL', async () => {
      const metadata = createMetadata()
      mockStore.set(metadata.url, metadata)

      const result = await get(metadata.url)
      expect(result).toEqual(metadata)
    })
  })

  describe('remove', () => {
    it('should call delete on the object store', async () => {
      const url = 'https://example.com/to-delete.webm'
      mockStore.set(url, createMetadata({ url }))

      await remove(url)

      expect(mockObjectStore.delete).toHaveBeenCalledWith(url)
      expect(mockStore.has(url)).toBe(false)
    })

    it('should not throw for non-existent URL', async () => {
      await expect(remove('https://example.com/never-existed.webm')).resolves.toBeUndefined()
    })
  })

  describe('getByGiftId', () => {
    it('should return entries matching the giftId', async () => {
      const m1 = createMetadata({ url: 'a.webm', giftId: 10 })
      const m2 = createMetadata({ url: 'b.webm', giftId: 10 })
      const m3 = createMetadata({ url: 'c.webm', giftId: 99 })
      mockStore.set(m1.url, m1)
      mockStore.set(m2.url, m2)
      mockStore.set(m3.url, m3)

      const result = await getByGiftId(10)
      expect(result).toHaveLength(2)
      expect(result.every((m) => m.giftId === 10)).toBe(true)
    })

    it('should return empty array for unmatched giftId', async () => {
      const result = await getByGiftId(999)
      expect(result).toEqual([])
    })
  })

  describe('getAllByPriority', () => {
    it('should sort results by priority order (critical > high > normal > low)', async () => {
      mockStore.set('a', createMetadata({ url: 'a', priority: 'low' }))
      mockStore.set('b', createMetadata({ url: 'b', priority: 'critical' }))
      mockStore.set('c', createMetadata({ url: 'c', priority: 'normal' }))
      mockStore.set('d', createMetadata({ url: 'd', priority: 'high' }))

      const result = await getAllByPriority()

      expect(result[0]!.priority).toBe('critical')
      expect(result[1]!.priority).toBe('high')
      expect(result[2]!.priority).toBe('normal')
      expect(result[3]!.priority).toBe('low')
    })

    it('should return empty array for empty store', async () => {
      const result = await getAllByPriority()
      expect(result).toEqual([])
    })
  })

  describe('getStale', () => {
    it('should return entries older than the threshold', async () => {
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000
      const recent = createMetadata({ url: 'recent.webm', downloadedAt: Date.now() })
      const stale = createMetadata({ url: 'stale.webm', downloadedAt: thirtyOneDaysAgo })
      mockStore.set(recent.url, recent)
      mockStore.set(stale.url, stale)

      const result = await getStale(30)

      expect(result).toHaveLength(1)
      expect(result[0]!.url).toBe('stale.webm')
    })

    it('should return empty array when nothing is stale', async () => {
      mockStore.set('fresh.webm', createMetadata({ url: 'fresh.webm', downloadedAt: Date.now() }))

      const result = await getStale(30)
      expect(result).toEqual([])
    })
  })

  describe('getAll', () => {
    it('should return all entries from the store', async () => {
      mockStore.set('a', createMetadata({ url: 'a' }))
      mockStore.set('b', createMetadata({ url: 'b' }))
      mockStore.set('c', createMetadata({ url: 'c' }))

      const result = await getAll()
      expect(result).toHaveLength(3)
    })

    it('should return empty array for empty store', async () => {
      const result = await getAll()
      expect(result).toEqual([])
    })
  })

  describe('clearAll', () => {
    it('should clear the entire object store', async () => {
      mockStore.set('a', createMetadata({ url: 'a' }))
      mockStore.set('b', createMetadata({ url: 'b' }))

      await clearAll()

      expect(mockObjectStore.clear).toHaveBeenCalled()
      expect(mockStore.size).toBe(0)
    })
  })

  describe('updateLastAccessed', () => {
    it('should update the lastAccessedAt timestamp', async () => {
      const oldTimestamp = Date.now() - 10000
      const metadata = createMetadata({ lastAccessedAt: oldTimestamp })
      mockStore.set(metadata.url, metadata)

      await updateLastAccessed(metadata.url)

      // Should have called put with updated timestamp
      expect(mockObjectStore.put).toHaveBeenCalled()
      const putArg = mockObjectStore.put.mock.calls[0]![0] as AssetMetadata
      expect(putArg.lastAccessedAt).toBeGreaterThan(oldTimestamp)
    })

    it('should not throw for non-existent URL', async () => {
      await expect(updateLastAccessed('https://example.com/nope.webm')).resolves.toBeUndefined()
    })
  })

  describe('count', () => {
    it('should return the number of entries', async () => {
      mockStore.set('a', createMetadata({ url: 'a' }))
      mockStore.set('b', createMetadata({ url: 'b' }))

      const result = await count()
      expect(result).toBe(2)
    })

    it('should return 0 for empty store', async () => {
      const result = await count()
      expect(result).toBe(0)
    })
  })
})
