/**
 * "Finalizing…" for an auction: live on the server, but its actual end has passed
 * on the server-adjusted clock (bids are refused, the settlement job has not run).
 * Ticks off the shared <usePrettyIdClock>, so it flips the moment the countdown
 * hits zero. For component setup only (it uses the shared clock).
 */

import { computed, toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { usePrettyIdClock } from '~/composables/pretty-id/usePrettyIdClock'
import type { PrettyIdAuctionState } from '~/types/pretty-id-auction'
import { isPrettyIdAuctionFinalizing } from '~/utils/pretty-id-auction'

export function usePrettyIdAuctionFinalizing(
  auction: MaybeRefOrGetter<{ state: PrettyIdAuctionState; ends_at: string } | undefined>,
): ComputedRef<boolean> {
  const { now } = usePrettyIdClock()
  return computed(() => {
    const timing = toValue(auction)
    return timing !== undefined && isPrettyIdAuctionFinalizing(timing, now.value)
  })
}
