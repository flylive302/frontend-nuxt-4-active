<script setup lang="ts">
/**
 * /recharge/weekly and /recharge/monthly page body: countdown + Ranking / Task
 * tabs. The two pages are identical apart from the timeframe.
 */
import type { TabsItem } from '@nuxt/ui'
import type { RechargeRankedTimeframe } from '~/constants/recharge'

const props = defineProps<{
  timeframe: RechargeRankedTimeframe
}>()

const items = [
  { label: 'Ranking', slot: 'ranking' as const, value: 'ranking' },
  { label: 'Task', slot: 'task' as const, value: 'task' },
] satisfies TabsItem[]

const { progress, isLoading, error, hours, minutes, seconds, refresh } = useRechargeTimeframe(props.timeframe)
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
        <RechargeMissionRankingTab :timeframe="timeframe" />
      </template>

      <template #task>
        <RechargeMilestoneList
          :timeframe="timeframe"
          :progress="progress"
          :is-loading="isLoading"
          :error="error"
          @retry="refresh"
        />
      </template>
    </UTabs>
  </div>
</template>
