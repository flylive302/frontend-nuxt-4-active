<!-- ~/components/agency/income/InProgressNote.vue -->
<!-- Generic note shown while a run/cycle is still open: reseller payments for
     it aren't final yet. Reused by the owner cycle view, the member run view
     and the reseller panel — `windowKind` defaults to 'run' so those callers
     keep today's exact wording byte-for-byte. -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import { computed } from 'vue'
import type { OwnerIncomeWindowKind } from '~/types/income/ownerIncome'

// ========================================
// Props
// ========================================

const props = withDefaults(
  defineProps<{
    windowKind?: OwnerIncomeWindowKind
  }>(),
  { windowKind: 'run' }
)

// ========================================
// Computed
// ========================================

const title = computed(() =>
  props.windowKind === 'range'
    ? 'These dates include the run in progress — reseller payments for it are counted after it ends.'
    : 'Run in progress — reseller payments for this run are counted after it ends.'
)
</script>

<template>
  <UAlert color="info" variant="soft" icon="i-lucide-info" :title="title" />
</template>
