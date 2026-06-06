<script setup lang="ts">
import type { MilestoneProgress } from '~/types/mission/recharge'
import { RECHARGE_ACTIVITY,ASSETS } from '~/constants/assets'

// ========================================
// Props
// ========================================

const props = defineProps<{
  milestone: MilestoneProgress
  netVolume: number
}>()

// ========================================
// Derived state (INTENT — pure display)
// ========================================

const progressPercent = computed(() => {
  if (props.milestone.threshold === 0) return 100
  return Math.min(100, Math.round((props.netVolume / props.milestone.threshold) * 100))
})

const isClaimable = computed(() => props.milestone.state === 'claimable')
</script>

<template>
  <div
    class="w-full"
  >
    <div class="w-3/4 mx-auto relative z-10">
      <img :src="RECHARGE_ACTIVITY.topHeader" alt="recharge activity" class="w-full">
      <p class="font-bold absolute inset-0 flex items-center justify-center text-md mt-2 text-white">
        Recharge {{ milestone.threshold.toLocaleString() }} Coins
      </p>
    </div>

    <div class="w-full -mt-6 relative">
      <!-- Background task card -->
      <img :src="RECHARGE_ACTIVITY.taskBg" alt="" class="w-full" aria-hidden="true">
      <div class="p-6 absolute inset-0">
        <div class="flex items-center justify-center gap-2 mb-2 px-2 mt-2">
          <!-- Progress bar -->
          <div class="h-4 w-full rounded-full bg-tertiary/30 overflow-hidden">
            <div
                class="h-full rounded-full transition-all duration-500"
                :class="isClaimable ? 'bg-amber-400' : 'bg-amber-600'"
                :style="{ width: `${progressPercent}%` }"
            />
          </div>
          <!-- Volume label -->
          <p class="text-white w-44 text-md">
            {{ formatCurrency(netVolume) }} / {{ formatCurrency(milestone.threshold) }}
          </p>
        </div>

        <!-- Rewards row -->
        <div
            v-if="milestone.rewards.length > 0"
            class="grid gap-2 w-fit mx-auto"
            :class="milestone.rewards.length > 1 ? 'grid-cols-2' : 'grid-cols-1'"
        >
          <div
              v-for="reward in milestone.rewards"
              :key="reward.id"
              class="flex flex-col justify-center items-center gap-2"
          >
            <template v-if="reward.reward_type === 'coins'">
              <img :src="ASSETS.COIN_ICON" alt="" class="w-24" aria-hidden="true">
              <span class="text-md text-center font-bold">+{{ reward.coin_value?.toLocaleString() }} Coins</span>
            </template>
            <template v-else>
              <img :src="ASSETS.COIN_ICON" alt="" class="w-24" aria-hidden="true">
              <span class="text-amber-300 text-md text-center font-bold">{{ reward.reward_type }}</span>
            </template>
          </div>
        </div>

        <!-- Receive button — present but disabled (claiming is a later slice) -->
        <div class="w-full flex justify-center mt-4">
          <UButton
              variant="solid"
              size="xl"
              class="mx-auto bg-linear-to-br from-tertiary-400 to-tertiary-800 rounded-full"

          >
            {{ !isClaimable ? 'Not There Yet' : 'Claim Now' }}
          </UButton>
        </div>
      </div>
    </div>

  </div>
</template>
