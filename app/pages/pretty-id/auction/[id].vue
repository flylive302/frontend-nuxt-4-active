<script setup lang="ts">
import { parsePrettyIdAuctionId } from '~/utils/pretty-id-auction'

definePageMeta({
  layout: 'pretty-id-sub',
  middleware: ['auth', 'pretty-id-enabled', 'pretty-id-auction-enabled'],
})

const route = useRoute()

/** `null` for a malformed URL: the view renders its "not found" state and fetches nothing. */
const auctionId = computed(() => parsePrettyIdAuctionId(route.params.id))
</script>

<template>
  <PrettyIdAuctionView :auction-id="auctionId" />
</template>
