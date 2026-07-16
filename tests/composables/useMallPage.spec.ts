/**
 * Unit tests for useMallPage.initializeCatalog / initializeUserProps
 * (mall-05: parallel init).
 *
 * Covers:
 *  - fetchTypes + the data request (catalog / user-props + equipped) are
 *    in flight concurrently, not sequential (types no longer gates the
 *    data request).
 *  - The parallel data request is still type-filtered to the first tab
 *    (PROP_TYPE_ORDER[0] === 'frame'), predicted client-side instead of
 *    waiting on the /props/types response — filtering semantics unchanged.
 *  - Per-request error isolation: one request failing does not blank the
 *    other section's already-rendered data.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('piniaPluginPersistedstate', {
  cookies: () => ({}),
  localStorage: () => ({}),
  sessionStorage: () => ({}),
})

/** Deferred promise helper — lets a test control exactly when an API call resolves. */
function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Flush pending microtasks + a macrotask so chained `await`s inside the composables settle. */
function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve))
}

let apiMock = vi.fn()

beforeEach(() => {
  vi.resetModules()
  setActivePinia(createPinia())
  apiMock = vi.fn()
  ;(globalThis as Record<string, unknown>).useApi = () => ({
    api: (...args: unknown[]) => apiMock(...args),
    normalizeError: (e: unknown) => ({ message: e instanceof Error ? e.message : String(e) }),
  })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'useApi')
  Reflect.deleteProperty(globalThis, 'useMallStore')
  Reflect.deleteProperty(globalThis, 'useMallCatalog')
  Reflect.deleteProperty(globalThis, 'useMallUserProps')
  vi.clearAllMocks()
})

/** Wire real store + real data composables (sharing one pinia instance) as globals, mimicking Nuxt auto-import. */
async function setupComposables() {
  const { useMallStore } = await import('../../app/stores/mall')
  const { useMallCatalog } = await import('../../app/composables/mall/useMallCatalog')
  const { useMallUserProps } = await import('../../app/composables/mall/useMallUserProps')

  const mallStore = useMallStore()
  ;(globalThis as Record<string, unknown>).useMallStore = () => mallStore
  ;(globalThis as Record<string, unknown>).useMallCatalog = () => useMallCatalog()
  ;(globalThis as Record<string, unknown>).useMallUserProps = () => useMallUserProps()

  const { useMallPage } = await import('../../app/composables/mall/useMallPage')
  return { mallStore, page: useMallPage() }
}

describe('useMallPage.initializeCatalog — parallel init', () => {
  it('dispatches /props/types and the type-filtered /props request concurrently, before either resolves', async () => {
    const typesDeferred = createDeferred<unknown>()
    const catalogDeferred = createDeferred<unknown>()
    apiMock.mockImplementation((url: string) => {
      if (url === '/props/types') return typesDeferred.promise
      if (url === '/props') return catalogDeferred.promise
      throw new Error(`unexpected url ${url}`)
    })

    const { mallStore, page } = await setupComposables()
    const initPromise = page.initializeCatalog()

    // Both calls must already be in flight — proves fetchCatalog did not
    // wait for fetchTypes to resolve first.
    expect(apiMock).toHaveBeenCalledWith('/props/types')
    expect(apiMock).toHaveBeenCalledWith('/props', { params: { per_page: 20, type: 'frame' } })
    expect(mallStore.typesLoading).toBe(true)
    expect(mallStore.catalog.loading).toBe(true)

    // Resolve catalog first — proves the catalog section renders without
    // waiting on the (still-pending) types response.
    catalogDeferred.resolve({
      data: {
        props: [{ id: 1, name: 'Gold Frame', type: 'frame' }],
        pagination: { next_cursor: null, has_more: false },
      },
    })
    await flush()

    expect(mallStore.catalog.items).toHaveLength(1)
    expect(mallStore.catalog.loading).toBe(false)
    expect(mallStore.typesLoading).toBe(true) // still pending

    typesDeferred.resolve({
      data: { types: [{ type: 'frame', label: 'Frames', count: 1 }] },
    })
    await initPromise

    expect(mallStore.typesLoading).toBe(false)
    expect(mallStore.currentType).toBe('frame')
  })

  it('type filter matches the predicted first tab (frame), identical to the old serial request', async () => {
    apiMock.mockImplementation((url: string) => {
      if (url === '/props/types') return Promise.resolve({ data: { types: [{ type: 'frame', label: 'Frames', count: 0 }] } })
      if (url === '/props') return Promise.resolve({ data: { props: [], pagination: { next_cursor: null, has_more: false } } })
      throw new Error(`unexpected url ${url}`)
    })

    const { page } = await setupComposables()
    await page.initializeCatalog()

    expect(apiMock).toHaveBeenCalledWith('/props', { params: { per_page: 20, type: 'frame' } })
  })

  it('catalog data is not blanked when the types request fails', async () => {
    apiMock.mockImplementation((url: string) => {
      if (url === '/props/types') return Promise.reject(new Error('types down'))
      if (url === '/props') {
        return Promise.resolve({
          data: {
            props: [{ id: 1, name: 'Gold Frame', type: 'frame' }],
            pagination: { next_cursor: null, has_more: false },
          },
        })
      }
      throw new Error(`unexpected url ${url}`)
    })

    const { mallStore, page } = await setupComposables()
    await page.initializeCatalog()

    expect(mallStore.catalog.items).toHaveLength(1)
    expect(mallStore.catalog.error).toBeNull()
    expect(mallStore.types).toEqual([])
  })

  it('types data is not blanked when the catalog request fails', async () => {
    apiMock.mockImplementation((url: string) => {
      if (url === '/props/types') return Promise.resolve({ data: { types: [{ type: 'frame', label: 'Frames', count: 3 }] } })
      if (url === '/props') return Promise.reject(new Error('catalog down'))
      throw new Error(`unexpected url ${url}`)
    })

    const { mallStore, page } = await setupComposables()
    await page.initializeCatalog()

    expect(mallStore.types).toEqual([{ type: 'frame', label: 'Frames', count: 3 }])
    expect(mallStore.catalog.error).toBe('catalog down')
    expect(mallStore.catalog.items).toEqual([])
  })
})

