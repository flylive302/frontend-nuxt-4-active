// ========================================
// Pretty ID Auction Store — tab list, per-auction snapshots, server clock offset
// ========================================
// State + setters ONLY. API calls, toasts and polling live in
// composables/pretty-id. Not persisted. "Me" and the Choose flow are in prettyId.ts.
// ========================================

import { defineStore } from 'pinia'
import type { Ref } from 'vue'
import type {
  PrettyIdAuctionCard,
  PrettyIdAuctionMe,
  PrettyIdAuctionSnapshot,
  PrettyIdAuctionUnseenWin,
  PrettyIdAuctionWeeklyRecord,
  PrettyIdAuctionWinnerEntry,
  PrettyIdAuctionWinnersBoard,
} from '~/types/pretty-id-auction'

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

  /** The tab list, in the server's order. */
  const auctions = ref<PrettyIdAuctionCard[]>([])
  /** The first tab load is in flight. Poll ticks never flip it. */
  const isAuctionsLoading = ref(false)
  /** The tab list has loaded at least once. */
  const isAuctionsLoaded = ref(false)
  /** The last tab load failed and there is still nothing to show. */
  const isAuctionsFailed = ref(false)

  /** Latest snapshot per auction id. */
  const snapshots = ref<Record<number, PrettyIdAuctionSnapshot>>({})
  /** The viewer's own standing per auction id, from `/me` (fetched on page open only). */
  const myStanding = ref<Record<number, PrettyIdAuctionMe>>({})

  /** `serverNow - Date.now()` as of the last response. Add to `Date.now()` for server time. */
  const clockOffsetMs = ref(0)

  /** Auction ids whose win was already celebrated this session: the same win is never shown twice. */
  const shownWinIds = ref<Set<number>>(new Set())
  /** An unseen-wins request is in flight: overlapping checks do not double-fetch. */
  const isCheckingWins = ref(false)
  /** The Rare ID win being celebrated app-wide; `null` when none is on screen. */
  const winCelebration = ref<PrettyIdAuctionUnseenWin | null>(null)

  /** Big Winners of the month last loaded; `null` until the first load. Kept while the next month loads. */
  const winners = ref<PrettyIdAuctionWinnersBoard | null>(null)
  const isWinnersLoading = ref(false)
  /** The winner shown in the bottom sheet. */
  const selectedWinner = ref<PrettyIdAuctionWinnerEntry | null>(null)
  /** Weekly Record of the month last loaded; `null` until the first load. */
  const weekly = ref<PrettyIdAuctionWeeklyRecord | null>(null)
  const isWeeklyLoading = ref(false)

  // ========================================
  // Setters
  // ========================================

  function setAuctions(next: PrettyIdAuctionCard[]): void {
    auctions.value = next
    isAuctionsLoaded.value = true
    isAuctionsFailed.value = false
  }

  function setAuctionsFailed(value: boolean): void {
    isAuctionsFailed.value = value
  }

  function setAuctionsLoading(value: boolean): void {
    isAuctionsLoading.value = value
  }

  /** Replaces the snapshot of `snapshot.id`. Always swaps the record, never mutates it. */
  function setSnapshot(snapshot: PrettyIdAuctionSnapshot): void {
    snapshots.value = { ...snapshots.value, [snapshot.id]: snapshot }
  }

  function snapshotById(id: number): PrettyIdAuctionSnapshot | undefined {
    return snapshots.value[id]
  }

  function setMyStanding(id: number, me: PrettyIdAuctionMe): void {
    myStanding.value = { ...myStanding.value, [id]: me }
  }

  function myStandingById(id: number): PrettyIdAuctionMe | undefined {
    return myStanding.value[id]
  }

  function setClockOffsetMs(value: number): void {
    clockOffsetMs.value = value
  }

  function markWinShown(auctionId: number): void {
    shownWinIds.value = new Set([...shownWinIds.value, auctionId])
  }

  function hasShownWin(auctionId: number): boolean {
    return shownWinIds.value.has(auctionId)
  }

  function setCheckingWins(value: boolean): void {
    isCheckingWins.value = value
  }

  function setWinCelebration(value: PrettyIdAuctionUnseenWin | null): void {
    winCelebration.value = value
  }

  function setWinners(value: PrettyIdAuctionWinnersBoard | null): void {
    winners.value = value
  }

  function setWinnersLoading(value: boolean): void {
    isWinnersLoading.value = value
  }

  function setSelectedWinner(value: PrettyIdAuctionWinnerEntry | null): void {
    selectedWinner.value = value
  }

  function setWeekly(value: PrettyIdAuctionWeeklyRecord | null): void {
    weekly.value = value
  }

  function setWeeklyLoading(value: boolean): void {
    isWeeklyLoading.value = value
  }

  function reset(): void {
    auctions.value = []
    isAuctionsLoading.value = false
    isAuctionsLoaded.value = false
    isAuctionsFailed.value = false
    snapshots.value = {}
    myStanding.value = {}
    clockOffsetMs.value = 0
    shownWinIds.value = new Set()
    isCheckingWins.value = false
    winCelebration.value = null
    winners.value = null
    isWinnersLoading.value = false
    selectedWinner.value = null
    weekly.value = null
    isWeeklyLoading.value = false
  }

  return {
    auctions: exposeReadonly(auctions),
    isAuctionsLoading: readonly(isAuctionsLoading),
    isAuctionsLoaded: readonly(isAuctionsLoaded),
    isAuctionsFailed: readonly(isAuctionsFailed),
    snapshots: exposeReadonly(snapshots),
    myStanding: exposeReadonly(myStanding),
    clockOffsetMs: readonly(clockOffsetMs),
    isCheckingWins: readonly(isCheckingWins),
    winCelebration: exposeReadonly(winCelebration),
    winners: exposeReadonly(winners),
    isWinnersLoading: readonly(isWinnersLoading),
    selectedWinner: exposeReadonly(selectedWinner),
    weekly: exposeReadonly(weekly),
    isWeeklyLoading: readonly(isWeeklyLoading),
    setAuctions,
    setAuctionsLoading,
    setAuctionsFailed,
    setSnapshot,
    snapshotById,
    setMyStanding,
    myStandingById,
    setClockOffsetMs,
    markWinShown,
    hasShownWin,
    setCheckingWins,
    setWinCelebration,
    setWinners,
    setWinnersLoading,
    setSelectedWinner,
    setWeekly,
    setWeeklyLoading,
    reset,
  }
})
