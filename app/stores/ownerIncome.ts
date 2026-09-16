// ========================================
// Owner Income Store
// ========================================
// State + computed + setters ONLY — useOwnerIncomeActions for API.
// Window-centric owner/admin "Member Income" page: overview (agency + cycles +
// the custom-range gate), the selected window, and — all keyed by that
// window's key — a summary cache (Members / Owner heroes), a members list
// (rows, paging, applied sort/search) and the member bottom sheet cache.
//
// The window key is `run:N` for a Run N preset and `range:FROM|TO` for a
// custom date range (`ownerIncomeWindowKey`). Every keyed setter takes that
// key explicitly: a range's `window.number` is null, so nothing here may
// derive a key from a response.
//
// Everything lives for one page visit; the page load resets it.

import { defineStore } from 'pinia'
import type {
  OwnerIncomeCycle,
  OwnerIncomeMemberList,
  OwnerIncomeMemberRow,
  OwnerIncomeMemberSheet,
  OwnerIncomeMemberSort,
  OwnerIncomeOpenMember,
  OwnerIncomeOverview,
  OwnerIncomeRangeLimits,
  OwnerIncomeSortDirection,
  OwnerIncomeWindow,
  OwnerIncomeWindowKind,
  OwnerIncomeWindowSelection,
  OwnerIncomeWindowSummary,
} from '~/types/income/ownerIncome'
import {
  ownerIncomeRangeLabel,
  ownerIncomeSheetKey,
  ownerIncomeWindowKey,
} from '~/utils/ownerIncomeWindow'

