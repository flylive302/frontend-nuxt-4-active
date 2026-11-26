<script setup lang="ts">
/**
 * Top panel of an auction page: the Rare ID, then the facts for its state.
 * Upcoming: countdown to the start plus the terms (entry fee, opening bid,
 * minimum raise, keep-period). Live: countdown to the actual end, the top bid,
 * the lowest bid that would take the lead, and the same terms. Ended /
 * cancelled: the state itself.
 */
import type { PrettyIdAuctionSnapshot } from '~/types/pretty-id-auction'
import { formatCoins } from '~/utils/currency'
import { prettyIdRareFontPx } from '~/utils/pretty-id-auction'
import { formatPrettyIdDays } from '~/utils/pretty-id-format'

// Config
const props = defineProps<{
  auction: PrettyIdAuctionSnapshot
}>()

// Constants
const RARE_ID_FONT = { max: 72, min: 36 }

// State
const rareIdFontSize = computed(() => `${prettyIdRareFontPx(props.auction.rare_id, RARE_ID_FONT)}px`)
/** The standing price floor — the same figure the tab card shows. */
const topBid = computed(() => props.auction.price_floor)

/** `[label, value]` pairs under the countdown. */
const facts = computed<Array<[string, string]>>(() => {
  const { state, entry_fee: entryFee, opening_bid: openingBid, min_raise: minRaise, keep_days: keepDays } = props.auction
  const terms: Array<[string, string]> = [
    ['Entry fee', formatCoins(entryFee)],
    ['Opening bid', formatCoins(openingBid)],
    ['Minimum raise', formatCoins(minRaise)],
    ['Yours for', formatPrettyIdDays(keepDays)],
  ]
  if (state === 'upcoming') return terms
  if (state === 'live') {
    return [
      ['Top bid', topBid.value === null ? '—' : formatCoins(topBid.value)],
      ['Next bid from', formatCoins(props.auction.min_next_bid)],
      ['Bidders', String(props.auction.bidder_count)],
      ...terms,
    ]
  }
  return []
})
</script>

<template>
  <div class="text-center">
    <span class="pid-num pid-gold block leading-tight" :style="{ fontSize: rareIdFontSize }">{{ auction.rare_id }}</span>

    <div class="mt-2">
      <template v-if="auction.state === 'upcoming'">
        <div class="pid-body pid-small pid-muted">Starts in</div>
        <div class="text-[22px]"><PrettyIdCountdown :to="auction.starts_at" /></div>
      </template>
      <template v-else-if="auction.state === 'live'">
        <div class="pid-body pid-small pid-muted">Ends in</div>
        <div class="text-[22px]"><PrettyIdCountdown :to="auction.ends_at" /></div>
      </template>
      <span v-else class="pid-num pid-gold text-[20px]">{{ auction.state === 'ended' ? 'ENDED' : 'CANCELLED' }}</span>
    </div>

    <dl v-if="facts.length > 0" class="mt-3 grid grid-cols-1 gap-1.5">
      <div v-for="[term, value] in facts" :key="term" class="flex items-baseline justify-between gap-3 px-2">
        <dt class="pid-body pid-small pid-muted">{{ term }}</dt>
        <dd class="pid-num pid-gold text-[16px]">{{ value }}</dd>
      </div>
    </dl>
  </div>
</template>
