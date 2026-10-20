<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
import { CP_COUNTDOWN_UNITS } from '~/constants/cp-event'
import { padTwo, splitCountdownHours } from '~/utils/cp'

// Own component so the per-second tick re-renders only these four boxes,
// not the layout's ferris wheel and tabs. Fed by the week meta in the cp store
// (filled by useCpEventData) through the server-synced mission countdown.

const store = useCpStore()
const { hours, minutes, seconds } = useMissionCountdown(
  computed(() => store.closesAt),
  computed(() => store.serverTime),
)

const values = computed(() => {
  if (!store.week) return ['--', '--', '--', '--']
  const { days, hours: h } = splitCountdownHours(hours.value)
  return [days, h, minutes.value, seconds.value].map(padTwo)
})
</script>

<template>
  <div class="flex justify-center gap-3 px-8">
    <div v-for="(unit, index) in CP_COUNTDOWN_UNITS" :key="unit" class="relative w-12 text-center text-white">
      <img :src="ASSETS.CP_TIME_BG" class="absolute inset-0 z-0" alt="">
      <p class="relative z-10 text-4xl">{{ values[index] }}</p>
      <p class="relative z-10 mt-1 text-sm">{{ unit }}</p>
    </div>
  </div>
</template>
