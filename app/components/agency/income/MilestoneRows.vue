<!-- ~/components/agency/income/MilestoneRows.vue -->
<!-- One row per crossed milestone on a run: tier, required XP, crossed date,
     member diamond reward, and claim state. -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import type { RunDetailMilestone } from '~/types/income/income'
import { formatDiamondsExact, formatRunDate } from '~/utils/incomeFormat'

// ========================================
// Props
// ========================================

defineProps<{
  milestones: RunDetailMilestone[]
}>()
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="milestone in milestones"
      :key="milestone.tier"
      class="flex items-center justify-between gap-2 bg-elevated rounded-lg p-3"
    >
      <div class="flex items-center gap-2 min-w-0">
        <UBadge color="tertiary" variant="soft" class="font-bold shrink-0">Tier {{ milestone.tier }}</UBadge>
        <span class="text-xs text-muted flex items-center gap-1 shrink-0">
          <UIcon name="i-lucide-zap" class="size-3.5" />
          {{ formatXp(milestone.required_xp) }} XP
        </span>
        <span class="text-xs text-muted truncate">
          {{ milestone.crossed_at ? formatRunDate(milestone.crossed_at) : '—' }}
        </span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="flex items-center gap-1 text-sm font-semibold text-secondary">
          <UIcon name="i-lucide-gem" class="size-4" />
          {{ formatDiamondsExact(milestone.member_diamond_reward) }}
        </span>
        <UBadge :color="milestone.member_reward_claimed ? 'success' : 'warning'" variant="soft">
          {{ milestone.member_reward_claimed ? 'Claimed' : 'Unclaimed' }}
        </UBadge>
      </div>
    </div>

    <p v-if="milestones.length === 0" class="text-sm text-muted text-center py-4">
      No milestones crossed in this run.
    </p>
  </div>
</template>
