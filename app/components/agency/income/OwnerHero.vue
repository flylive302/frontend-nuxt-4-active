<!-- ~/components/agency/income/OwnerHero.vue -->
<!-- Owner-block hero for the owner cycle view: shared IncomeHero big figure,
     the totals breakdown, then an Owner cut / Own hosting split of Earned
     (the two pieces Earned is made of for the owner). -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import type { OwnerIncomeOwnerTotals } from '~/types/income/ownerIncome'
import { formatDiamondsExact } from '~/utils/incomeFormat'
import { formatXp } from '~/utils/currency'

// ========================================
// Props
// ========================================

defineProps<{
  totals: OwnerIncomeOwnerTotals
}>()
</script>

<template>
  <div class="space-y-2">
    <AgencyIncomeHero :totals="totals" label="Owner Income" />
    <AgencyIncomeTotalsCards :totals="totals" :collapsible="false" />

    <div class="bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg p-3 flex items-center justify-between">
      <div class="text-center flex-1">
        <p class="text-xs text-muted">Owner cut</p>
        <p class="flex items-center justify-center gap-1 font-bold mt-1">
          <UIcon name="i-lucide-gem" class="size-4" />
          {{ formatDiamondsExact(totals.owner_cut) }}
        </p>
      </div>
      <div class="text-center flex-1">
        <p class="text-xs text-muted">Own hosting</p>
        <p class="flex items-center justify-center gap-1 font-bold mt-1">
          <UIcon name="i-lucide-gem" class="size-4" />
          {{ formatDiamondsExact(totals.own_hosting) }}
        </p>
      </div>
      <div class="text-center flex-1">
        <p class="text-xs text-muted">Gift coins</p>
        <p class="flex items-center justify-center gap-1 font-bold mt-1">
          <UIcon name="i-lucide-zap" class="size-4" />
          {{ formatXp(totals.gift_coins) }}
        </p>
      </div>
    </div>
  </div>
</template>
