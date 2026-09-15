// ========================================
// Owner Income — GATE / EXECUTE / REACT
// ========================================
// Cycle-centric owner/admin "Member Income" page: one overview call on load,
// then per cycle one summary call (cached for the visit) and the members list
// (page 1 on first view, then load more / sort / search — all server-side,
// every query change restarts at page 1).

import type {
  OwnerIncomeCycleSummary,
  OwnerIncomeMemberSort,
  OwnerIncomeMembersPage,
  OwnerIncomeOverview,
  OwnerIncomeSortDirection,
} from '~/types/income/ownerIncome'

const MEMBERS_SEARCH_DEBOUNCE_MS = 300
/** Mirrors the API's `search` max length — a longer term would be a 422. */
const MEMBERS_SEARCH_MAX_LENGTH = 100
const DEFAULT_MEMBERS_QUERY = { sort: 'income', direction: 'desc', search: '' } as const

/**
 * Monotonic across composable instances and page visits, so a response from a
 * previous visit can never match a list the new visit created.
 */
let membersRequestSeq = 0

export function useOwnerIncomeActions() {
  const store = useOwnerIncomeStore()
  const toast = useToast()
  const { api, normalizeError } = useApi()

  let searchTimer: ReturnType<typeof setTimeout> | null = null

  async function fetchOverview(): Promise<void> {
    store.setOverviewLoading(true)
    store.setOverviewError(null)

    try {
      const response = await api<{ success: true; data: OwnerIncomeOverview }>('/user/agency/income/overview')
      store.setOverview(response.data)
    } catch (err) {
      const normalized = normalizeError(err)
      store.setOverviewError(normalized.message)
    } finally {
      store.setOverviewLoading(false)
    }
  }

  async function fetchCycleSummary(cycleNumber: number): Promise<void> {
    store.setCycleLoading(cycleNumber, true)

    try {
      const response = await api<{ success: true; data: OwnerIncomeCycleSummary }>(
        `/user/agency/income/cycles/${cycleNumber}`
      )
      store.setSummary(response.data)
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: normalized.message, color: 'error' })
    } finally {
      store.setCycleLoading(cycleNumber, false)
    }
  }

  /**
   * EXECUTE — one page of a cycle's members under the list's applied query.
   * Only the latest request for the list may write: a response superseded by a
   * sort/search change, another page 1, or a page reset is dropped silently.
   */
  async function fetchMembersPage(cycleNumber: number, page: number): Promise<void> {
    const list = store.memberList(cycleNumber)
    if (!list) return

    const requestId = ++membersRequestSeq
    store.setMemberListRequest(cycleNumber, requestId, page)
    const isCurrent = () => store.memberList(cycleNumber)?.requestId === requestId

    try {
      const response = await api<{ success: true; data: OwnerIncomeMembersPage }>(
        `/user/agency/income/cycles/${cycleNumber}/members`,
        {
          query: {
            page,
            sort: list.sort,
            direction: list.direction,
            ...(list.search !== '' ? { search: list.search } : {}),
          },
        }
      )
      if (!isCurrent()) return
      const { members, meta } = response.data
      store.setMemberListPage(cycleNumber, meta.page, members, meta.has_more)
    } catch (err) {
      if (!isCurrent()) return
      store.setMemberListError(cycleNumber, normalizeError(err).message)
    }
  }

  /** EXECUTE — restart a cycle's list under `query` and load its page 1. */
  async function restartMembers(
    cycleNumber: number,
    query: { sort: OwnerIncomeMemberSort; direction: OwnerIncomeSortDirection; search: string }
  ): Promise<void> {
    store.setMemberListQuery(cycleNumber, query)
    await fetchMembersPage(cycleNumber, 1)
  }

  /**
   * First view of a cycle's list (default query), or a retry of a page 1 that
   * failed. A list with rows or a request in flight is left alone.
   */
  async function ensureMembers(cycleNumber: number): Promise<void> {
    const list = store.memberList(cycleNumber)

    if (!list) {
      await restartMembers(cycleNumber, { ...DEFAULT_MEMBERS_QUERY })
      return
    }

    if (list.page === 0 && list.loadingPage === null) {
      await fetchMembersPage(cycleNumber, 1)
    }
  }

  async function selectCycle(cycleNumber: number): Promise<void> {
    store.setSelectedCycle(cycleNumber)

    // GATE — a cached cycle re-selects instantly; one in flight is not re-requested.
    const needsSummary = !store.summaries[cycleNumber] && !store.isCycleLoading(cycleNumber)

    // EXECUTE — summary and members page 1 in parallel.
    await Promise.all([
      needsSummary ? fetchCycleSummary(cycleNumber) : Promise.resolve(),
      ensureMembers(cycleNumber),
    ])
  }

  /** Next page of the selected cycle's members (the "Load more" button). */
  async function loadMoreMembers(): Promise<void> {
    const cycleNumber = store.selectedCycle
    const list = store.selectedMemberList

    // GATE — nothing more to load, or a page already in flight.
    if (cycleNumber === null || !list || !list.hasMore || list.loadingPage !== null) return

    await fetchMembersPage(cycleNumber, list.page + 1)
  }

  /**
   * Retry after a failed load: page 1 when nothing loaded yet, otherwise the
   * next page (the load more that failed).
   */
  async function retryMembers(): Promise<void> {
    const cycleNumber = store.selectedCycle
    const list = store.selectedMemberList

    // GATE
    if (cycleNumber === null || !list || list.loadingPage !== null) return

    await fetchMembersPage(cycleNumber, list.page + 1)
  }

  async function setMembersSort(sort: OwnerIncomeMemberSort): Promise<void> {
    const cycleNumber = store.selectedCycle
    const list = store.selectedMemberList

    // GATE — unchanged sort makes no request.
    if (cycleNumber === null || !list || list.sort === sort) return

    await restartMembers(cycleNumber, { sort, direction: list.direction, search: list.search })
  }

  async function setMembersDirection(direction: OwnerIncomeSortDirection): Promise<void> {
    const cycleNumber = store.selectedCycle
    const list = store.selectedMemberList

    // GATE — unchanged direction makes no request.
    if (cycleNumber === null || !list || list.direction === direction) return

    await restartMembers(cycleNumber, { sort: list.sort, direction, search: list.search })
  }

  /** Commit a (trimmed) search term to one cycle's list — page 1 under it. */
  async function applyMembersSearch(cycleNumber: number, term: string): Promise<void> {
    const list = store.memberList(cycleNumber)
    const search = term.trim().slice(0, MEMBERS_SEARCH_MAX_LENGTH)

    // GATE — unchanged term (e.g. only whitespace typed) makes no request.
    if (!list || list.search === search) return

    await restartMembers(cycleNumber, { sort: list.sort, direction: list.direction, search })
  }

  /**
   * Debounced search on the selected cycle. The cycle is captured now, so a
   * term typed just before a cycle switch still lands on the cycle it was
   * typed for.
   */
  function setMembersSearch(term: string): void {
    const cycleNumber = store.selectedCycle
    if (cycleNumber === null) return

    if (searchTimer !== null) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      searchTimer = null
      void applyMembersSearch(cycleNumber, term)
    }, MEMBERS_SEARCH_DEBOUNCE_MS)
  }

  function cancelPendingSearch(): void {
    if (searchTimer !== null) clearTimeout(searchTimer)
    searchTimer = null
  }

  /**
   * Page load: fresh state, the overview, then the default cycle (in progress,
   * else the newest listed). An agency that never had a run has no default
   * cycle, so no summary is requested and the page shows its empty state.
   */
  async function loadOwnerIncomePage(): Promise<void> {
    cancelPendingSearch()
    store.reset()
    await fetchOverview()

    const cycleNumber = store.defaultCycle
    if (cycleNumber !== null) {
      await selectCycle(cycleNumber)
    }
  }

  return {
    fetchOverview,
    fetchCycleSummary,
    selectCycle,
    loadMoreMembers,
    retryMembers,
    setMembersSort,
    setMembersDirection,
    setMembersSearch,
    cancelPendingSearch,
    loadOwnerIncomePage,
  }
}
