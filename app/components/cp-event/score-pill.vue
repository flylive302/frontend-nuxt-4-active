<script setup lang="ts">
import { formatCurrency } from '~/utils/currency'

// Dark "❤️ 1,234" pill under a pair (podium + leaderboard rows).

defineProps<{
  value: number
}>()
</script>

<template>
  <p class="rounded-xl px-2 py-1 bg-neutral-950/50 text-xs font-semibold leading-none text-white">❤️ {{ formatCurrency(value) }}</p>
</template>
