<!-- ~/components/agency/income/MembersHero.vue -->
<!-- Members-block hero for the owner/admin window view: shared IncomeHero big
     figure, a compact roster line, the agency's Gift coins for the window, then
     the totals breakdown. No transaction lists — those only exist per-member,
     not for the whole roster. -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import { computed } from 'vue'
import type { OwnerIncomeMembersTotals } from '~/types/income/ownerIncome'
import { formatXp } from '~/utils/currency'

// ========================================
// Props
// ========================================

const props = defineProps<{
  totals: OwnerIncomeMembersTotals
}>()

// ========================================
// Computed
// ========================================

const rosterLine = computed(() => {
  const memberWord = props.totals.members_count === 1 ? 'member' : 'members'
  const base = `${props.totals.members_count} ${memberWord}`
  return props.totals.left_count > 0 ? `${base} · ${props.totals.left_count} left` : base
})
</script>

<template>
  <div class="space-y-3">
    <AgencyIncomeHero :totals="totals" label="Members Income" />
    <p class="text-xs text-muted text-center">{{ rosterLine }}</p>
    <p class="text-xs text-muted text-center flex items-center justify-center gap-1">
      <UIcon name="i-lucide-zap" class="size-3.5" />
      Gift coins: {{ formatXp(totals.gift_coins) }}
    </p>
    <AgencyIncomeTotalsCards :totals="totals" :collapsible="false" />
  </div>
</template>
