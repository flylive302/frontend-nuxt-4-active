// ========================================
// Owner Income — GATE / EXECUTE / REACT
// ========================================
// Window-centric owner/admin "Member Income" page. A window is either a Run N
// preset or a custom range of UTC days; both serve the same shapes from
// sibling endpoint families, so every call here is built from one
// `OwnerIncomeWindowSelection` via `ownerIncomeWindowEndpoint()`.
//
// One overview call on load, then per window one summary call (cached for the
// visit) and the members list (page 1 on first view, then load more / sort /
// search — all server-side, every query change restarts at page 1). Tapping a
// member opens their sheet (one call per member per window, cached for the
// visit). Re-selecting a window already loaded, or reopening a sheet already
// loaded, makes NO request.

import type {
  OwnerIncomeMemberRow,
  OwnerIncomeMemberSheet,
  OwnerIncomeMemberSort,
  OwnerIncomeMembersPage,
  OwnerIncomeOverview,
  OwnerIncomeSortDirection,
  OwnerIncomeWindowSelection,
  OwnerIncomeWindowSummary,
} from '~/types/income/ownerIncome'
import { checkOwnerIncomeRange, ownerIncomeWindowEndpoint, ownerIncomeWindowKey } from '~/utils/ownerIncomeWindow'

const MEMBERS_SEARCH_DEBOUNCE_MS = 300
/** Mirrors the API's `search` max length — a longer term would be a 422. */
const MEMBERS_SEARCH_MAX_LENGTH = 100
const DEFAULT_MEMBERS_QUERY = { sort: 'income', direction: 'desc', search: '' } as const

/**
 * Monotonic across composable instances and page visits, so a response from a
 * previous visit can never match a list the new visit created.
 */
