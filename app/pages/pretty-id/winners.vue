<script setup lang="ts">
definePageMeta({ layout: 'pretty-id-sub', middleware: ['auth', 'pretty-id-enabled'] })
</script>

<template>
  <PrettyIdWinnersView />
</template>
