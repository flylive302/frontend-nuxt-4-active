<script setup lang="ts">
/**
 * "This auction was not found": shown for a malformed auction URL and for an id
 * the server does not know (404), with the way back to the auction tab.
 */
import { PRETTY_ID_ROUTES } from '~/constants/pretty-id'

function backToAuction(): void {
  void navigateTo(PRETTY_ID_ROUTES.auction, { replace: true })
}
</script>

<template>
  <div class="pid-empty">
    <p class="pid-body mb-4">This auction was not found.</p>
    <PrettyIdButton size="sm" @click="backToAuction">Back to auctions</PrettyIdButton>
  </div>
</template>
