<script setup lang="ts">
/**
 * PLACEHOLDER for the bid area (pretty-id-step2 ticket 07 fills this in):
 * what an entered viewer sees on a live auction.
 */
import type { PrettyIdAuctionSnapshot } from '~/types/pretty-id-auction'

// Config
defineProps<{
  auction: PrettyIdAuctionSnapshot
}>()
</script>

<template>
  <p class="pid-body text-center" role="status">You're in — bidding opens here</p>
</template>
