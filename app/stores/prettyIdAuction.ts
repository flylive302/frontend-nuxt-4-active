// ========================================
// Pretty ID Auction Store — lots, winners, weekly record
// ========================================
// State + setters ONLY. API calls, toasts and polling live in
// composables/pretty-id. Not persisted. "Me" and the Choose flow are in prettyId.ts.
// ========================================

import { defineStore } from 'pinia'
import type { Ref } from 'vue'
import type {
  PrettyIdLot,
  PrettyIdWeeklyResponse,
  PrettyIdWinner,
  PrettyIdWinnersResponse,
} from '~/types/pretty-id'

/**
 * Read-only view of a state ref. `readonly()` at runtime (writes are rejected);
 * typed shallow so the contract interfaces (mutable arrays) stay assignable to
 * component props instead of turning into `DeepReadonly<...>`.
 */
function exposeReadonly<T>(source: Ref<T>): Readonly<Ref<T>> {
  return readonly(source) as unknown as Readonly<Ref<T>>
}

export const usePrettyIdAuctionStore = defineStore('prettyIdAuction', () => {
  // ========================================
  // State
  // ========================================

  const lots = ref<PrettyIdLot[]>([])
  const isLotsLoading = ref(false)
  const winners = ref<PrettyIdWinnersResponse | null>(null)
  const isWinnersLoading = ref(false)
  const weekly = ref<PrettyIdWeeklyResponse | null>(null)
  const isWeeklyLoading = ref(false)
  /** The winner shown in the bottom sheet. */
  const selectedWinner = ref<PrettyIdWinner | null>(null)

  // ========================================
  // Setters
  // ========================================

  function setLots(next: PrettyIdLot[]): void {
    lots.value = next
  }

  /** Replaces the lot with the same `id`, or appends it. Always swaps the array, never mutates it. */
  function upsertLot(lot: PrettyIdLot): void {
    const known = lots.value.some(existing => existing.id === lot.id)
    lots.value = known
      ? lots.value.map(existing => (existing.id === lot.id ? lot : existing))
      : [...lots.value, lot]
  }

  function lotById(id: number): PrettyIdLot | undefined {
    return lots.value.find(lot => lot.id === id)
  }

  function setLotsLoading(value: boolean): void {
    isLotsLoading.value = value
  }

  function setWinners(value: PrettyIdWinnersResponse | null): void {
    winners.value = value
  }

  function setWinnersLoading(value: boolean): void {
    isWinnersLoading.value = value
  }

  function setWeekly(value: PrettyIdWeeklyResponse | null): void {
    weekly.value = value
  }

  function setWeeklyLoading(value: boolean): void {
    isWeeklyLoading.value = value
  }

  function setSelectedWinner(value: PrettyIdWinner | null): void {
    selectedWinner.value = value
  }

  function reset(): void {
    lots.value = []
    isLotsLoading.value = false
    winners.value = null
    isWinnersLoading.value = false
    weekly.value = null
    isWeeklyLoading.value = false
    selectedWinner.value = null
  }

  return {
    lots: exposeReadonly(lots),
    isLotsLoading: readonly(isLotsLoading),
    winners: exposeReadonly(winners),
    isWinnersLoading: readonly(isWinnersLoading),
    weekly: exposeReadonly(weekly),
    isWeeklyLoading: readonly(isWeeklyLoading),
    selectedWinner: exposeReadonly(selectedWinner),
    setLots,
    upsertLot,
    lotById,
    setLotsLoading,
    setWinners,
    setWinnersLoading,
    setWeekly,
    setWeeklyLoading,
    setSelectedWinner,
    reset,
  }
})
