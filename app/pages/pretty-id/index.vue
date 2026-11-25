<script setup lang="ts">
// Entry-only: `pretty-id-landing` redirects to the landing tab before this renders.
definePageMeta({ layout: 'pretty-id', middleware: ['auth', 'pretty-id-enabled', 'pretty-id-landing'] })
</script>

<template>
  <div />
</template>
