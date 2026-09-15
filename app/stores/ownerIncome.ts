// ========================================
// Owner Income Store
// ========================================
// State + computed + setters ONLY — useOwnerIncomeActions for API.
// Cycle-centric owner/admin "Member Income" page: overview (agency + cycles),
// the selected cycle, a per-cycle summary cache (Members / Owner heroes) and a
// per-cycle members list (rows, paging, applied sort/search).
// Everything lives for one page visit; the page load resets it.

import { defineStore } from 'pinia'
import type {
  OwnerIncomeCycle,
  OwnerIncomeCycleSummary,
  OwnerIncomeMemberList,
  OwnerIncomeMemberRow,
  OwnerIncomeMemberSort,
  OwnerIncomeOverview,
  OwnerIncomeSortDirection,
} from '~/types/income/ownerIncome'

export const useOwnerIncomeStore = defineStore('ownerIncome', () => {
  const overview = ref<OwnerIncomeOverview | null>(null)
  const selectedCycle = ref<number | null>(null)
  const summaries = ref<Record<number, OwnerIncomeCycleSummary>>({})
  const memberLists = ref<Record<number, OwnerIncomeMemberList>>({})

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

  function isCycleLoading(cycleNumber: number): boolean {
    return loadingCycles.value.includes(cycleNumber)
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

  function reset(): void {
    overview.value = null
    selectedCycle.value = null
    summaries.value = {}
    memberLists.value = {}
    isOverviewLoading.value = false
    loadingCycles.value = []
    overviewError.value = null
  }

  return {
    overview,
    selectedCycle,
    summaries,
    memberLists,
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
    isCycleLoading,
    memberList,
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
    reset,
  }
})