describe('useMallPage.initializeUserProps — parallel init', () => {
  it('dispatches /props/types, the type-filtered /user/props request, and /user/props/equipped concurrently', async () => {
    const typesDeferred = createDeferred<unknown>()
    const userPropsDeferred = createDeferred<unknown>()
    const equippedDeferred = createDeferred<unknown>()
    apiMock.mockImplementation((url: string) => {
      if (url === '/props/types') return typesDeferred.promise
      if (url === '/user/props') return userPropsDeferred.promise
      if (url === '/user/props/equipped') return equippedDeferred.promise
      throw new Error(`unexpected url ${url}`)
    })

    const { mallStore, page } = await setupComposables()
    const initPromise = page.initializeUserProps()

    expect(apiMock).toHaveBeenCalledWith('/props/types')
    expect(apiMock).toHaveBeenCalledWith('/user/props', { params: { per_page: 50, status: 'active', type: 'frame' } })
    expect(apiMock).toHaveBeenCalledWith('/user/props/equipped')
    expect(mallStore.typesLoading).toBe(true)
    expect(mallStore.userProps.loading).toBe(true)
    expect(mallStore.equippedLoading).toBe(true)

    userPropsDeferred.resolve({
      data: {
        props: [{ id: 1, prop_id: 10, type: 'frame' }],
        pagination: { next_cursor: null, has_more: false },
      },
    })
    await flush()

    expect(mallStore.userProps.items).toHaveLength(1)
    expect(mallStore.typesLoading).toBe(true) // still pending — proves no serial wait

    equippedDeferred.resolve({ data: { equipped: { frame: null, signature: null, room_theme: null, chat_bubble: null, entry_animation: null, data_card: null, mice_wave: null, slides: null } } })
    typesDeferred.resolve({ data: { types: [{ type: 'frame', label: 'Frames', count: 1 }] } })
    await initPromise

    expect(mallStore.typesLoading).toBe(false)
    expect(mallStore.equippedLoading).toBe(false)
    expect(mallStore.currentType).toBe('frame')
  })

  it('user-props data is not blanked when the types request fails', async () => {
    apiMock.mockImplementation((url: string) => {
      if (url === '/props/types') return Promise.reject(new Error('types down'))
      if (url === '/user/props') {
        return Promise.resolve({
          data: { props: [{ id: 1, prop_id: 10, type: 'frame' }], pagination: { next_cursor: null, has_more: false } },
        })
      }
      if (url === '/user/props/equipped') {
        return Promise.resolve({ data: { equipped: { frame: null, signature: null, room_theme: null, chat_bubble: null, entry_animation: null, data_card: null, mice_wave: null, slides: null } } })
      }
      throw new Error(`unexpected url ${url}`)
    })

    const { mallStore, page } = await setupComposables()
    await page.initializeUserProps()

    expect(mallStore.userProps.items).toHaveLength(1)
    expect(mallStore.userProps.error).toBeNull()
    expect(mallStore.types).toEqual([])
  })

  it('types data is not blanked when the user-props request fails', async () => {
    apiMock.mockImplementation((url: string) => {
      if (url === '/props/types') return Promise.resolve({ data: { types: [{ type: 'frame', label: 'Frames', count: 3 }] } })
      if (url === '/user/props') return Promise.reject(new Error('user-props down'))
      if (url === '/user/props/equipped') {
        return Promise.resolve({ data: { equipped: { frame: null, signature: null, room_theme: null, chat_bubble: null, entry_animation: null, data_card: null, mice_wave: null, slides: null } } })
      }
      throw new Error(`unexpected url ${url}`)
    })

    const { mallStore, page } = await setupComposables()
    await page.initializeUserProps()

    expect(mallStore.types).toEqual([{ type: 'frame', label: 'Frames', count: 3 }])
    expect(mallStore.userProps.error).toBe('user-props down')
    expect(mallStore.userProps.items).toEqual([])
  })
})
