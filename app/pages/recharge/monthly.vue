<script setup lang="ts">
definePageMeta({ layout: 'recharge', middleware: 'auth' })
</script>

<template>
  <RechargeRankedPanel timeframe="monthly" />
</template>
