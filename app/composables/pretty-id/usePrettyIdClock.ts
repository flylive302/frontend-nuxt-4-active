/**
 * Server-adjusted clock for Pretty ID countdowns.
 *
 * `now` is epoch ms on the SERVER's clock (`Date.now() + clockOffsetMs`), so a
 * countdown is right even when the device clock is off. One shared interval
 * serves every consumer: it starts with the first mounted consumer and stops
 * with the last. It also repaints immediately when the offset changes (a fresh
 * snapshot or tab response).
 *
 * For component setup only. Action code that needs the current time should use
 * `Date.now() + store.clockOffsetMs` directly: calling this outside a
 * component scope would leave the interval running.
 */

import { createSharedComposable, useIntervalFn } from '@vueuse/core'
import { readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { PRETTY_ID_AUCTION_CLOCK_TICK_MS } from '~/constants/pretty-id-auction'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'

export interface PrettyIdClock {
  /** Server-adjusted epoch ms. */
  now: Readonly<Ref<number>>
}

const useSharedClock = createSharedComposable((): PrettyIdClock => {
  const store = usePrettyIdAuctionStore()
  const now = ref(Date.now() + store.clockOffsetMs)

  function repaint(): void {
    now.value = Date.now() + store.clockOffsetMs
  }

  useIntervalFn(repaint, PRETTY_ID_AUCTION_CLOCK_TICK_MS)
  watch(() => store.clockOffsetMs, repaint)

  return { now: readonly(now) }
})

export function usePrettyIdClock(): PrettyIdClock {
  return useSharedClock()
}
