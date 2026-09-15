<!-- ~/components/agency/income/UnclaimedBanner.vue -->
<!-- Attention banner surfaced when one or more past runs still hold unclaimed
     rewards. Renders nothing when there is nothing to claim. -->
<script setup lang="ts">
// ========================================
// Props
// ========================================

defineProps<{
  count: number
}>()
</script>

<template>
  <UAlert
    v-if="count > 0"
    color="warning"
    variant="subtle"
    icon="i-lucide-gift"
    :title="`You have unclaimed rewards in ${count} run${count === 1 ? '' : 's'}`"
  />
</template>
