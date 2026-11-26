<script setup lang="ts">
/**
 * One auction on the Rare Auction tab: the Rare ID, then what matters for its
 * state. Live: countdown to the actual end and the top bid. Upcoming: countdown
 * to the start and the terms (entry fee, opening bid, keep-period). Ended: the
 * closing bid. A single tap target; it emits `open` and the parent decides where
 * that goes.
 */
import type { PrettyIdAuctionCard } from '~/types/pretty-id-auction'
import { formatCoins } from '~/utils/currency'
import { prettyIdRareFontPx } from '~/utils/pretty-id-auction'
import { formatPrettyIdDays, formatPrettyIdShort } from '~/utils/pretty-id-format'

// Config
const props = defineProps<{
  auction: PrettyIdAuctionCard
}>()

const emit = defineEmits<{
  open: [auctionId: number]
}>()

// Constants
const RARE_ID_FONT = { max: 38, min: 20 }

// State
const isLive = computed(() => props.auction.state === 'live')
const isUpcoming = computed(() => props.auction.state === 'upcoming')
const rareIdFontSize = computed(() => `${prettyIdRareFontPx(props.auction.rare_id, RARE_ID_FONT)}px`)

/** "3.4M" / "No bids yet". */
const topBidLine = computed(() => {
  const { top_bid: top } = props.auction
  return top === null ? 'No bids yet' : formatPrettyIdShort(top)
})

const bidderLine = computed(() => {
  const count = props.auction.bidder_count
  return count === 1 ? '1 bidder' : `${count} bidders`
})

/** No countdown in the label: a ticking value is noise for a screen reader. */
const label = computed(() => {
  const status = isLive.value ? 'live auction' : isUpcoming.value ? 'upcoming auction' : 'auction ended'
  return `Rare ID ${props.auction.rare_id}, ${status}`
})
</script>

<template>
  <button
    type="button"
    class="pid-acard cursor-pointer transition-transform duration-100 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pid-gold) active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
    :aria-label="label"
    @click="emit('open', auction.id)"
  >
    <span class="pid-acard__id">
      <span class="pid-num pid-gold" :style="{ fontSize: rareIdFontSize }">{{ auction.rare_id }}</span>
    </span>

    <span class="pid-acard__info pid-body pid-small">
      <template v-if="isLive">
        <span class="pid-muted">Ends in</span>
        <PrettyIdCountdown :to="auction.ends_at" />
        <span>Top bid · {{ topBidLine }}</span>
        <span class="pid-muted">{{ bidderLine }}</span>
      </template>

      <template v-else-if="isUpcoming">
        <span class="pid-muted">Starts in</span>
        <PrettyIdCountdown :to="auction.starts_at" />
        <span>Entry · {{ formatCoins(auction.entry_fee) }}</span>
        <span>Opens at · {{ formatPrettyIdShort(auction.opening_bid) }}</span>
        <span class="pid-muted">Yours for {{ formatPrettyIdDays(auction.keep_days) }}</span>
      </template>

      <template v-else>
        <span class="pid-num pid-gold">ENDED</span>
        <span>{{ auction.top_bid === null ? 'No winner' : `Won at · ${topBidLine}` }}</span>
      </template>
    </span>
  </button>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  .pid-acard {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-width: 0;
    margin: 6px 0;
    padding: 14px 18px;
    text-align: left;
    background: var(--pid-img-card2) center / 100% 100%;
  }

  .pid-acard__id {
    display: grid;
    flex: 0 0 42%;
    place-items: center;
    min-width: 0;
    overflow: hidden;
  }

  .pid-acard__info {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
}
</style>
