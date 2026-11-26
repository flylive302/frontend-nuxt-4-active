// ========================================
// Pretty ID Auction Store — tab list, per-auction snapshots, server clock offset
// ========================================
// State + setters ONLY. API calls, toasts and polling live in
// composables/pretty-id. Not persisted. "Me" and the Choose flow are in prettyId.ts.
// ========================================

import { defineStore } from 'pinia'
import type { Ref } from 'vue'
import type { PrettyIdAuctionCard, PrettyIdAuctionMe, PrettyIdAuctionSnapshot } from '~/types/pretty-id-auction'

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

  function reset(): void {
    auctions.value = []
    isAuctionsLoading.value = false
    isAuctionsLoaded.value = false
    isAuctionsFailed.value = false
    snapshots.value = {}
    myStanding.value = {}
    clockOffsetMs.value = 0
  }

  return {
    auctions: exposeReadonly(auctions),
    isAuctionsLoading: readonly(isAuctionsLoading),
    isAuctionsLoaded: readonly(isAuctionsLoaded),
    isAuctionsFailed: readonly(isAuctionsFailed),
    snapshots: exposeReadonly(snapshots),
    myStanding: exposeReadonly(myStanding),
    clockOffsetMs: readonly(clockOffsetMs),
    setAuctions,
    setAuctionsLoading,
    setAuctionsFailed,
    setSnapshot,
    snapshotById,
    setMyStanding,
    myStandingById,
    setClockOffsetMs,
    reset,
  }
})
