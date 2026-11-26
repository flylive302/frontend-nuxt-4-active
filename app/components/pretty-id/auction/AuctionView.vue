<script setup lang="ts">
/**
 * Auction page (`/pretty-id/auction/:id`): owns the gutter and decides between
 * the auction itself and the "not found" state for a malformed URL.
 *
 * The check lives here, above `<PrettyIdAuctionDetail>`, so a bad id never
 * starts the polling (which would fetch a request that cannot succeed).
 */

// Config
defineProps<{
  /** `null` when the URL segment is not a valid auction id. */
  auctionId: number | null
}>()
</script>

<template>
  <div class="pid-sec pt-[22px]">
    <PrettyIdAuctionNotFound v-if="auctionId === null" />
    <PrettyIdAuctionDetail v-else :key="auctionId" :auction-id="auctionId" />
  </div>
</template>
