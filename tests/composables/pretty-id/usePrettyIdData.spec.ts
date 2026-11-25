import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, nextTick, readonly, ref, watch } from 'vue'
import { useBrowseTierLoader, usePrettyIdData } from '~/composables/pretty-id/usePrettyIdData'
import { usePrettyIdStore } from '~/stores/prettyId'
import type { PrettyIdListResponse } from '~/types/pretty-id'
import { PrettyIdApiError } from '~/utils/pretty-id-error'
import { createApiMock, deferred, makeClaimed, makeItem, makeList, makeMe, resetApiMock } from '../../helpers/prettyIdFixtures'

const apiMock = createApiMock()
const toastAdd = vi.fn()

vi.mock('~/composables/pretty-id/usePrettyIdApi', () => ({
  usePrettyIdApi: () => apiMock,
}))
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('watch', watch)
vi.stubGlobal('useToast', () => ({ add: toastAdd }))

function toastTitles(): string[] {
  return toastAdd.mock.calls.map(([options]) => (options as { title: string }).title)
}

describe('usePrettyIdData', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetApiMock(apiMock)
    toastAdd.mockReset()
  })

  /** A store whose `me` is loaded: 6-digit tier browsable, 4-digit locked. */
  function setup(me = makeMe()) {
    const store = usePrettyIdStore()
    store.setMe(me)
    return { store, data: usePrettyIdData() }
  }

  // ========================================
  // me
  // ========================================

  describe('loadMe', () => {
    it('stores me', async () => {
      const store = usePrettyIdStore()
      await usePrettyIdData().loadMe()
      expect(store.me?.wealth_level).toBe(20)
      expect(store.isMeLoading).toBe(false)
    })

    it('flags a failed FIRST load for the retry screen instead of toasting', async () => {
      apiMock.me.mockRejectedValue(new PrettyIdApiError('unknown', 'Server down'))
      const store = usePrettyIdStore()
      await usePrettyIdData().loadMe()
      expect(store.me).toBeNull()
      expect(store.isMeFailed).toBe(true)
      expect(store.isMeLoading).toBe(false)
      expect(toastTitles()).toEqual([])
    })

    it('clears the failed flag once a retry succeeds', async () => {
      apiMock.me.mockRejectedValueOnce(new PrettyIdApiError('unknown', 'Server down'))
      const store = usePrettyIdStore()
      const data = usePrettyIdData()
      await data.loadMe()
      await data.loadMe()
      expect(store.me).not.toBeNull()
      expect(store.isMeFailed).toBe(false)
    })

    it('toasts a failed REFRESH and keeps the page on the previous me', async () => {
      const { store, data } = setup()
      const loaded = store.me
      apiMock.me.mockRejectedValue(new PrettyIdApiError('unknown', 'Server down'))
      await data.loadMe()
      expect(store.me).toStrictEqual(loaded)
      expect(store.isMeFailed).toBe(false)
      expect(toastTitles()).toEqual(['Server down'])
    })
  })

  // ========================================
  // browse list
  // ========================================

  describe('loadList', () => {
    it('asks for the active tier and category and stores page, total and cursor', async () => {
      apiMock.list.mockResolvedValue(makeList([makeItem('111111', 'legend')], { total: 812, next_cursor: 'c2' }))
      const { store, data } = setup()
      store.setCategory('legend')

      await data.loadList()

      expect(apiMock.list).toHaveBeenCalledWith({ tier: 6, category: 'legend' })
      expect(store.items).toEqual([makeItem('111111', 'legend')])
      expect(store.itemsTotal).toBe(812)
      expect(store.nextCursor).toBe('c2')
      expect(store.isListLoading).toBe(false)
      expect(store.isListFailed).toBe(false)
    })

    it('sends no category when the filter is clear', async () => {
      const { data } = setup()
      await data.loadList()
      expect(apiMock.list).toHaveBeenCalledWith({ tier: 6, category: null })
    })

    it.each([
      ['locked', makeMe(), 4],
      ['claimed', makeMe({}, { six: { claimed: makeClaimed('123456') } }), 6],
    ] as const)('does not call the API for a %s tier and clears the list', async (_name, me, tier) => {
      const { store, data } = setup(me)
      store.setActiveTier(tier)
      store.setList([makeItem('999999')], 1, null)
      await data.loadList()
      expect(apiMock.list).not.toHaveBeenCalled()
      expect(store.items).toEqual([])
    })

    it('does not call the API before me has loaded', async () => {
      const store = usePrettyIdStore()
      await usePrettyIdData().loadList()
      expect(apiMock.list).not.toHaveBeenCalled()
      expect(store.isListLoading).toBe(false)
    })

    it('drops a response whose query changed while it was in flight', async () => {
      const slow = deferred<PrettyIdListResponse>()
      apiMock.list.mockReturnValueOnce(slow.promise)
      apiMock.list.mockResolvedValueOnce(makeList([makeItem('222222', 'mirror')]))
      const { store, data } = setup()

      const stale = data.loadList() // no category
      await data.toggleCategory('mirror') // newer query resolves first
      expect(store.items).toEqual([makeItem('222222', 'mirror')])
      slow.resolve(makeList([makeItem('999999')]))
      await stale

      expect(store.items).toEqual([makeItem('222222', 'mirror')])
      expect(store.isListLoading).toBe(false)
    })

    it('keeps the loading flag on while only a stale response has returned', async () => {
      const first = deferred<PrettyIdListResponse>()
      const second = deferred<PrettyIdListResponse>()
      apiMock.list.mockReturnValueOnce(first.promise)
      apiMock.list.mockReturnValueOnce(second.promise)
      const { store, data } = setup()

      const stale = data.loadList()
      const fresh = data.toggleCategory('lucky')
      first.resolve(makeList([]))
      await stale
      expect(store.isListLoading).toBe(true)

      second.resolve(makeList([makeItem('123456')]))
      await fresh
      expect(store.isListLoading).toBe(false)
      expect(store.items).toEqual([makeItem('123456')])
    })

    it('flags a failed load and toasts the reason', async () => {
      apiMock.list.mockRejectedValue(new PrettyIdApiError('unknown', 'List down'))
      const { store, data } = setup()
      await data.loadList()
      expect(store.isListFailed).toBe(true)
      expect(store.isListLoading).toBe(false)
      expect(toastTitles()).toEqual(['List down'])
    })

    it('refreshes me when the server says the tier is locked', async () => {
      apiMock.list.mockRejectedValue(new PrettyIdApiError('level_required'))
      apiMock.me.mockResolvedValue(makeMe({ wealth_level: 5 }, { six: { unlocked: false } }))
      const { store, data } = setup()
      await data.loadList()
      expect(apiMock.me).toHaveBeenCalledTimes(1)
      await vi.waitFor(() => expect(store.tierMode).toBe('locked'))
    })
  })

  describe('loadMore', () => {
    it('appends the next page with the cursor and follows the new cursor', async () => {
      apiMock.list.mockResolvedValue(makeList([makeItem('333333')], { total: 3, next_cursor: null }))
      const { store, data } = setup()
      store.setCategory('lucky')
      store.setList([makeItem('111111'), makeItem('222222')], 3, 'c2')

      await data.loadMore()

      expect(apiMock.list).toHaveBeenCalledWith({ tier: 6, category: 'lucky', cursor: 'c2' })
      expect(store.items.map(item => item.signature)).toEqual(['111111', '222222', '333333'])
      expect(store.nextCursor).toBeNull()
      expect(store.isListLoadingMore).toBe(false)
    })

    it('does nothing without a cursor', async () => {
      const { store, data } = setup()
      store.setList([makeItem('111111')], 1, null)
      await data.loadMore()
      expect(apiMock.list).not.toHaveBeenCalled()
    })

    it('ignores a second call while a page is loading', async () => {
      const slow = deferred<PrettyIdListResponse>()
      apiMock.list.mockReturnValue(slow.promise)
      const { store, data } = setup()
      store.setList([makeItem('111111')], 2, 'c2')

      const first = data.loadMore()
      await data.loadMore()
      expect(apiMock.list).toHaveBeenCalledTimes(1)
      slow.resolve(makeList([makeItem('222222')]))
      await first
    })

    it('drops a page that answered a list the user has since filtered away', async () => {
      const slow = deferred<PrettyIdListResponse>()
      apiMock.list.mockReturnValueOnce(slow.promise)
      apiMock.list.mockResolvedValueOnce(makeList([makeItem('444444', 'couple')], { next_cursor: null }))
      const { store, data } = setup()
      store.setList([makeItem('111111')], 2, 'c2')

      const stale = data.loadMore()
      await data.toggleCategory('couple')
      slow.resolve(makeList([makeItem('222222')]))
      await stale

      expect(store.items).toEqual([makeItem('444444', 'couple')])
      expect(store.isListLoadingMore).toBe(false)
    })

    it('toasts a failed page and keeps the list', async () => {
      apiMock.list.mockRejectedValue(new PrettyIdApiError('unknown', 'Page down'))
      const { store, data } = setup()
      store.setList([makeItem('111111')], 2, 'c2')
      await data.loadMore()
      expect(store.items).toEqual([makeItem('111111')])
      expect(store.isListFailed).toBe(false)
      expect(store.isListLoadingMore).toBe(false)
      expect(toastTitles()).toEqual(['Page down'])
    })
  })

  describe('selectTier / toggleCategory', () => {
    it('switching tier resets the filter, the search and the old list', () => {
      const { store, data } = setup()
      store.setCategory('mirror')
      store.setList([makeItem('111111')], 1, 'c')
      store.setSearch('111111', 'available', makeItem('111111'))

      data.selectTier(4)

      expect(store.activeTier).toBe(4)
      expect(store.category).toBeNull()
      expect(store.items).toEqual([])
      expect(store.searchStatus).toBe('idle')
      expect(store.searchQuery).toBe('')
    })

    it('re-selecting the active tier changes nothing', () => {
      const { store, data } = setup()
      store.setList([makeItem('111111')], 1, null)
      data.selectTier(6)
      expect(store.items).toHaveLength(1)
    })

    it('tapping a category filters; tapping the active one clears it', async () => {
      const { store, data } = setup()
      await data.toggleCategory('sequence')
      expect(store.category).toBe('sequence')
      expect(apiMock.list).toHaveBeenLastCalledWith({ tier: 6, category: 'sequence' })
      await data.toggleCategory('sequence')
      expect(store.category).toBeNull()
      expect(apiMock.list).toHaveBeenLastCalledWith({ tier: 6, category: null })
    })
  })

  // ========================================
  // search
  // ========================================

  describe('runSearch', () => {
    it('looks the exact number up in the active tier, without the category filter', async () => {
      apiMock.list.mockResolvedValue(makeList([makeItem('888888', 'legend')]))
      const { store, data } = setup()
      store.setCategory('lucky')

      await data.runSearch(' 888888 ')

      expect(apiMock.list).toHaveBeenCalledWith({ tier: 6, q: '888888' })
      expect(store.searchStatus).toBe('available')
      expect(store.searchResult).toEqual(makeItem('888888', 'legend'))
      expect(store.searchQuery).toBe('888888')
    })

    it('reports a number the server does not list as unavailable', async () => {
      apiMock.list.mockResolvedValue(makeList([]))
      const { store, data } = setup()
      await data.runSearch('123456')
      expect(store.searchStatus).toBe('unavailable')
      expect(store.searchResult).toBeNull()
    })

    it('treats a returned number that is not the one searched as unavailable', async () => {
      apiMock.list.mockResolvedValue(makeList([makeItem('999999')]))
      const { store, data } = setup()
      await data.runSearch('123456')
      expect(store.searchStatus).toBe('unavailable')
    })

    it.each(['12345', '1234567', '12ab56'])('answers %s unavailable without a request', async (q) => {
      const { store, data } = setup()
      await data.runSearch(q)
      expect(apiMock.list).not.toHaveBeenCalled()
      expect(store.searchStatus).toBe('unavailable')
      expect(store.searchQuery).toBe(q)
    })

    it('uses the 4-digit length on the 4-digit tier', async () => {
      apiMock.list.mockResolvedValue(makeList([makeItem('8888')]))
      const { store, data } = setup(makeMe({ wealth_level: 40 }, { four: { unlocked: true } }))
      store.setActiveTier(4)
      await data.runSearch('8888')
      expect(apiMock.list).toHaveBeenCalledWith({ tier: 4, q: '8888' })
      expect(store.searchStatus).toBe('available')
    })

    it('an empty box clears the search', async () => {
      const { store, data } = setup()
      store.setSearch('123456', 'unavailable')
      await data.runSearch('  ')
      expect(store.searchStatus).toBe('idle')
      expect(store.searchQuery).toBe('')
      expect(apiMock.list).not.toHaveBeenCalled()
    })

    it('does not search a tier that is not browsable', async () => {
      const { store, data } = setup()
      store.setActiveTier(4)
      await data.runSearch('1234')
      expect(apiMock.list).not.toHaveBeenCalled()
      expect(store.searchStatus).toBe('idle')
    })

    it('a newer search wins over a slower earlier one', async () => {
      const slow = deferred<PrettyIdListResponse>()
      apiMock.list.mockReturnValueOnce(slow.promise)
      apiMock.list.mockResolvedValueOnce(makeList([makeItem('222222')]))
      const { store, data } = setup()

      const first = data.runSearch('111111')
      await data.runSearch('222222')
      slow.resolve(makeList([makeItem('111111')]))
      await first

      expect(store.searchQuery).toBe('222222')
      expect(store.searchResult).toEqual(makeItem('222222'))
    })

    it('drops a search that answered before a tier switch', async () => {
      const slow = deferred<PrettyIdListResponse>()
      apiMock.list.mockReturnValueOnce(slow.promise)
      const { store, data } = setup(makeMe({ wealth_level: 40 }, { four: { unlocked: true } }))

      const pending = data.runSearch('111111')
      data.selectTier(4)
      slow.resolve(makeList([makeItem('111111')]))
      await pending

      expect(store.searchStatus).toBe('idle')
      expect(store.searchResult).toBeNull()
    })

    it('marks a failed lookup and toasts', async () => {
      apiMock.list.mockRejectedValue(new PrettyIdApiError('unknown', 'Lookup down'))
      const { store, data } = setup()
      await data.runSearch('123456')
      expect(store.searchStatus).toBe('failed')
      expect(toastTitles()).toEqual(['Lookup down'])
    })
  })
})

describe('useBrowseTierLoader', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetApiMock(apiMock)
    toastAdd.mockReset()
  })

  it('does not load while `me` has not arrived', async () => {
    useBrowseTierLoader()
    await nextTick()
    expect(apiMock.list).not.toHaveBeenCalled()
  })

  it('loads once `me` arrives with a browsable tier', async () => {
    const store = usePrettyIdStore()
    useBrowseTierLoader()
    store.setMe(makeMe())
    await vi.waitFor(() => expect(apiMock.list).toHaveBeenCalledTimes(1))
  })

  it('loads on entry when `me` is already there', async () => {
    const store = usePrettyIdStore()
    store.setMe(makeMe())
    useBrowseTierLoader()
    await vi.waitFor(() => expect(apiMock.list).toHaveBeenCalledTimes(1))
  })

  it('does not load a locked tier', async () => {
    const store = usePrettyIdStore()
    store.setMe(makeMe())
    store.setActiveTier(4)
    useBrowseTierLoader()
    await nextTick()
    expect(store.tierMode).toBe('locked')
    expect(apiMock.list).not.toHaveBeenCalled()
  })
})
