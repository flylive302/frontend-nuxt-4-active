<script setup lang="ts">
/** /recharge page body: countdown + daily milestones. */

const { progress, isLoading, error, hours, minutes, seconds, refresh } = useRechargeTimeframe('daily')

// Warm the finale/milestone assets while the user is on the entry tab.
useMissionAssetPreloader().preload()
</script>

<template>
  <div class="relative">
    <RechargeClock :hours="hours" :minutes="minutes" :seconds="seconds" />

    <RechargeMilestoneList
      timeframe="daily"
      :progress="progress"
      :is-loading="isLoading"
      :error="error"
      @retry="refresh"
    />
  </div>
</template>
