<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import type { AgencyStatus } from '~/types/agency/agency'
import { AGENCY_STATUS_CONFIG } from '~/types/agency/agency'

// ========================================
// Props
// ========================================

const props = defineProps<{
  status: AgencyStatus
}>()

// ========================================
// Computed
// ========================================

const config = computed(() => AGENCY_STATUS_CONFIG[props.status])
</script>

<template>
  <span
    class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm font-semibold"
    :class="[
      config.color === 'success' ? 'bg-success/20 text-success' : '',
      config.color === 'warning' ? 'bg-warning/20 text-warning' : '',
      config.color === 'error' ? 'bg-error/20 text-error' : '',
      config.color === 'neutral' ? 'bg-muted/20 text-muted' : '',
    ]"
  >
    <icon :name="config.icon" class="size-4" />
    {{ config.label }}
  </span>
</template>