let membersRequestSeq = 0
/** Same guarantee as `membersRequestSeq`, for member sheet requests. */
let memberSheetRequestSeq = 0

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

  /** EXECUTE — one window's heroes, cached under that window's key. */
  async function fetchWindowSummary(selection: OwnerIncomeWindowSelection): Promise<void> {
    const windowKey = ownerIncomeWindowKey(selection)
    const { url, query } = ownerIncomeWindowEndpoint(selection)

    store.setWindowLoading(windowKey, true)

    try {
      const response = await api<{ success: true; data: OwnerIncomeWindowSummary }>(url, { query })
      store.setSummary(windowKey, response.data)
    } catch (err) {
      const normalized = normalizeError(err)
      toast.add({ title: normalized.message, color: 'error' })
    } finally {
      store.setWindowLoading(windowKey, false)
    }
  }

  /**
   * EXECUTE — one page of a window's members under the list's applied query.
   * Only the latest request for the list may write: a response superseded by a
   * sort/search change, another page 1, or a page reset is dropped silently.
   */
  async function fetchMembersPage(selection: OwnerIncomeWindowSelection, page: number): Promise<void> {
    const windowKey = ownerIncomeWindowKey(selection)
    const list = store.memberList(windowKey)
    if (!list) return

    const requestId = ++membersRequestSeq
    store.setMemberListRequest(windowKey, requestId, page)
    const isCurrent = () => store.memberList(windowKey)?.requestId === requestId

    const { url, query } = ownerIncomeWindowEndpoint(selection, '/members')

    try {
      const response = await api<{ success: true; data: OwnerIncomeMembersPage }>(url, {
        query: {
          ...query,
          page,
          sort: list.sort,
          direction: list.direction,
          ...(list.search !== '' ? { search: list.search } : {}),
        },
      })
      if (!isCurrent()) return
      const { members, meta } = response.data
      store.setMemberListPage(windowKey, meta.page, members, meta.has_more)
    } catch (err) {
      if (!isCurrent()) return
      store.setMemberListError(windowKey, normalizeError(err).message)
    }
  }

  /** EXECUTE — restart a window's list under `query` and load its page 1. */
  async function restartMembers(
    selection: OwnerIncomeWindowSelection,
    query: { sort: OwnerIncomeMemberSort; direction: OwnerIncomeSortDirection; search: string }
  ): Promise<void> {
    store.setMemberListQuery(ownerIncomeWindowKey(selection), query)
    await fetchMembersPage(selection, 1)
  }

  /**
   * First view of a window's list (default query), or a retry of a page 1 that
   * failed. A list with rows or a request in flight is left alone.
   */
  async function ensureMembers(selection: OwnerIncomeWindowSelection): Promise<void> {
    const list = store.memberList(ownerIncomeWindowKey(selection))

    if (!list) {
      await restartMembers(selection, { ...DEFAULT_MEMBERS_QUERY })
      return
    }

    if (list.page === 0 && list.loadingPage === null) {
      await fetchMembersPage(selection, 1)
    }
  }

  /**
   * Show a window (run or range). A window already loaded re-selects instantly
   * — heroes come from the cache and the list keeps its rows, scroll offset and
   * applied query — so no request is made.
   */
  async function selectWindow(selection: OwnerIncomeWindowSelection): Promise<void> {
    const windowKey = ownerIncomeWindowKey(selection)
    store.setSelectedWindow(selection)

    // GATE — a cached window needs no summary; one in flight is not re-requested.
    const needsSummary = store.summary(windowKey) === null && !store.isWindowLoading(windowKey)

    // EXECUTE — summary and members page 1 in parallel.
    await Promise.all([
      needsSummary ? fetchWindowSummary(selection) : Promise.resolve(),
      ensureMembers(selection),
    ])
  }

  /** Show Run `cycleNumber`. */
  async function selectCycle(cycleNumber: number): Promise<void> {
    await selectWindow({ kind: 'run', number: cycleNumber })
  }

  /**
   * Show the custom range `[from, to]` (`YYYY-MM-DD`, UTC days).
   *
   * GATE — the feature has to be enabled (every range endpoint 404s otherwise)
   * and the days must satisfy the bounds the overview published. Both checks
   * read published state, never a locally computed "today": the device's
   * calendar day runs ahead of UTC for part of the day, so a local max would
   * offer a day the server rejects. REACT — an invalid range is a toast, not a
   * request.
   */
  async function applyRange(from: string, to: string): Promise<void> {
    if (!store.rangesEnabled) return

    const check = checkOwnerIncomeRange(from, to, store.rangeLimits)

    if (!check.valid) {
      toast.add({ title: check.message, color: 'error' })
      return
    }

    await selectWindow({ kind: 'range', from, to })
  }

  /** Next page of the selected window's members (the "Load more" button). */
  async function loadMoreMembers(): Promise<void> {
    const selection = store.selectedWindow
    const list = store.selectedMemberList

    // GATE — nothing more to load, or a page already in flight.
    if (selection === null || !list || !list.hasMore || list.loadingPage !== null) return

    await fetchMembersPage(selection, list.page + 1)
  }

  /**
   * Retry after a failed load: page 1 when nothing loaded yet, otherwise the
   * next page (the load more that failed).
   */
  async function retryMembers(): Promise<void> {
    const selection = store.selectedWindow
    const list = store.selectedMemberList

    // GATE
    if (selection === null || !list || list.loadingPage !== null) return

    await fetchMembersPage(selection, list.page + 1)
  }

  async function setMembersSort(sort: OwnerIncomeMemberSort): Promise<void> {
    const selection = store.selectedWindow
    const list = store.selectedMemberList

    // GATE — unchanged sort makes no request.
    if (selection === null || !list || list.sort === sort) return

    await restartMembers(selection, { sort, direction: list.direction, search: list.search })
  }

  async function setMembersDirection(direction: OwnerIncomeSortDirection): Promise<void> {
    const selection = store.selectedWindow
    const list = store.selectedMemberList

    // GATE — unchanged direction makes no request.
    if (selection === null || !list || list.direction === direction) return

    await restartMembers(selection, { sort: list.sort, direction, search: list.search })
  }

  /** Commit a (trimmed) search term to one window's list — page 1 under it. */
  async function applyMembersSearch(selection: OwnerIncomeWindowSelection, term: string): Promise<void> {
    const list = store.memberList(ownerIncomeWindowKey(selection))
    const search = term.trim().slice(0, MEMBERS_SEARCH_MAX_LENGTH)

    // GATE — unchanged term (e.g. only whitespace typed) makes no request.
    if (!list || list.search === search) return

    await restartMembers(selection, { sort: list.sort, direction: list.direction, search })
  }

  /**
   * Debounced search on the selected window. The window is captured now, so a
   * term typed just before a window switch still lands on the window it was
   * typed for.
   */
  function setMembersSearch(term: string): void {
    const selection = store.selectedWindow
    if (selection === null) return

    if (searchTimer !== null) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      searchTimer = null
      void applyMembersSearch(selection, term)
    }, MEMBERS_SEARCH_DEBOUNCE_MS)
  }

  function cancelPendingSearch(): void {
    if (searchTimer !== null) clearTimeout(searchTimer)
    searchTimer = null
  }

  /**
   * EXECUTE — one member's sheet for a window. Only the latest request may
   * write: a response for a sheet that was closed, replaced by another
   * member's, or wiped by a page reset is dropped silently.
   */
  async function fetchMemberSheet(selection: OwnerIncomeWindowSelection, userId: number): Promise<void> {
    const requestId = ++memberSheetRequestSeq
    store.setMemberSheetRequest(requestId)
    const isCurrent = () => store.memberSheetRequestId === requestId

    const { url, query } = ownerIncomeWindowEndpoint(selection, `/members/${userId}`)

    try {
      const response = await api<{ success: true; data: OwnerIncomeMemberSheet }>(url, { query })
      if (!isCurrent()) return
      store.setMemberSheet(ownerIncomeWindowKey(selection), response.data)
    } catch (err) {
      if (!isCurrent()) return
      store.setMemberSheetError(normalizeError(err).message)
    }
  }

  /**
   * Open a member's sheet on the selected window; a sheet already viewed
   * reopens with no request.
   *
   * GATE — in RUN mode only a row with a run has a sheet (the endpoint 404s
   * otherwise). In RANGE mode `run_id` is null on every row and the endpoint
   * answers for anyone in the roster, so every row opens — reading `run_id`
   * here would silently kill the whole feature.
   */
  async function openMember(row: OwnerIncomeMemberRow): Promise<void> {
    const selection = store.selectedWindow

    if (selection === null) return
    if (selection.kind === 'run' && row.run_id === null) return

    const windowKey = ownerIncomeWindowKey(selection)

    // GATE — this member's sheet is already open and loading (double tap).
    const open = store.openMember
    if (
      open !== null
      && ownerIncomeWindowKey(open.window) === windowKey
      && open.member.user_id === row.user_id
      && store.isMemberSheetLoading
    ) return

    store.setOpenMember({
      window: selection,
      member: { user_id: row.user_id, name: row.name, avatar_url: row.avatar_url, signature: row.signature, left: row.left },
    })

    if (store.memberSheet(windowKey, row.user_id)) {
      store.clearMemberSheetRequest()
      return
    }

    await fetchMemberSheet(selection, row.user_id)
  }

  /** Close the sheet; a request still in flight becomes stale. The cache is kept. */
  function closeMember(): void {
    store.setOpenMember(null)
    store.clearMemberSheetRequest()
  }

  /** Retry the open sheet after a failed load. */
  async function retryMemberSheet(): Promise<void> {
    const open = store.openMember

    // GATE
    if (open === null || store.isMemberSheetLoading) return
    if (store.memberSheet(ownerIncomeWindowKey(open.window), open.member.user_id)) return

    await fetchMemberSheet(open.window, open.member.user_id)
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

  /** Reload the selected window's heroes + list after a failed load. */
  async function retrySelectedWindow(): Promise<void> {
    const selection = store.selectedWindow
    if (selection === null) return

    await selectWindow(selection)
  }

  return {
    fetchOverview,
    fetchWindowSummary,
    selectWindow,
    selectCycle,
    applyRange,
    retrySelectedWindow,
    loadMoreMembers,
    retryMembers,
    setMembersSort,
    setMembersDirection,
    setMembersSearch,
    cancelPendingSearch,
    openMember,
    closeMember,
    retryMemberSheet,
    loadOwnerIncomePage,
  }
}
