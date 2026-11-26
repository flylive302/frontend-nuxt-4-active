<script setup lang="ts">
/**
 * Rare Auction tab. While the auction switch is off (`prettyIdAuctionEnabled`)
 * it is the static "Coming soon" panel and makes NO API call; once the switch
 * is on it shows the auction board and refetches it every 60 s. Mounted by
 * `pages/pretty-id/auction/index.vue` inside the tab layout (which owns the gutter).
 */
const bootstrapStore = useBootstrapStore()

// The poller itself is gated on the switch, so nothing is fetched while it is off.
const { retry } = usePrettyIdAuctionsPolling(() => bootstrapStore.prettyIdAuctionEnabled)
</script>

<template>
  <PrettyIdAuctionBoard v-if="bootstrapStore.prettyIdAuctionEnabled" @retry="retry" />

  <PrettyIdPanel v-else title="Rare Auction">
    <div class="pid-auction-soon text-center">
      <h3 class="pid-disp pid-gold text-[22px]">Coming soon</h3>
      <p class="pid-body pid-small mt-1.5">Rare IDs go up for auction here soon.</p>
    </div>
  </PrettyIdPanel>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  .pid-auction-soon {
    padding: 8px 0 12px;
  }
}
</style>
