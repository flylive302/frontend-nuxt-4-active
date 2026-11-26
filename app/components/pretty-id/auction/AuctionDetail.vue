<script setup lang="ts">
/**
 * One auction, view only: summary (Rare ID, countdown, terms), the leader and
 * the bidders, or the result once ended. Mounted by <PrettyIdAuctionView> for a
 * valid id; polls the auction while it is on screen. Entering and
 * bidding are in <PrettyIdAuctionEntry> (-> <PrettyIdAuctionBidArea>).
 *
 * `status` tells "no such auction" (404) from "could not load": only the first
 * shows the not-found view, the second offers a retry.
 */
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { formatCoins } from '~/utils/currency'

// Config
const props = defineProps<{
  auctionId: number
}>()

// Composables
const store = usePrettyIdAuctionStore()
const { status, retry } = usePrettyIdAuctionPagePolling(() => props.auctionId)

// State
const auction = computed(() => store.snapshots[props.auctionId])
const myStanding = computed(() => store.myStanding[props.auctionId])
const result = computed(() => auction.value?.result ?? null)
</script>

<template>
  <!-- A 404 wins over any snapshot kept from an earlier visit. -->
  <PrettyIdAuctionNotFound v-if="status === 'not_found'" />

  <div v-else-if="auction">
    <PrettyIdPanel title="Rare ID">
      <PrettyIdAuctionSummary :auction="auction" />
      <p v-if="myStanding?.disqualified && auction.state !== 'live'" class="pid-body pid-small mt-2 text-center">
        You were removed from this auction.
      </p>
    </PrettyIdPanel>

    <PrettyIdAuctionEntry v-if="auction.state === 'live'" :auction="auction" />

    <PrettyIdPanel v-if="auction.state === 'live' && auction.leader" title="Leading">
      <PrettyIdAuctionLeader :leader="auction.leader" />
    </PrettyIdPanel>

    <PrettyIdPanel v-if="auction.state === 'ended'" title="Result">
      <div class="pid-body text-center">
        <template v-if="result?.winner">
          Won by <b>{{ result.winner.name }}</b>
          <template v-if="result.winning_bid !== null">
            for <b class="pid-num pid-gold">{{ formatCoins(result.winning_bid) }}</b>
          </template>
        </template>
        <template v-else>Ended with no winner</template>
      </div>
    </PrettyIdPanel>

    <PrettyIdPanel v-if="auction.state !== 'cancelled'" title="Bidders">
      <PrettyIdAuctionBidders :bids="auction.top_bids" />
    </PrettyIdPanel>
  </div>

  <div v-else-if="status === 'error'" class="pid-empty" role="alert">
    <p class="pid-body mb-3">We couldn't load this auction. Check your connection and try again.</p>
    <PrettyIdButton size="sm" @click="retry">Try again</PrettyIdButton>
  </div>

  <p v-else class="pid-empty" role="status">Loading…</p>
</template>
