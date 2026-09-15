// ========================================
// Owner Income Store
// ========================================
// State + computed + setters ONLY — useOwnerIncomeActions for API.
// Cycle-centric owner/admin "Member Income" page: overview (agency + cycles),
// the selected cycle, and a per-cycle summary cache (Members / Owner heroes).
// The cache lives for one page visit; the page load resets it.

import { defineStore } from 'pinia'
import type {
  OwnerIncomeCycle,
  OwnerIncomeCycleSummary,
  OwnerIncomeOverview,
} from '~/types/income/ownerIncome'

export const useOwnerIncomeStore = defineStore('ownerIncome', () => {
  const overview = ref<OwnerIncomeOverview | null>(null)
  const selectedCycle = ref<number | null>(null)
  const summaries = ref<Record<number, OwnerIncomeCycleSummary>>({})

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

  function isCycleLoading(cycleNumber: number): boolean {
    return loadingCycles.value.includes(cycleNumber)
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

  function reset(): void {
    overview.value = null
    selectedCycle.value = null
    summaries.value = {}
    isOverviewLoading.value = false
    loadingCycles.value = []
    overviewError.value = null
  }

  return {
    overview,
    selectedCycle,
    summaries,
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
    isCycleLoading,
    setOverview,
    setSelectedCycle,
    setSummary,
    setOverviewLoading,
    setCycleLoading,
    setOverviewError,
    reset,
  }
})
