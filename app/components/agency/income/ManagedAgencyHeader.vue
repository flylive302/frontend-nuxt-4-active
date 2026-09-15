<!-- ~/components/agency/income/ManagedAgencyHeader.vue -->
<!-- Compact identity row for the agency an owner/admin manages: avatar, id,
     and name. Sits at the top of the owner income page. -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import type { IncomeAgency } from '~/types/income/income'

// ========================================
// Props
// ========================================

defineProps<{
  agency: IncomeAgency
}>()
</script>

<template>
  <div class="flex items-center gap-2 min-w-0">
    <UAvatar
      :src="agency.logo_url ?? undefined"
      :alt="agency.name"
      icon="i-lucide-building-2"
      size="md"
    />
    <span class="text-xs text-muted shrink-0">#{{ agency.id }}</span>
    <span class="text-sm font-bold truncate">{{ agency.name }}</span>
  </div>
</template>
