<script setup lang="ts">
import { parsePrettyIdHistoryMonth } from '~/utils/pretty-id-history'

definePageMeta({
  layout: 'pretty-id-sub',
  middleware: ['auth', 'pretty-id-enabled', 'pretty-id-auction-enabled'],
})

const route = useRoute()

/** `null` (no or malformed `?month=`) means the current month. */
const month = computed(() => parsePrettyIdHistoryMonth(route.query.month))
</script>

<template>
  <PrettyIdWinnersView :month="month" />
</template>
