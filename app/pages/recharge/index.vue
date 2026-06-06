<script setup lang="ts">
import { RECHARGE_ACTIVITY } from '~/constants/assets'
import MilestoneCard from "~/components/recharge/MilestoneCard.vue";

// ========================================
// Config
// ========================================

definePageMeta({ layout: 'recharge', middleware: 'auth' })

// ========================================
// Data + State
// ========================================

const { fetchDaily } = useRechargeMissionData()
const store = useMissionStore()

const resetsAt = computed(() => store.dailyProgress?.resets_at ?? null)
const serverTime = computed(() => store.dailyProgress?.server_time ?? null)

// ========================================
// Countdown (server-synced)
// ========================================

const { hours, minutes, seconds } = useMissionCountdown(resetsAt, serverTime)

// ========================================
// Asset preload on intent
// ========================================

const { preload } = useMissionAssetPreloader()
preload()

// ========================================
// Lifecycle
// ========================================

onMounted(fetchDaily)
</script>

<template>
  <div class="px-2 relative">
    <RechargeClock
      :hours="hours"
      :minutes="minutes"
      :seconds="seconds"
    />

    <!-- Loading state -->
    <div v-if="store.isLoading" class="flex justify-center py-8">
      <div class="w-6 h-6 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
    </div>

    <!-- Error state -->
    <div v-else-if="store.error" class="text-center py-8">
      <p class="text-white/60 text-sm">{{ store.error }}</p>
      <button
        class="mt-3 px-4 py-2 bg-amber-400 text-black text-sm font-bold rounded-lg"
        @click="fetchDaily"
      >
        Retry
      </button>
    </div>

    <!-- Milestones -->
    <template v-else-if="store.dailyProgress">
      <div class="mt-4 space-y-8">
        <template v-if="store.dailyProgress.milestones.length > 0">
          <MilestoneCard
            v-for="milestone in store.dailyProgress.milestones"
            :key="milestone.id"
            :milestone="milestone"
            :net-volume="store.dailyProgress.net_volume"
          />
        </template>
        <p v-else class="text-center text-white/60 text-sm py-6">
          No milestones configured yet.
        </p>
      </div>
    </template>

    <!-- Empty state before first fetch -->
    <template v-else>
      <img :src="RECHARGE_ACTIVITY.taskBg" alt="" class="w-full -mt-8" aria-hidden="true">
    </template>
  </div>
</template>
