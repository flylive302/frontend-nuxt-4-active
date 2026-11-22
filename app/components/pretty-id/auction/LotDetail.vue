<script setup lang="ts">
/**
 * One auction lot, live: summary, the user's action (entry fee → bid form →
 * result once ended) and the bidders. Mounted by <PrettyIdLotView> for a valid
 * id; polls the lot while it is on screen.
 *
 * Owns the ONE auction-actions instance of the page and passes its handlers and
 * `isSubmitting` down. Fees and the minimum bid come from the lot itself, so the
 * page works on a cold deep link before `me` has loaded; only the ownership
 * length needs `me.rules`.
 */
import { usePrettyIdStore } from '~/stores/prettyId'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { formatCoins } from '~/utils/currency'

// Config
const props = defineProps<{
  lotId: number
}>()

// Composables
const store = usePrettyIdStore()
const auctionStore = usePrettyIdAuctionStore()
const { enterAuction, placeBid, isSubmitting } = usePrettyIdAuctionActions()
const { isSettled } = usePrettyIdLotPolling(() => props.lotId)

// State
const lot = computed(() => auctionStore.lotById(props.lotId))
const isEnded = computed(() => lot.value?.status === 'ended')
const topBid = computed(() => lot.value?.top_bids[0])
const ownershipLine = computed(() => {
  const days = store.me?.rules.ownership_days
  return days === undefined ? 'See My ID.' : `Yours for ${days} days. See My ID.`
})

// Handlers
function onEnter(): void {
  void enterAuction(props.lotId)
}

function onBid(amount: number): void {
  void placeBid(props.lotId, amount)
}
</script>

<template>
  <div v-if="lot">
    <PrettyIdPanel :title="`Rare ID · ${lot.number}`">
      <PrettyIdLotSummary :lot="lot" />
    </PrettyIdPanel>

    <PrettyIdPanel :title="isEnded ? 'Result' : 'Your bid'">
      <div v-if="isEnded" class="pid-body text-center">
        <template v-if="topBid">
          Won by <b>{{ topBid.user.name }}</b> for <b class="pid-num pid-gold">{{ formatCoins(topBid.amount) }}</b>
          <span v-if="topBid.is_me" class="block">{{ ownershipLine }}</span>
        </template>
        <template v-else>Ended with no bids</template>
      </div>

      <div v-else-if="!lot.entered" class="text-center">
        <p class="pid-body pid-small mb-2">Pay the non-refundable entry fee to join this auction</p>
        <PrettyIdButton :disabled="isSubmitting" @click="onEnter">Pay {{ formatCoins(lot.entry_fee) }} entry</PrettyIdButton>
      </div>

      <PrettyIdLotBidForm
        v-else
        :min-bid="lot.min_next_bid"
        :step="lot.min_increment"
        :submitting="isSubmitting"
        :you-are-highest="lot.you_are_highest"
        @bid="onBid"
      />
    </PrettyIdPanel>

    <PrettyIdPanel title="Bidders">
      <PrettyIdLotBidders :bids="lot.top_bids" />
    </PrettyIdPanel>
  </div>

  <!-- First load finished with nothing in the store: the lot does not exist. -->
  <PrettyIdLotNotFound v-else-if="isSettled" />

  <p v-else class="pid-empty" role="status">Loading…</p>
</template>
