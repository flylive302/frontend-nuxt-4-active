<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import type { AgencyMemberRole } from '~/types/agency/agency'
import { AGENCY_ROLE_CONFIG } from '~/types/agency/agency'

// ========================================
// Props
// ========================================

const props = defineProps<{
  role: AgencyMemberRole
}>()

// ========================================
// Computed
// ========================================

const config = computed(() => AGENCY_ROLE_CONFIG[props.role])
</script>

<template>
  <span
    class="px-1.5 py-0.5 rounded text-xs font-semibold inline-flex items-center gap-1 shrink-0"
    :class="[
      config.color === 'primary' ? 'bg-primary/20 text-primary' : '',
      config.color === 'info' ? 'bg-info/20 text-info' : '',
      config.color === 'neutral' ? 'bg-muted/80 text-muted' : '',
    ]"
  >
    <icon :name="config.icon" class="size-3" />
    {{ config.label }}
  </span>
</template>
