// ========================================
// Owner Income Store
// ========================================
// State + computed + setters ONLY — useOwnerIncomeActions for API.
// Cycle-centric owner/admin "Member Income" page: overview (agency + cycles),
// the selected cycle, a per-cycle summary cache (Members / Owner heroes) and a
// per-cycle members list (rows, paging, applied sort/search), and the member
// bottom sheet (which member is open + a sheet cache keyed by cycle and user).
// Everything lives for one page visit; the page load resets it.

import { defineStore } from 'pinia'
import type {
  OwnerIncomeCycle,
  OwnerIncomeCycleSummary,
  OwnerIncomeMemberList,
  OwnerIncomeMemberRow,
  OwnerIncomeMemberSheet,
  OwnerIncomeMemberSort,
  OwnerIncomeOpenMember,
  OwnerIncomeOverview,
  OwnerIncomeSortDirection,
} from '~/types/income/ownerIncome'

function memberSheetKey(cycleNumber: number, userId: number): string {
  return `${cycleNumber}:${userId}`
}

export const useOwnerIncomeStore = defineStore('ownerIncome', () => {
  const overview = ref<OwnerIncomeOverview | null>(null)
  const selectedCycle = ref<number | null>(null)
  const summaries = ref<Record<number, OwnerIncomeCycleSummary>>({})
  const memberLists = ref<Record<number, OwnerIncomeMemberList>>({})

  /** Loaded sheets, keyed `${cycle}:${userId}`. */
  const memberSheets = ref<Record<string, OwnerIncomeMemberSheet>>({})
  const openMember = ref<OwnerIncomeOpenMember | null>(null)
  /** The sheet request allowed to land; 0 = none in flight. */
  const memberSheetRequestId = ref(0)
  const memberSheetError = ref<string | null>(null)

  const isOverviewLoading = ref(false)
  const loadingCycles = ref<number[]>([])
  const overviewError = ref<string | null>(null)

  const cycles = computed<OwnerIncomeCycle[]>(() => overview.value?.cycles ?? [])
  const hasCycles = computed(() => cycles.value.length > 0)
  const defaultCycle = computed<number | null>(() => overview.value?.default_cycle ?? null)

  const selectedCycleInfo = computed<OwnerIncomeCycle | null>(
    () => cycles.value.find((cycle) => cycle.number === selectedCycle.value) ?? null
  )

  const selectedSummary = computed<OwnerIncomeCycleSummary | null>(() =>
    selectedCycle.value !== null ? (summaries.value[selectedCycle.value] ?? null) : null
  )

  const isSelectedCycleLoading = computed(
    () => selectedCycle.value !== null && loadingCycles.value.includes(selectedCycle.value)
  )

  const isSelectedCycleInProgress = computed(() => selectedCycleInfo.value?.in_progress ?? false)

  const selectedMemberList = computed<OwnerIncomeMemberList | null>(() =>
    selectedCycle.value !== null ? (memberLists.value[selectedCycle.value] ?? null) : null
  )

  const openMemberSheet = computed<OwnerIncomeMemberSheet | null>(() =>
    openMember.value !== null
      ? (memberSheets.value[memberSheetKey(openMember.value.cycle, openMember.value.member.user_id)] ?? null)
      : null
  )

  const isMemberSheetLoading = computed(() => memberSheetRequestId.value !== 0)

  function isCycleLoading(cycleNumber: number): boolean {
    return loadingCycles.value.includes(cycleNumber)
  }

  function memberSheet(cycleNumber: number, userId: number): OwnerIncomeMemberSheet | null {
    return memberSheets.value[memberSheetKey(cycleNumber, userId)] ?? null
  }

  function memberList(cycleNumber: number): OwnerIncomeMemberList | null {
    return memberLists.value[cycleNumber] ?? null
  }

  function patchMemberList(cycleNumber: number, patch: Partial<OwnerIncomeMemberList>): void {
    const list = memberLists.value[cycleNumber]
    if (!list) return
    memberLists.value = { ...memberLists.value, [cycleNumber]: { ...list, ...patch } }
  }

  function setOverview(value: OwnerIncomeOverview | null): void {
    overview.value = value
  }

  function setSelectedCycle(cycleNumber: number | null): void {
    selectedCycle.value = cycleNumber
  }

  function setSummary(summary: OwnerIncomeCycleSummary): void {
    summaries.value = { ...summaries.value, [summary.cycle.number]: summary }
  }

  function setOverviewLoading(loading: boolean): void {
    isOverviewLoading.value = loading
  }

  function setCycleLoading(cycleNumber: number, loading: boolean): void {
    const others = loadingCycles.value.filter((number) => number !== cycleNumber)
    loadingCycles.value = loading ? [...others, cycleNumber] : others
  }

  function setOverviewError(message: string | null): void {
    overviewError.value = message
  }

  /**
   * (Re)start a cycle's list under a new applied query: no rows, nothing
   * loaded, nothing in flight. Changing sort/direction/search always lands
   * here, so the next load is page 1.
   */
  function setMemberListQuery(
    cycleNumber: number,
    query: { sort: OwnerIncomeMemberSort; direction: OwnerIncomeSortDirection; search: string }
  ): void {
    memberLists.value = {
      ...memberLists.value,
      [cycleNumber]: { ...query, rows: [], page: 0, hasMore: false, loadingPage: null, error: null, requestId: 0 },
    }
  }

  /** Mark `page` in flight under `requestId` (the only response allowed to land). */
  function setMemberListRequest(cycleNumber: number, requestId: number, page: number): void {
    patchMemberList(cycleNumber, { requestId, loadingPage: page, error: null })
  }

  /**
   * Store a loaded page. Page 1 replaces the rows; later pages append, skipping
   * any member already shown (live figures on the in-progress cycle can shift a
   * row across an offset boundary between requests).
   */
  function setMemberListPage(
    cycleNumber: number,
    page: number,
    rows: OwnerIncomeMemberRow[],
    hasMore: boolean
  ): void {
    const list = memberLists.value[cycleNumber]
    if (!list) return

    let nextRows = rows
    if (page > 1) {
      const shown = new Set(list.rows.map((row) => row.user_id))
      nextRows = [...list.rows, ...rows.filter((row) => !shown.has(row.user_id))]
    }

    patchMemberList(cycleNumber, { rows: nextRows, page, hasMore, loadingPage: null, error: null })
  }

  function setMemberListError(cycleNumber: number, message: string): void {
    patchMemberList(cycleNumber, { error: message, loadingPage: null })
  }

  function setOpenMember(target: OwnerIncomeOpenMember | null): void {
    openMember.value = target
  }

  /** Mark a sheet request in flight under `requestId` (the only response allowed to land). */
  function setMemberSheetRequest(requestId: number): void {
    memberSheetRequestId.value = requestId
    memberSheetError.value = null
  }

  /** Cache a loaded sheet for `cycleNumber` and end the request. */
  function setMemberSheet(cycleNumber: number, sheet: OwnerIncomeMemberSheet): void {
    memberSheets.value = { ...memberSheets.value, [memberSheetKey(cycleNumber, sheet.member.user_id)]: sheet }
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
    selectedCycle.value = null
    summaries.value = {}
    memberLists.value = {}
    memberSheets.value = {}
    openMember.value = null
    memberSheetRequestId.value = 0
    memberSheetError.value = null
    isOverviewLoading.value = false
    loadingCycles.value = []
    overviewError.value = null
  }

  return {
    overview,
    selectedCycle,
    summaries,
    memberLists,
    memberSheets,
    openMember,
    memberSheetRequestId,
    memberSheetError,
    isOverviewLoading,
    loadingCycles,
    overviewError,
    cycles,
    hasCycles,
    defaultCycle,
    selectedCycleInfo,
    selectedSummary,
    isSelectedCycleLoading,
    isSelectedCycleInProgress,
    selectedMemberList,
    openMemberSheet,
    isMemberSheetLoading,
    isCycleLoading,
    memberList,
    memberSheet,
    setOverview,
    setSelectedCycle,
    setSummary,
    setOverviewLoading,
    setCycleLoading,
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
