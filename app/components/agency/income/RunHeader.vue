<!-- ~/components/agency/income/RunHeader.vue -->
<!-- Run detail header: date range, status badge, and the run's agency
     (always shown — a run always belongs to exactly one agency). -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import type { RunDetail } from '~/types/income/income'
import { formatRunRange, toStatusBadgeColor } from '~/utils/incomeFormat'

// ========================================
// Props
// ========================================

defineProps<{
  run: RunDetail
}>()
</script>

<template>
  <div class="flex items-center justify-between gap-2">
    <div class="flex items-center gap-2 min-w-0">
      <UAvatar
        :src="run.agency.logo_url ?? undefined"
        :alt="run.agency.name"
        icon="i-lucide-building-2"
        size="sm"
      />
      <div class="min-w-0">
        <p class="text-sm font-semibold truncate">#{{ run.agency.id }} · {{ run.agency.name }}</p>
        <p class="text-xs text-muted">{{ formatRunRange(run.started_at, run.ends_at) }}</p>
      </div>
    </div>
    <UBadge :color="toStatusBadgeColor(run.status_color)" variant="soft" class="font-bold shrink-0">
      {{ run.status_label }}
    </UBadge>
  </div>
</template>
