<!-- ~/components/agency/income/MembersHero.vue -->
<!-- Members-block hero for the owner/admin cycle view: shared IncomeHero big
     figure, a compact roster line, then the totals breakdown. No transaction
     lists — those only exist per-member, not for the whole roster. -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import { computed } from 'vue'
import type { OwnerIncomeMembersTotals } from '~/types/income/ownerIncome'

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
    <AgencyIncomeTotalsCards :totals="totals" :collapsible="false" />
  </div>
</template>
