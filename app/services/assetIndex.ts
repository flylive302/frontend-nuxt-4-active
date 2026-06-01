// ========================================
// Asset Index Service (IndexedDB)
// ========================================

import type { AssetMetadata } from '~/types/asset/asset'
import { ASSET_CONFIG } from '~/constants/asset'
import { createLogger } from '~/utils/logger'

const log = createLogger('[AssetIndex]')

// ========================================
// Database Initialization
// ========================================

let dbPromise: Promise<IDBDatabase> | null = null

/**
 * Open or create the IndexedDB database.
 */
function openDatabase(): Promise<IDBDatabase> {
  // SSR guard
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available'))
  }

  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(ASSET_CONFIG.IDB_NAME, ASSET_CONFIG.IDB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(ASSET_CONFIG.IDB_STORE)) {
        const store = db.createObjectStore(ASSET_CONFIG.IDB_STORE, { keyPath: 'url' })

        // Create indexes for queries
        store.createIndex('giftId', 'giftId', { unique: false })
        store.createIndex('priority', 'priority', { unique: false })
        store.createIndex('downloadedAt', 'downloadedAt', { unique: false })


      }
    }

    request.onsuccess = () => {

      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error)
    }
  })

  return dbPromise
}

/**
 * Get object store for transactions.
 */
async function getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDatabase()
  const tx = db.transaction(ASSET_CONFIG.IDB_STORE, mode)
  return tx.objectStore(ASSET_CONFIG.IDB_STORE)
}

/**
 * Wrap IDBRequest in a Promise.
 */
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ========================================
// Public API
// ========================================

/**
 * Initialize the asset index database.
 */
export async function initAssetIndex(): Promise<void> {
  // SSR guard
  if (typeof indexedDB === 'undefined') return

  try {
    await openDatabase()

  } catch (e) {
    log.warn('Failed to initialize asset index', e)
  }
}

/**
 * Insert or update asset metadata.
 */
export async function upsert(metadata: AssetMetadata): Promise<void> {
  const store = await getStore('readwrite')
  await promisifyRequest(store.put(metadata))
}

/**
 * Get asset metadata by URL.
 */
export async function get(url: string): Promise<AssetMetadata | null> {
  try {
    const store = await getStore('readonly')
    const result = await promisifyRequest(store.get(url))
    return result ?? null
  } catch (e) {
    log.warn('Failed to get asset metadata', e)
    return null
  }
}

/**
 * Delete asset metadata by URL.
 */
export async function remove(url: string): Promise<void> {
  try {
    const store = await getStore('readwrite')
    await promisifyRequest(store.delete(url))

  } catch (e) {
    log.warn('Failed to remove asset metadata', e)
  }
}

/**
 * Get all metadata for a gift by ID.
 */
export async function getByGiftId(giftId: number): Promise<AssetMetadata[]> {
  try {
    const store = await getStore('readonly')
    const index = store.index('giftId')
    const result = await promisifyRequest(index.getAll(giftId))
    return result
  } catch (e) {
    log.warn('Failed to get assets by gift ID', e)
    return []
  }
}

/**
 * Get all metadata sorted by priority.
 */
export async function getAllByPriority(): Promise<AssetMetadata[]> {
  try {
    const store = await getStore('readonly')
    const result = await promisifyRequest(store.getAll())

    // Sort by priority (critical > high > normal > low)
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 }
    return result.sort(
      (a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
    )
  } catch (e) {
    log.warn('Failed to get all assets by priority', e)
    return []
  }
}

/**
 * Get stale entries older than specified days.
 */
export async function getStale(days: number = ASSET_CONFIG.STALE_DAYS): Promise<AssetMetadata[]> {
  try {
    const store = await getStore('readonly')
    const result = await promisifyRequest(store.getAll())

    const threshold = Date.now() - days * 24 * 60 * 60 * 1000
    return result.filter((m) => m.downloadedAt < threshold)
  } catch (e) {
    log.warn('Failed to get stale assets', e)
    return []
  }
}

/**
 * Get all metadata entries.
 */
export async function getAll(): Promise<AssetMetadata[]> {
  try {
    const store = await getStore('readonly')
    return await promisifyRequest(store.getAll())
  } catch (e) {
    log.warn('Failed to get all assets', e)
    return []
  }
}

/**
 * Clear all metadata.
 */
export async function clearAll(): Promise<void> {
  try {
    const store = await getStore('readwrite')
    await promisifyRequest(store.clear())
  } catch (e) {
    log.warn('Failed to clear asset index', e)
  }
}

/**
 * Update last accessed timestamp.
 */
export async function updateLastAccessed(url: string): Promise<void> {
  try {
    const metadata = await get(url)
    if (metadata) {
      metadata.lastAccessedAt = Date.now()
      await upsert(metadata)
    }
  } catch (e) {
    log.warn('Failed to update last accessed timestamp', e)
  }
}

/**
 * Get count of all entries.
 */
export async function count(): Promise<number> {
  try {
    const store = await getStore('readonly')
    return await promisifyRequest(store.count())
  } catch (e) {
    log.warn('Failed to count assets', e)
    return 0
  }
}
