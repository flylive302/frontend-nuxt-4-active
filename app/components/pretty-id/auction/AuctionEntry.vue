<script setup lang="ts">
/**
 * The viewer's own part in a LIVE auction, decided from `me`:
 * disqualified -> a note; entered -> the bid area; cannot bid (staff) -> a note;
 * otherwise the "Pay <fee> entry" button (which opens <PrettyIdAuctionEntryModal>).
 * Renders nothing until `me` has loaded.
 */
import { usePrettyIdAuctionEnterActions } from '~/composables/pretty-id/usePrettyIdAuctionEnterActions'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import type { PrettyIdAuctionSnapshot } from '~/types/pretty-id-auction'
import { formatCoins } from '~/utils/currency'
import { PRETTY_ID_DISQUALIFIED_MESSAGE } from '~/utils/pretty-id-auction-error'

// Config
const props = defineProps<{
  auction: PrettyIdAuctionSnapshot
}>()

// Composables
const store = usePrettyIdAuctionStore()
const { openEntry } = usePrettyIdAuctionEnterActions()

// State
const me = computed(() => store.myStanding[props.auction.id])
</script>

<template>
  <PrettyIdPanel v-if="me" title="Your entry">
    <p v-if="me.disqualified" class="pid-body text-center" role="status">
      {{ PRETTY_ID_DISQUALIFIED_MESSAGE }}
    </p>

    <PrettyIdAuctionBidArea v-else-if="me.entered && me.may_bid" :auction="auction" />

    <p v-else-if="!me.may_bid" class="pid-body text-center" role="status">
      Staff accounts can watch but not take part.
    </p>

    <div v-else class="text-center">
      <PrettyIdButton @click="openEntry(auction.id)">Pay {{ formatCoins(auction.entry_fee) }} entry</PrettyIdButton>
      <p class="pid-body pid-small pid-muted mt-1.5">Pay once to bid. Not refundable.</p>
    </div>

    <PrettyIdAuctionEntryModal />
  </PrettyIdPanel>
</template>
