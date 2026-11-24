<script setup lang="ts">
/**
 * Rare Auction tab: a static "Coming soon" panel. The auction is not live yet,
 * so there is no data, store or polling behind it. Mounted by
 * `pages/pretty-id/auction/index.vue` inside the tab layout (which owns the gutter).
 */
</script>

<template>
  <PrettyIdPanel title="Rare Auction">
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
