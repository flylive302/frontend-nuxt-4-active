<script setup lang="ts">
definePageMeta({ layout: 'pretty-id-sub', middleware: ['auth', 'pretty-id-enabled'] })

const route = useRoute()

/** The searched ID, carried in `?q=` so the result survives a reload and a back/forward. */
const query = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))
</script>

<template>
  <PrettyIdSearchView :query="query" />
</template>
