<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import MilestoneCard from '~/components/recharge/MilestoneCard.vue'

// ========================================
// Config
// ========================================

definePageMeta({ layout: 'recharge', middleware: 'auth' })

const TIMEFRAME = 'weekly' as const

const items = [
  { label: 'Ranking', slot: 'ranking' as const, value: 'ranking' },
  { label: 'Task', slot: 'task' as const, value: 'task' },
] satisfies TabsItem[]

// ========================================
// Data + State
// ========================================

const { fetchProgress } = useRechargeMissionData()
const store = useMissionStore()
const { subscribe, unsubscribe } = useMissionEcho(() => fetchProgress(TIMEFRAME))

const progress = computed(() => store.progressFor(TIMEFRAME))
const resetsAt = computed(() => progress.value?.resets_at ?? null)
const serverTime = computed(() => progress.value?.server_time ?? null)

// ========================================
// Countdown (server-synced)
// ========================================

const { hours, minutes, seconds } = useMissionCountdown(resetsAt, serverTime)

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  fetchProgress(TIMEFRAME)
  subscribe()
})

onUnmounted(unsubscribe)
</script>

<template>
  <div>
    <RechargeClock :hours="hours" :minutes="minutes" :seconds="seconds" />

    <UTabs
      :items="items"
      default-value="ranking"
      class="mt-4"
      :ui="{
        root: 'min-w-full',
        list: 'rounded-full w-fit mx-auto',
        indicator: 'bg-linear-to-b from-tertiary-600 to-tertiary-950 rounded-full',
        trigger: 'grow',
        label: 'text-white',
      }"
    >
      <!-- Ranking tab — UTabs unmountOnHide:true means this unmounts when Task is active,
           pausing the leaderboard poll automatically via onUnmounted in useRechargeLeaderboard -->
      <template #ranking>
        <RechargeMissionRankingTab :timeframe="TIMEFRAME" />
      </template>

      <!-- Task tab -->
      <template #task>
        <div class="px-2 mt-2 space-y-8">
          <!-- Loading -->
          <div v-if="store.isLoading && !progress" class="flex justify-center py-8">
            <div class="w-6 h-6 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          </div>

          <!-- Error -->
          <div v-else-if="store.error && !progress" class="text-center py-8">
            <p class="text-white/60 text-sm">{{ store.error }}</p>
            <UButton
              size="sm"
              class="mt-3 bg-amber-400 text-black font-bold rounded-lg"
              @click="fetchProgress(TIMEFRAME)"
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
                :timeframe="TIMEFRAME"
              />
            </template>
            <p v-else class="text-center text-white/60 text-sm py-6">
              No milestones configured yet.
            </p>
          </template>
        </div>
      </template>
    </UTabs>
  </div>
</template>
