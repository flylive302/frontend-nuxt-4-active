<script setup lang="ts">
/**
 * Loading / error / milestone list for one timeframe. Presentational only —
 * the parent owns the data (useRechargeTimeframe) and handles `retry`.
 */
import type { MissionProgressResponse } from '~/types/mission/recharge'
import type { RechargeTimeframe } from '~/constants/recharge'
import { RECHARGE_ACTIVITY } from '~/constants/assets'
import MilestoneCard from '~/components/recharge/MilestoneCard.vue'

defineProps<{
  timeframe: RechargeTimeframe
  progress: MissionProgressResponse | null
  isLoading: boolean
  error: string | null
}>()

defineEmits<{
  (e: 'retry'): void
}>()
</script>

<template>
  <div class="px-2 mt-2 space-y-8">
    <!-- Loading (first fetch only — a refresh keeps the current cards on screen) -->
    <div v-if="isLoading && !progress" class="flex justify-center py-8">
      <div class="w-6 h-6 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
    </div>

    <!-- Error -->
    <div v-else-if="error && !progress" class="text-center py-8">
      <p class="text-white/60 text-sm">{{ error }}</p>
      <UButton
        size="sm"
        class="mt-3 bg-amber-400 text-black font-bold rounded-lg"
        @click="$emit('retry')"
      >
        Retry
      </UButton>
    </div>

    <!-- Milestones -->
    <template v-else-if="progress">
      <template v-if="progress.milestones.length > 0">
        <MilestoneCard
          v-for="milestone in progress.milestones"
          :key="milestone.id"
          :milestone="milestone"
          :net-volume="progress.net_volume"
          :timeframe="timeframe"
        />
      </template>
      <p v-else class="text-center text-white/60 text-sm py-6">
        No milestones configured yet.
      </p>
    </template>

    <!-- Empty state before the first fetch -->
    <img v-else :src="RECHARGE_ACTIVITY.taskBg" alt="" class="w-full -mt-8" aria-hidden="true">
  </div>
</template>
