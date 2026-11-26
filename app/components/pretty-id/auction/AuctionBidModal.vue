<script setup lang="ts">
/**
 * "Confirm bid" dialog: the amount in full and short form, that the coins are
 * held until the viewer is outbid, that a placed bid cannot be taken back, and a
 * red warning above ten times the minimum. After an `insufficient_coins`
 * refusal it offers "Top up" instead of "Place bid". Open while the bid store
 * holds a `confirmId`. Mounted by <PrettyIdAuctionBidArea>.
 */
import { usePrettyIdAuctionBidActions } from '~/composables/pretty-id/usePrettyIdAuctionBidActions'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { usePrettyIdAuctionBidStore } from '~/stores/prettyIdAuctionBid'
import { PRETTY_ID_AUCTION_BID_WARN_MULTIPLE } from '~/constants/pretty-id-auction'
import { formatCoins } from '~/utils/currency'
import { formatPrettyIdShort } from '~/utils/pretty-id-format'

// Composables
const auctionStore = usePrettyIdAuctionStore()
const bidStore = usePrettyIdAuctionBidStore()
const { closeBid, confirmBid, openTopUp, isLargeBid } = usePrettyIdAuctionBidActions()

// State
/**
 * The last open auction. `confirmId` resets the moment the bid succeeds, while the
 * dialog is still fading out: rendering from the live store would blank it mid-close.
 */
const view = computed<number | null>(previous => bidStore.confirmId ?? previous ?? null)
const auction = computed(() => (view.value === null ? undefined : auctionStore.snapshotById(view.value)))
/** Below 1,000 the short form is the number itself: no "· 500" echo. */
const shortAmount = computed(() => (bidStore.confirmAmount >= 1_000 ? formatPrettyIdShort(bidStore.confirmAmount) : null))
const isLarge = computed(() => view.value !== null && isLargeBid(view.value, bidStore.confirmAmount))
</script>

<template>
  <PrettyIdModal :open="bidStore.confirmId !== null" title="Confirm bid" @close="closeBid">
    <div v-if="auction" class="text-center">
      <span class="pid-num pid-gold whitespace-nowrap text-[50px]">{{ auction.rare_id }}</span>

      <PrettyIdRow>
        <span class="pid-row__grow pid-body pid-small text-left">Your bid</span>
        <span class="pid-num pid-gold">
          {{ formatCoins(bidStore.confirmAmount) }}<template v-if="shortAmount"> · {{ shortAmount }}</template>
        </span>
      </PrettyIdRow>

      <p class="pid-body pid-small mt-2">Held until you're outbid, then refunded in full.</p>
      <p class="pid-body pid-small mt-1">A placed bid cannot be taken back.</p>

      <p v-if="isLarge" class="pid-body mt-2 text-(--pid-bad)" role="alert">
        This is more than {{ PRETTY_ID_AUCTION_BID_WARN_MULTIPLE }} times the minimum bid ({{ formatCoins(auction.min_next_bid) }}). Check the amount.
      </p>

      <p v-if="bidStore.isShortOnCoins" class="pid-body mt-2" role="alert">
        You don't have enough coins for this bid.
      </p>

      <div class="mt-2.5 flex items-center justify-center gap-2.5">
        <PrettyIdButton size="sm" class="h-11" :disabled="bidStore.isBidding" @click="closeBid">Cancel</PrettyIdButton>
        <PrettyIdButton v-if="bidStore.isShortOnCoins" size="sm" class="h-11" @click="openTopUp">Top up</PrettyIdButton>
        <PrettyIdButton v-else size="sm" class="h-11" :disabled="bidStore.isBidding" @click="confirmBid">
          {{ bidStore.isBidding ? 'Placing…' : 'Place bid' }}
        </PrettyIdButton>
      </div>
    </div>
  </PrettyIdModal>
</template>
