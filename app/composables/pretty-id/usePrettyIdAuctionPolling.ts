/**
 * Polling hooks for the Rare Auction pages (view only).
 *
 * Both load immediately and then follow `usePrettyIdPoll`'s self-rescheduling
 * chain; the cadence comes from SERVER time (`Date.now() + clockOffsetMs`).
 * The first load is the normal one (loading flag, error toast); poll ticks are
 * `quiet`, so a dropped connection does not toast on every tick.
 * Call them from a component or page `setup`, never from an action.
 */

import { ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { usePrettyIdAuctionData } from '~/composables/pretty-id/usePrettyIdAuctionData'
import { usePrettyIdPoll } from '~/composables/pretty-id/usePrettyIdPoll'
import { PRETTY_ID_AUCTION_POLL_SLOW_MS, PRETTY_ID_AUCTION_TAB_POLL_MS } from '~/constants/pretty-id-auction'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import type { PrettyIdAuctionLoadStatus } from '~/types/pretty-id-auction'
import { nextPrettyIdAuctionPollDelayMs } from '~/utils/pretty-id-auction'

export interface PrettyIdAuctionPagePolling {
  /**
   * `loading` until the first load of the current id ends; then `ready`, `not_found`
   * (the server said 404: terminal) or `error` (could not load and nothing to show).
   */
  status: Readonly<Ref<PrettyIdAuctionLoadStatus>>
  /** Try again after an `error`. */
  retry: () => void
}

/**
 * Keeps one auction fresh: 60 s, then 3 s in the final hour to the actual end
 * (through extensions), stopping once it has ended or been cancelled.
 * `me` is fetched once per id on open, never by the timer.
 */
export function usePrettyIdAuctionPagePolling(auctionId: MaybeRefOrGetter<number>): PrettyIdAuctionPagePolling {
  const { loadAuction, loadAuctionMe } = usePrettyIdAuctionData()
  const store = usePrettyIdAuctionStore()
  const status = ref<PrettyIdAuctionLoadStatus>('loading')

  async function load(isFirst: boolean): Promise<void> {
    const id = toValue(auctionId)
    const outcome = await loadAuction(id, { quiet: !isFirst })
    // The id may have moved on while this was in flight; only the current id reports.
    if (toValue(auctionId) !== id) return
    if (outcome === 'ok') status.value = 'ready'
    else if (outcome === 'not_found') status.value = 'not_found'
    else if (store.snapshotById(id) === undefined) status.value = 'error'
  }

  function nextDelayMs(): number | null {
    if (status.value === 'not_found') return null
    const snapshot = store.snapshotById(toValue(auctionId))
    // Nothing to read a cadence from (the first load failed): retry slowly.
    if (snapshot === undefined) return PRETTY_ID_AUCTION_POLL_SLOW_MS
    return nextPrettyIdAuctionPollDelayMs(snapshot, Date.now() + store.clockOffsetMs)
  }

  const poll = usePrettyIdPoll({ load, nextDelayMs })

  function open(id: number): void {
    status.value = store.snapshotById(id) === undefined ? 'loading' : 'ready'
    void loadAuctionMe(id)
    poll.restart()
  }

  open(toValue(auctionId))
  watch(() => toValue(auctionId), id => open(id))

  return {
    status,
    retry: () => {
      status.value = 'loading'
      poll.restart()
    },
  }
}

/**
 * Keeps the tab's list fresh every 60 s. `enabled` is the auction switch: while
 * it is false nothing is fetched and nothing is scheduled. A 404 from the list
 * (switch off server-side) is silent and ends the polling.
 */
export function usePrettyIdAuctionsPolling(enabled: MaybeRefOrGetter<boolean>): { retry: () => void } {
  const { loadAuctions } = usePrettyIdAuctionData()
  /** A 404 means the auction is off server-side: stop until the switch / a retry restarts the chain. */
  let isGone = false

  const poll = usePrettyIdPoll({
    load: async (isFirst) => {
      isGone = (await loadAuctions({ quiet: !isFirst })) === 'not_found'
    },
    nextDelayMs: () => (isGone ? null : PRETTY_ID_AUCTION_TAB_POLL_MS),
    enabled,
  })

  if (toValue(enabled)) poll.restart()

  return { retry: () => poll.restart() }
}
