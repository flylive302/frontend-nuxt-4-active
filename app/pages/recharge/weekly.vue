<script setup lang="ts">
definePageMeta({ layout: 'recharge', middleware: 'auth' })
</script>

<template>
  <RechargeRankedPanel timeframe="weekly" />
</template>
