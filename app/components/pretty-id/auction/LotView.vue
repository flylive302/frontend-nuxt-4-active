<script setup lang="ts">
/**
 * Auction lot page (`/pretty-id/auction/:id`): owns the gutter and decides
 * between the lot itself and the "not found" state for a malformed URL.
 *
 * The check lives here, above `<PrettyIdLotDetail>`, so a bad id never starts
 * the lot polling (which would toast and retry a request that cannot succeed).
 */

// Config
const props = defineProps<{
  /** `NaN` when the URL segment is not a number. */
  lotId: number
}>()

// State
const isMalformed = computed(() => !Number.isInteger(props.lotId))
</script>

<template>
  <div class="pid-sec pt-[22px]">
    <PrettyIdLotNotFound v-if="isMalformed" />
    <PrettyIdLotDetail v-else :lot-id="lotId" />
  </div>
</template>
