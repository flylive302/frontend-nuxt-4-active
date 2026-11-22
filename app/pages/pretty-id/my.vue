<script setup lang="ts">
definePageMeta({ layout: 'pretty-id', middleware: ['auth', 'pretty-id-enabled'] })
</script>

<template>
  <PrettyIdMyTab />
</template>
