<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
import { CP_COUNTDOWN_UNITS } from '~/constants/cp-event'

// Own component so a future per-second tick re-renders only these four boxes,
// not the layout's ferris wheel and tabs.
</script>

<template>
  <div class="flex justify-center gap-3 px-8">
    <div v-for="unit in CP_COUNTDOWN_UNITS" :key="unit" class="relative w-12 text-center text-white">
      <img :src="ASSETS.CP_FERRIS_TIME_BG" class="absolute inset-0 z-0" alt="">
      <p class="relative z-10 text-4xl">00</p>
      <p class="relative z-10 mt-1 text-sm">{{ unit }}</p>
    </div>
  </div>
</template>