export const useOwnerIncomeStore = defineStore('ownerIncome', () => {
  const overview = ref<OwnerIncomeOverview | null>(null)
  const selectedWindow = ref<OwnerIncomeWindowSelection | null>(null)
  const summaries = ref<Record<string, OwnerIncomeWindowSummary>>({})
  const memberLists = ref<Record<string, OwnerIncomeMemberList>>({})

  /** Loaded sheets, keyed `${windowKey}:${userId}`. */
  const memberSheets = ref<Record<string, OwnerIncomeMemberSheet>>({})
  const openMember = ref<OwnerIncomeOpenMember | null>(null)
  /** The sheet request allowed to land; 0 = none in flight. */
  const memberSheetRequestId = ref(0)
  const memberSheetError = ref<string | null>(null)

  const isOverviewLoading = ref(false)
  const loadingWindows = ref<string[]>([])
  const overviewError = ref<string | null>(null)

  const cycles = computed<OwnerIncomeCycle[]>(() => overview.value?.cycles ?? [])
  const hasCycles = computed(() => cycles.value.length > 0)
  const defaultCycle = computed<number | null>(() => overview.value?.default_cycle ?? null)

  /** False (and the Custom dates entry hidden) until the operator enables ranges. */
  const rangesEnabled = computed(() => overview.value?.ranges_enabled ?? false)
  const rangeLimits = computed<OwnerIncomeRangeLimits | null>(() => overview.value?.range_limits ?? null)

  const selectedWindowKey = computed<string | null>(() =>
    selectedWindow.value === null ? null : ownerIncomeWindowKey(selectedWindow.value)
  )

  const isRangeSelected = computed(() => selectedWindow.value?.kind === 'range')

  /** The selected run number, or null when a range (or nothing) is selected. */
  const selectedCycle = computed<number | null>(() =>
    selectedWindow.value?.kind === 'run' ? selectedWindow.value.number : null
  )

  const selectedSummary = computed<OwnerIncomeWindowSummary | null>(() =>
    selectedWindowKey.value !== null ? (summaries.value[selectedWindowKey.value] ?? null) : null
  )

  /** The server's description of the loaded window — null until its summary lands. */
  const selectedWindowInfo = computed<OwnerIncomeWindow | null>(() => selectedSummary.value?.window ?? null)

  /**
   * Trigger-button text for the selector. The server's label once the summary
   * is in; before that the locally built equivalent, so switching windows
   * never shows a blank or a stale name. Both forms are byte-identical.
   */
  const selectedWindowLabel = computed<string | null>(() => {
    if (selectedWindowInfo.value !== null) return selectedWindowInfo.value.label

    const selection = selectedWindow.value
    if (selection === null) return null

    return selection.kind === 'run'
      ? (cycles.value.find((cycle) => cycle.number === selection.number)?.label ?? null)
      : ownerIncomeRangeLabel(selection.from, selection.to)
  })

  const isSelectedWindowLoading = computed(
    () => selectedWindowKey.value !== null && loadingWindows.value.includes(selectedWindowKey.value)
  )

  /**
   * Whether the loaded window touches the cycle still in progress. The
   * summary's own `window` is the source once it lands. Before that, a RUN
   * falls back to its entry in the overview's cycle list — the same server
   * resolver produced both, and without the fallback the default (in-progress)
   * cycle renders as "Closed" for the length of the first summary request. A
   * range has no local equivalent, so it stays false until the summary lands.
   */
  const isSelectedWindowInProgress = computed(() => {
    if (selectedWindowInfo.value !== null) return selectedWindowInfo.value.in_progress

    const selection = selectedWindow.value

    return selection?.kind === 'run'
      ? (cycles.value.find((cycle) => cycle.number === selection.number)?.in_progress ?? false)
      : false
  })

  const selectedMemberList = computed<OwnerIncomeMemberList | null>(() =>
    selectedWindowKey.value !== null ? (memberLists.value[selectedWindowKey.value] ?? null) : null
  )

  const openMemberSheetKey = computed<string | null>(() =>
    openMember.value === null
      ? null
      : ownerIncomeSheetKey(ownerIncomeWindowKey(openMember.value.window), openMember.value.member.user_id)
  )

  const openMemberSheet = computed<OwnerIncomeMemberSheet | null>(() =>
    openMemberSheetKey.value !== null ? (memberSheets.value[openMemberSheetKey.value] ?? null) : null
  )

  const isMemberSheetLoading = computed(() => memberSheetRequestId.value !== 0)

  /**
   * The kind of window the OPEN sheet belongs to — not the selected one. They
   * can differ (the sheet outlives a window switch), and the sheet's Gift-coins
   * source and copy must follow the data it is showing.
   */
  const openMemberWindowKind = computed<OwnerIncomeWindowKind>(
    () => openMember.value?.window.kind ?? selectedWindow.value?.kind ?? 'run'
  )

  function isWindowLoading(windowKey: string): boolean {
    return loadingWindows.value.includes(windowKey)
  }

  function summary(windowKey: string): OwnerIncomeWindowSummary | null {
    return summaries.value[windowKey] ?? null
  }

  function memberSheet(windowKey: string, userId: number): OwnerIncomeMemberSheet | null {
    return memberSheets.value[ownerIncomeSheetKey(windowKey, userId)] ?? null
  }

  function memberList(windowKey: string): OwnerIncomeMemberList | null {
    return memberLists.value[windowKey] ?? null
  }

  function patchMemberList(windowKey: string, patch: Partial<OwnerIncomeMemberList>): void {
    const list = memberLists.value[windowKey]
    if (!list) return
    memberLists.value = { ...memberLists.value, [windowKey]: { ...list, ...patch } }
  }

  function setOverview(value: OwnerIncomeOverview | null): void {
    overview.value = value
  }

  function setSelectedWindow(selection: OwnerIncomeWindowSelection | null): void {
    selectedWindow.value = selection
  }

  /** Cache a window's heroes under its key — never under anything read off the response. */
  function setSummary(windowKey: string, value: OwnerIncomeWindowSummary): void {
    summaries.value = { ...summaries.value, [windowKey]: value }
  }

  function setOverviewLoading(loading: boolean): void {
    isOverviewLoading.value = loading
  }

  function setWindowLoading(windowKey: string, loading: boolean): void {
    const others = loadingWindows.value.filter((key) => key !== windowKey)
    loadingWindows.value = loading ? [...others, windowKey] : others
  }

  function setOverviewError(message: string | null): void {
    overviewError.value = message
  }

  /**
   * (Re)start a window's list under a new applied query: no rows, nothing
   * loaded, nothing in flight. Changing sort/direction/search always lands
   * here, so the next load is page 1.
   */
  function setMemberListQuery(
    windowKey: string,
    query: { sort: OwnerIncomeMemberSort; direction: OwnerIncomeSortDirection; search: string }
  ): void {
    memberLists.value = {
      ...memberLists.value,
      [windowKey]: { ...query, rows: [], page: 0, hasMore: false, loadingPage: null, error: null, requestId: 0 },
    }
  }

  /** Mark `page` in flight under `requestId` (the only response allowed to land). */
  function setMemberListRequest(windowKey: string, requestId: number, page: number): void {
    patchMemberList(windowKey, { requestId, loadingPage: page, error: null })
  }

  /**
   * Store a loaded page. Page 1 replaces the rows; later pages append, skipping
   * any member already shown (live figures on an in-progress window can shift a
   * row across an offset boundary between requests).
   */
  function setMemberListPage(
    windowKey: string,
    page: number,
    rows: OwnerIncomeMemberRow[],
    hasMore: boolean
  ): void {
    const list = memberLists.value[windowKey]
    if (!list) return

    let nextRows = rows
    if (page > 1) {
      const shown = new Set(list.rows.map((row) => row.user_id))
      nextRows = [...list.rows, ...rows.filter((row) => !shown.has(row.user_id))]
    }

    patchMemberList(windowKey, { rows: nextRows, page, hasMore, loadingPage: null, error: null })
  }

  function setMemberListError(windowKey: string, message: string): void {
    patchMemberList(windowKey, { error: message, loadingPage: null })
  }

  function setOpenMember(target: OwnerIncomeOpenMember | null): void {
    openMember.value = target
  }

  /** Mark a sheet request in flight under `requestId` (the only response allowed to land). */
  function setMemberSheetRequest(requestId: number): void {
    memberSheetRequestId.value = requestId
    memberSheetError.value = null
  }

  /** Cache a loaded sheet for `windowKey` and end the request. */
  function setMemberSheet(windowKey: string, sheet: OwnerIncomeMemberSheet): void {
    memberSheets.value = {
      ...memberSheets.value,
      [ownerIncomeSheetKey(windowKey, sheet.member.user_id)]: sheet,
    }
    memberSheetRequestId.value = 0
    memberSheetError.value = null
  }

  function setMemberSheetError(message: string): void {
    memberSheetError.value = message
    memberSheetRequestId.value = 0
  }

  /** No request in flight, no error — any response still on the wire is now stale. */
  function clearMemberSheetRequest(): void {
    memberSheetRequestId.value = 0
    memberSheetError.value = null
  }

  function reset(): void {
    overview.value = null
    selectedWindow.value = null
    summaries.value = {}
    memberLists.value = {}
    memberSheets.value = {}
    openMember.value = null
    memberSheetRequestId.value = 0
    memberSheetError.value = null
    isOverviewLoading.value = false
    loadingWindows.value = []
    overviewError.value = null
  }

  return {
    overview,
    selectedWindow,
    summaries,
    memberLists,
    memberSheets,
    openMember,
    memberSheetRequestId,
    memberSheetError,
    isOverviewLoading,
    loadingWindows,
    overviewError,
    cycles,
    hasCycles,
    defaultCycle,
    rangesEnabled,
    rangeLimits,
    selectedWindowKey,
    selectedCycle,
    isRangeSelected,
    selectedSummary,
    selectedWindowInfo,
    selectedWindowLabel,
    isSelectedWindowLoading,
    isSelectedWindowInProgress,
    selectedMemberList,
    openMemberSheetKey,
    openMemberSheet,
    openMemberWindowKind,
    isMemberSheetLoading,
    isWindowLoading,
    summary,
    memberList,
    memberSheet,
    setOverview,
    setSelectedWindow,
    setSummary,
    setOverviewLoading,
    setWindowLoading,
    setOverviewError,
    setMemberListQuery,
    setMemberListRequest,
    setMemberListPage,
    setMemberListError,
    setOpenMember,
    setMemberSheetRequest,
    setMemberSheet,
    setMemberSheetError,
    clearMemberSheetRequest,
    reset,
  }
})
