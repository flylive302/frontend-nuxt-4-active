<!-- ~/components/economy/activity-summary.vue -->
<!-- Compact earned / spent strip above the activity list. Reads the cached
     summary from the store; renders nothing until it has loaded. -->
<script setup lang="ts">
import { formatCurrency } from '~/utils/currency'

defineOptions({ name: 'ActivitySummary' })

const store = useTransactionStore()

const summary = computed(() => store.summary)
</script>

<template>
  <div v-if="summary" class="grid grid-cols-3 gap-2 px-3 py-2 text-center text-xs">
    <div class="rounded-lg bg-success-950/60 py-2">
      <p class="text-muted">Received</p>
      <p class="font-bold tabular-nums text-success-400">+{{ formatCurrency(summary.coins.total_earned) }}</p>
    </div>
    <div class="rounded-lg bg-error-950/60 py-2">
      <p class="text-muted">Spent</p>
      <p class="font-bold tabular-nums text-error-400">-{{ formatCurrency(summary.coins.total_spent) }}</p>
    </div>
    <div class="rounded-lg bg-elevated py-2">
      <p class="text-muted">Gifts</p>
      <p class="font-bold tabular-nums">
        <UIcon name="i-lucide-arrow-up-right" class="size-3" />{{ summary.gifts.total_sent }}
        <UIcon name="i-lucide-arrow-down-left" class="ml-1 size-3" />{{ summary.gifts.total_received }}
      </p>
    </div>
  </div>
</template>
