<script setup lang="ts">
definePageMeta({ layout: 'pretty-id-sub', middleware: ['auth', 'pretty-id-enabled'] })

const route = useRoute()

/** `NaN` for a malformed URL — the view renders its "not found" state. */
const lotId = computed(() => Number(route.params.id))
</script>

<template>
  <PrettyIdLotView :lot-id="lotId" />
</template>
