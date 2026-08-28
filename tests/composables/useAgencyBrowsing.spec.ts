// ========================================
// useAgencyBrowsing Composable Tests
// ========================================
// Regression cover for the agency browse list, which used to scroll forever and
// repeat its first page:
// - The server replaying a page (same `next_cursor`) must terminate the list.
// - Rows already on screen must never be appended a second time.
// - A reset (new search / country filter) must supersede a request already in
//   flight, instead of being swallowed by the `loading` guard.
// - A response with no `meta` must not throw and must stop paginating.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, computed, watch, readonly, toValue } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('toValue', toValue)

interface StubAgency {
  id: number
  name: string
}

interface AgenciesState {
  items: StubAgency[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
  filters: { search: string, country: string }
}

let apiMock = vi.fn()
let agencies: AgenciesState

/** One page of the wire shape `GET /agencies` returns. */
function page(ids: number[], nextCursor: string | null) {
  return {
    data: ids.map(id => ({ id, name: `Agency ${id}` })),
    meta: { next_cursor: nextCursor },
  }
}

function freshAgenciesState(): AgenciesState {
  return {
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    cursor: null,
    filters: { search: '', country: '' },
  }
}

beforeEach(() => {
  vi.resetModules()
  apiMock = vi.fn().mockResolvedValue(page([], null))
  agencies = freshAgenciesState()

  ;(globalThis as Record<string, unknown>).useApi = () => ({
    api: (...args: unknown[]) => apiMock(...args),
    normalizeError: (e: unknown) => ({ message: String(e) }),
  })
  ;(globalThis as Record<string, unknown>).useAgencyStore = () => ({ agencies })
  ;(globalThis as Record<string, unknown>).useToast = () => ({ add: vi.fn() })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'useApi')
  Reflect.deleteProperty(globalThis, 'useAgencyStore')
  Reflect.deleteProperty(globalThis, 'useToast')
})

async function loadComposable() {
  const { useAgencyBrowsing } = await import('~/composables/agency/useAgencyBrowsing')
  return useAgencyBrowsing()
}

/** The cursor the Nth call to the API was made with (undefined = first page). */
function cursorOfCall(index: number): unknown {
  const call = apiMock.mock.calls[index] as [string, { params: Record<string, unknown> }]
  return call[1].params.cursor
}

describe('useAgencyBrowsing — fetchAgencies pagination', () => {
  it('sends the stored cursor when loading the next page', async () => {
    apiMock
      .mockResolvedValueOnce(page([1, 2], 'cursor-2'))
      .mockResolvedValueOnce(page([3, 4], null))

    const { fetchAgencies } = await loadComposable()

    await fetchAgencies({}, true)
    expect(cursorOfCall(0)).toBeUndefined()
    expect(agencies.cursor).toBe('cursor-2')
    expect(agencies.hasMore).toBe(true)

    await fetchAgencies()
    expect(cursorOfCall(1)).toBe('cursor-2')
    expect(agencies.items.map(a => a.id)).toEqual([1, 2, 3, 4])
    expect(agencies.hasMore).toBe(false)
  })

  it('stops paginating when the server replays the cursor it was given', async () => {
    // The exact shape of the cache-key bug: page 2 came back as page 1, with the
    // same next_cursor, so the list grew forever.
    apiMock
      .mockResolvedValueOnce(page([1, 2], 'cursor-2'))
      .mockResolvedValueOnce(page([1, 2], 'cursor-2'))

    const { fetchAgencies } = await loadComposable()

    await fetchAgencies({}, true)
    await fetchAgencies()

    expect(agencies.items.map(a => a.id)).toEqual([1, 2])
    expect(agencies.hasMore).toBe(false)
  })

  it('never appends a row that is already on screen', async () => {
    apiMock
      .mockResolvedValueOnce(page([1, 2, 3], 'cursor-2'))
      .mockResolvedValueOnce(page([3, 4], 'cursor-3'))

    const { fetchAgencies } = await loadComposable()

    await fetchAgencies({}, true)
    await fetchAgencies()

    expect(agencies.items.map(a => a.id)).toEqual([1, 2, 3, 4])
  })

  it('stops paginating on an empty page', async () => {
    apiMock
      .mockResolvedValueOnce(page([1], 'cursor-2'))
      .mockResolvedValueOnce(page([], 'cursor-3'))

    const { fetchAgencies } = await loadComposable()

    await fetchAgencies({}, true)
    await fetchAgencies()

    expect(agencies.items.map(a => a.id)).toEqual([1])
    expect(agencies.hasMore).toBe(false)
  })

  it('stops paginating when the response carries no meta at all', async () => {
    apiMock.mockResolvedValueOnce({ data: [{ id: 1, name: 'Agency 1' }] })

    const { fetchAgencies } = await loadComposable()

    await fetchAgencies({}, true)

    expect(agencies.items.map(a => a.id)).toEqual([1])
    expect(agencies.cursor).toBeNull()
    expect(agencies.hasMore).toBe(false)
    expect(agencies.error).toBeNull()
  })
})

describe('useAgencyBrowsing — fetchAgencies filter changes', () => {
  it('lets a new filter supersede a request already in flight', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined
    apiMock
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce(page([9], null))

    const { fetchAgencies } = await loadComposable()

    const slow = fetchAgencies({ search: '1', country: '' }, true)
    const fast = fetchAgencies({ search: '99', country: '' }, true)

    // The stale page resolves last and must be discarded, not rendered.
    resolveFirst?.(page([1, 2], 'cursor-2'))
    await Promise.all([slow, fast])

    expect(apiMock).toHaveBeenCalledTimes(2)
    expect(agencies.items.map(a => a.id)).toEqual([9])
    expect(agencies.loading).toBe(false)
  })

  it('does not start a second load-more while one is in flight', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined
    apiMock.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))

    const { fetchAgencies } = await loadComposable()

    const first = fetchAgencies()
    await fetchAgencies()

    expect(apiMock).toHaveBeenCalledTimes(1)

    resolveFirst?.(page([1], null))
    await first
  })

  it('forwards search and country only when they are non-empty', async () => {
    apiMock.mockResolvedValue(page([1], null))

    const { fetchAgencies } = await loadComposable()

    await fetchAgencies({ search: ' 1024 ', country: 'PK' }, true)
    const withFilters = apiMock.mock.calls[0]![1].params
    expect(withFilters.search).toBe('1024')
    expect(withFilters.country).toBe('PK')

    agencies.filters = { search: '', country: '' }
    await fetchAgencies({ search: '', country: '' }, true)
    const withoutFilters = apiMock.mock.calls[1]![1].params
    expect(withoutFilters).not.toHaveProperty('search')
    expect(withoutFilters).not.toHaveProperty('country')
  })
})
