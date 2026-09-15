<!-- ~/components/agency/income/IncomeHero.vue -->
<!-- Big exact income figure for a run: earned minus exchanged minus deducted.
     May be negative — the exact formatter keeps the leading minus. -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import type { IncomeTotals } from '~/types/income/income'
import { formatDiamondsExact } from '~/utils/incomeFormat'

// ========================================
// Props
// ========================================

defineProps<{
  totals: IncomeTotals
}>()
</script>

<template>
  <div class="text-center py-4">
    <p class="text-xs uppercase tracking-wide text-muted font-semibold">Income</p>
    <p class="text-4xl font-bold flex items-center justify-center gap-2 mt-1">
      <UIcon name="i-lucide-gem" class="size-7 text-secondary" />
      {{ formatDiamondsExact(totals.income) }}
    </p>
    <p class="text-xs text-muted mt-2">Earned − Exchanged − Deducted</p>
  </div>
</template>
