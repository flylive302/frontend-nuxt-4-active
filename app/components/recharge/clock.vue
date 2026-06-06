<script setup lang="ts">
import { RECHARGE_ACTIVITY } from '~/constants/assets'

defineProps<{
  hours: number
  minutes: number
  seconds: number
}>()

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}
</script>

<template>
  <div class="mt-4 flex items-center justify-center gap-2">
    <img :src="RECHARGE_ACTIVITY.arrowRight" alt="" class="w-16" aria-hidden="true">

    <div class="w-16 relative">
      <img :src="RECHARGE_ACTIVITY.timeBg" alt="" class="w-16" aria-hidden="true">
      <Transition name="count" mode="out-in">
        <p
            :key="hours"
            class="count-text text-2xl pb-3.5"
        >
          {{ pad(hours) }}
        </p>
      </Transition>
    </div>

    <div class="w-16 relative">
      <img :src="RECHARGE_ACTIVITY.timeBg" alt="" class="w-16" aria-hidden="true">
      <Transition name="count" mode="out-in">
        <p
            :key="minutes"
            class="count-text text-2xl pb-3.5"
        >
          {{ pad(minutes) }}
        </p>
      </Transition>
    </div>

    <div class="w-16 relative">
      <img :src="RECHARGE_ACTIVITY.timeBg" alt="" class="w-16" aria-hidden="true">
      <Transition name="count" mode="out-in">
        <p
            :key="seconds"
            class="count-text text-2xl pb-3.5"
        >
          {{ pad(seconds) }}
        </p>
      </Transition>
    </div>

    <img :src="RECHARGE_ACTIVITY.arrowLeft" alt="" class="w-16" aria-hidden="true">
  </div>
</template>

<style scoped>
.count-enter-active,
.count-leave-active {
  transition: all 0.25s ease;
}

.count-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.95);
}

.count-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

.count-text {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  color: white;
}
</style>