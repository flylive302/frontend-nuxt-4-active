<!-- ~/components/agency/IncomeLadderTable.vue -->
<!-- Full milestone ladder for the active run: one row per tier with a
     crossed / active / locked progress bar and the diamond reward. -->
<script setup lang="ts">
import { computed } from 'vue'
import type { LadderTier } from '~/types/income/income'

// ========================================
// Options
// ========================================

defineOptions({ name: 'IncomeLadderTable' })

// ========================================
// Store
// ========================================

const incomeStore = useIncomeStore()

// ========================================
// Computed
// ========================================

const ladder = computed<LadderTier[]>(() => incomeStore.activeRun?.ladder ?? [])
const activeProgress = computed(() => Math.round(incomeStore.activeRun?.progress_percentage ?? 0))

/**
 * Per-row fill: crossed tiers are full, the active tier reflects band progress,
 * locked tiers are empty.
 */
function rowProgress(rung: LadderTier): number {
  if (rung.crossed) return 100
  if (rung.is_active) return activeProgress.value
  return 0
}

function rowColor(rung: LadderTier): 'success' | 'tertiary' | 'neutral' {
  if (rung.crossed) return 'success'
  if (rung.is_active) return 'tertiary'
  return 'neutral'
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="rung in ladder"
      :key="rung.tier"
      class="bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg p-3"
      :class="{ 'opacity-60': !rung.crossed && !rung.is_active }"
    >
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <UBadge :color="rung.crossed ? 'success' : rung.is_active ? 'tertiary' : 'neutral'" variant="soft" class="font-bold">
            Tier {{ rung.tier }}
          </UBadge>
          <UIcon v-if="rung.crossed" name="i-lucide-check-circle" class="size-4 text-success" />
          <UIcon v-else-if="rung.is_active" name="i-lucide-loader" class="size-4 text-tertiary" />
          <UIcon v-else name="i-lucide-lock" class="size-4 text-muted" />
        </div>
        <div class="flex items-center gap-1 text-secondary font-bold">
          <UIcon name="i-lucide-gem" class="size-4" />
          {{ rung.member_diamond_reward }}
        </div>
      </div>

      <UProgress :model-value="rowProgress(rung)" :color="rowColor(rung)" size="sm" />

      <p class="text-xs text-muted mt-1 text-right">
        <UIcon name="i-lucide-zap" class="size-3 inline-block" />
        {{ formatCurrency(rung.required_xp) }} XP
      </p>
    </div>
  </div>
</template>
