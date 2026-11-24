import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, readonly, ref } from 'vue'
import { usePrettyIdData } from '~/composables/pretty-id/usePrettyIdData'
import { usePrettyIdStore } from '~/stores/prettyId'
import { PrettyIdApiError } from '~/utils/pretty-id-error'
import { createApiMock, resetApiMock } from '../../helpers/prettyIdFixtures'

const apiMock = createApiMock()
const toastAdd = vi.fn()
const navigateToMock = vi.fn()

vi.mock('~/composables/pretty-id/usePrettyIdApi', () => ({
  usePrettyIdApi: () => apiMock,
}))
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('useToast', () => ({ add: toastAdd }))
vi.stubGlobal('navigateTo', navigateToMock)

function toastTitles(): string[] {
  return toastAdd.mock.calls.map(([options]) => (options as { title: string }).title)
}

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

const item = (id: string) => ({ id, tier: 'standard' as const })

describe('usePrettyIdData', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetApiMock(apiMock)
    toastAdd.mockReset()
    navigateToMock.mockReset()
  })

  function setup() {
    return { store: usePrettyIdStore(), data: usePrettyIdData() }
  }

  describe('loadMe', () => {
    it('stores me', async () => {
      const { store, data } = setup()
      await data.loadMe()
      expect(store.me?.level).toBe(20)
      expect(store.isMeLoading).toBe(false)
    })

    it('flags a failed FIRST load for the retry screen instead of toasting', async () => {
      apiMock.me.mockRejectedValue(new PrettyIdApiError('unknown', 'Server down'))
      const { store, data } = setup()
      await data.loadMe()
      expect(store.me).toBeNull()
      expect(store.isMeFailed).toBe(true)
      expect(store.isMeLoading).toBe(false)
      expect(toastTitles()).toEqual([])
    })

    it('clears the failed flag once a retry succeeds', async () => {
      apiMock.me.mockRejectedValueOnce(new PrettyIdApiError('unknown', 'Server down'))
      const { store, data } = setup()
      await data.loadMe()
      await data.loadMe()
      expect(store.me).not.toBeNull()
      expect(store.isMeFailed).toBe(false)
    })

    it('toasts a failed REFRESH and keeps the page on the previous me', async () => {
      const { store, data } = setup()
      await data.loadMe()
      const loaded = store.me
      apiMock.me.mockRejectedValue(new PrettyIdApiError('unknown', 'Server down'))
      await data.loadMe()
      expect(store.me).toStrictEqual(loaded)
      expect(store.isMeFailed).toBe(false)
      expect(toastTitles()).toEqual(['Server down'])
    })
  })

  describe('loadList', () => {
    it('asks for the store length and tier and stores the page and total', async () => {
      apiMock.list.mockResolvedValue({ items: [item('111111')], total: 812 })
      const { store, data } = setup()
      store.setListLength(4)
      store.setListTier('lucky')

      await data.loadList()

      expect(apiMock.list).toHaveBeenCalledWith({ length: 4, tier: 'lucky' })
      expect(store.items).toEqual([item('111111')])
      expect(store.itemsTotal).toBe(812)
      expect(store.isListLoading).toBe(false)
    })

    it('drops a response whose query changed while it was in flight', async () => {
      const slow = deferred<{ items: ReturnType<typeof item>[], total: number }>()
      apiMock.list.mockReturnValueOnce(slow.promise)
      apiMock.list.mockResolvedValueOnce({ items: [item('2222')], total: 2 })
      const { store, data } = setup()

      const stale = data.loadList() // length 6
      await data.selectLength(4) // newer query resolves first
      expect(store.items).toEqual([item('2222')])
      slow.resolve({ items: [item('999999')], total: 1 })
      await stale

      expect(store.items).toEqual([item('2222')])
      expect(store.listLength).toBe(4)
      expect(store.isListLoading).toBe(false)
    })

    it('keeps the loading flag on while only a stale response has returned', async () => {
      const first = deferred<{ items: ReturnType<typeof item>[], total: number }>()
      const second = deferred<{ items: ReturnType<typeof item>[], total: number }>()
      apiMock.list.mockReturnValueOnce(first.promise)
      apiMock.list.mockReturnValueOnce(second.promise)
      const { store, data } = setup()

      const stale = data.loadList()
      const fresh = data.selectLength(4)
      first.resolve({ items: [], total: 0 })
      await stale
      expect(store.isListLoading).toBe(true)

      second.resolve({ items: [item('1234')], total: 1 })
      await fresh
      expect(store.isListLoading).toBe(false)
      expect(store.items).toEqual([item('1234')])
    })

    it('toasts a failure of the current query', async () => {
      apiMock.list.mockRejectedValue(new Error('offline'))
      const { store, data } = setup()
      await data.loadList()
      expect(toastTitles()).toEqual(['Something went wrong. Please try again.'])
      expect(store.isListLoading).toBe(false)
    })

    it('stays silent about a failure of a query nobody wants any more', async () => {
      let reject!: (error: unknown) => void
      apiMock.list.mockReturnValueOnce(new Promise((_, rej) => { reject = rej }))
      const { store, data } = setup()

      const stale = data.loadList()
      await data.selectLength(4)
      reject(new Error('offline'))
      await stale

      expect(toastAdd).not.toHaveBeenCalled()
      expect(store.isListLoading).toBe(false)
    })
  })

  describe('selectLength / toggleTier', () => {
    it('selectLength sets the length and reloads', async () => {
      const { store, data } = setup()
      await data.selectLength(4)
      expect(store.listLength).toBe(4)
      expect(apiMock.list).toHaveBeenCalledWith({ length: 4, tier: null })
    })

    it('toggleTier selects a tier, switches to another, and clears on re-select', async () => {
      const { store, data } = setup()

      await data.toggleTier('lucky')
      expect(store.listTier).toBe('lucky')
      expect(apiMock.list).toHaveBeenLastCalledWith({ length: 6, tier: 'lucky' })

      await data.toggleTier('mirror')
      expect(store.listTier).toBe('mirror')

      await data.toggleTier('mirror')
      expect(store.listTier).toBeNull()
      expect(apiMock.list).toHaveBeenLastCalledWith({ length: 6, tier: null })
    })
  })

  describe('submitSearch', () => {
    it('refuses a blank box with a toast and does not navigate', async () => {
      const { data } = setup()
      await data.submitSearch('   ')
      expect(toastTitles()).toEqual(['Type an ID to search'])
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
      expect(navigateToMock).not.toHaveBeenCalled()
    })

    it('opens the search page with the trimmed query', async () => {
      const { data } = setup()
      await data.submitSearch('  777777 ')
      expect(navigateToMock).toHaveBeenCalledWith({ path: '/pretty-id/search', query: { q: '777777' } })
      expect(toastAdd).not.toHaveBeenCalled()
    })
  })

  describe('runSearch', () => {
    const result = (id: string) => ({ id, available: true, reason: null, message: null, tier: 'repeat' as const, suggestions: [] })

    it('clears the old result, then stores the new one', async () => {
      const pending = deferred<ReturnType<typeof result>>()
      apiMock.search.mockReturnValue(pending.promise)
      const { store, data } = setup()
      store.setSearch('111111', result('111111'))

      const run = data.runSearch('777777')
      expect(store.searchQuery).toBe('777777')
      expect(store.searchResult).toBeNull()
      expect(store.isSearching).toBe(true)

      pending.resolve(result('777777'))
      await run
      expect(store.searchResult?.id).toBe('777777')
      expect(store.isSearching).toBe(false)
    })

    it('drops the answer of a search that was replaced by a newer one', async () => {
      const older = deferred<ReturnType<typeof result>>()
      const newer = deferred<ReturnType<typeof result>>()
      apiMock.search.mockReturnValueOnce(older.promise)
      apiMock.search.mockReturnValueOnce(newer.promise)
      const { store, data } = setup()

      const first = data.runSearch('111111')
      const second = data.runSearch('222222')
      newer.resolve(result('222222'))
      await second
      older.resolve(result('111111'))
      await first

      expect(store.searchQuery).toBe('222222')
      expect(store.searchResult?.id).toBe('222222')
      expect(store.isSearching).toBe(false)
    })

    it('toasts a failure and leaves no result', async () => {
      apiMock.search.mockRejectedValue(new PrettyIdApiError('invalid', 'Not a valid ID'))
      const { store, data } = setup()
      await data.runSearch('abc')
      expect(toastTitles()).toEqual(['Not a valid ID'])
      expect(store.searchResult).toBeNull()
      expect(store.isSearching).toBe(false)
    })
  })

})
