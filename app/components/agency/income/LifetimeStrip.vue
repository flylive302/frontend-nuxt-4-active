<!-- ~/components/agency/income/LifetimeStrip.vue -->
<!-- Pinned lifetime summary: total income, completed runs, current agency. -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import type { IncomeAgency, IncomeOverview } from '~/types/income/income'
import { formatDiamondsExact } from '~/utils/incomeFormat'

// ========================================
// Types
// ========================================

type Lifetime = IncomeOverview['lifetime']

// ========================================
// Props
// ========================================

defineProps<{
  lifetime: Lifetime | null
  currentAgency: IncomeAgency | null
  loading: boolean
}>()
</script>

<template>
  <div class="bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg p-3">
    <!-- Loading State -->
    <div v-if="loading" class="space-y-3">
      <div class="grid grid-cols-2 gap-2">
        <USkeleton class="h-16 rounded-lg" />
        <USkeleton class="h-16 rounded-lg" />
      </div>
      <USkeleton class="h-10 rounded-lg" />
    </div>

    <!-- Summary -->
    <div v-else class="space-y-3">
      <div class="grid grid-cols-2 gap-2">
        <div class="text-center">
          <div class="flex items-center justify-center gap-1 text-secondary-400">
            <UIcon name="i-lucide-gem" class="size-5" />
            <p class="text-lg font-bold">{{ formatDiamondsExact(lifetime?.income ?? 0) }}</p>
          </div>
          <p class="text-xs text-muted mt-1">Total Income</p>
        </div>
        <div class="text-center">
          <div class="flex items-center justify-center gap-1 text-tertiary">
            <UIcon name="i-lucide-flag" class="size-5" />
            <p class="text-lg font-bold">{{ lifetime?.completed_runs ?? 0 }}</p>
          </div>
          <p class="text-xs text-muted mt-1">Completed Runs</p>
        </div>
      </div>

      <div class="flex items-center gap-2 pt-2 border-t border-neutral-700">
        <UAvatar
          :src="currentAgency?.logo_url ?? undefined"
          :alt="currentAgency?.name ?? 'Agency'"
          icon="i-lucide-building-2"
          size="sm"
        />
        <span class="text-sm font-semibold truncate">
          {{ currentAgency?.name ?? 'Not in an agency' }}
        </span>
      </div>
    </div>
  </div>
</template>
