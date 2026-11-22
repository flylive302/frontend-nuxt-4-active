/**
 * Polling hooks for the Rare Auction pages.
 *
 * Both load immediately, then refetch on a fixed cadence for as long as the
 * calling component is mounted (`useIntervalFn` stops with the effect scope).
 * The first load is the normal one (loading flag, error toast); poll ticks are
 * `quiet`, so a dropped connection does not toast on every tick.
 * Call them from a component or page `setup`, never from an action.
 */

import { useIntervalFn } from '@vueuse/core'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { usePrettyIdAuctionData } from '~/composables/pretty-id/usePrettyIdAuctionData'
import { PRETTY_ID_LOT_POLL_MS, PRETTY_ID_LOTS_POLL_MS } from '~/constants/pretty-id'

export interface PrettyIdLotPolling {
  /**
   * The first load of the current `lotId` has finished, successfully or not.
   * With no lot in the store by then, the lot does not exist — as opposed to
   * "still loading".
   */
  isSettled: Readonly<Ref<boolean>>
}

/** Keeps one lot fresh (bids, anti-snipe extension, settlement). Reloads at once if `lotId` changes. */
export function usePrettyIdLotPolling(lotId: MaybeRefOrGetter<number>): PrettyIdLotPolling {
  const { loadLot } = usePrettyIdAuctionData()
  const isSettled = ref(false)

  async function loadFirst(id: number): Promise<void> {
    isSettled.value = false
    await loadLot(id)
    // `lotId` may have moved on while this was in flight; only the current id settles.
    if (toValue(lotId) === id) isSettled.value = true
  }

  void loadFirst(toValue(lotId))
  useIntervalFn(() => void loadLot(toValue(lotId), { quiet: true }), PRETTY_ID_LOT_POLL_MS)
  watch(() => toValue(lotId), (id) => { void loadFirst(id) })

  return { isSettled: readonly(isSettled) }
}

/** Keeps the auction grid fresh. */
export function usePrettyIdLotsPolling(): void {
  const { loadLots } = usePrettyIdAuctionData()

  void loadLots()
  useIntervalFn(() => void loadLots({ quiet: true }), PRETTY_ID_LOTS_POLL_MS)
}
