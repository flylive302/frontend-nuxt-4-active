<!-- ~/components/agency/income/MilestoneRows.vue -->
<!-- One row per crossed milestone: tier, required Gift coins, crossed date,
     member diamond reward, and claim state. A range spans several runs and
     tiers repeat across them, so rows are keyed on run + tier, not tier. -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import type { OwnerIncomeSheetMilestone } from '~/types/income/ownerIncome'
import { formatDiamondsExact, formatRunDate } from '~/utils/incomeFormat'
import { ownerIncomeMilestoneKey } from '~/utils/ownerIncomeCard'

// ========================================
// Props
// ========================================

defineProps<{
  milestones: OwnerIncomeSheetMilestone[]
}>()
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="milestone in milestones"
      :key="ownerIncomeMilestoneKey(milestone)"
      class="flex items-center justify-between gap-2 bg-elevated rounded-lg p-3"
    >
      <div class="flex items-center gap-2 min-w-0">
        <UBadge color="tertiary" variant="soft" class="font-bold shrink-0">Tier {{ milestone.tier }}</UBadge>
        <span class="text-xs text-muted flex items-center gap-1 shrink-0">
          <UIcon name="i-lucide-zap" class="size-3.5" />
          {{ formatXp(milestone.required_xp) }} Gift coins
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
      No milestones crossed in this window.
    </p>
  </div>
</template>
