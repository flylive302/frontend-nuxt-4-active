<script setup lang="ts">
import { RECHARGE_ACTIVITY} from "~/constants/assets";
import type { TabsItem } from '@nuxt/ui'

definePageMeta({ layout: 'alt', middleware: 'auth' });

const items = [
  {
    label: 'Ranking',
    slot: 'ranking' as const
  },
  {
    label: 'Task',
    slot: 'task' as const
  }
] satisfies TabsItem[]

</script>

<template>
  <div class="w-full relative min-h-screen bg-[#381f11]">
    <img :src="RECHARGE_ACTIVITY.banner" alt="recharge activity" class="w-full" />

    <div class="flex justify-between items-center -mt-36">
      <div
          class="size-[28vw] ml-3 bg-cover bg-center bg-no-repeat flex justify-center items-end drop-shadow-md"
          :style="{ backgroundImage: `url(${RECHARGE_ACTIVITY.honerBtn})` }"
      >
        <p class="font-bold text-sm text-white pb-6">Honor Wall</p>
      </div>

      <div
          class="h-[16vw] w-[26vw] bg-cover bg-center bg-no-repeat flex justify-center items-center drop-shadow-md"
          :style="{ backgroundImage: `url(${RECHARGE_ACTIVITY.btnRules})` }"
      >
        <p class="font-bold text-md text-white ml-8 pb-1">Rules</p>
      </div>
    </div>

    <div class="h-full bg-contain bg-no-repeat w-full pt-10" :style="{ backgroundImage: `url(${RECHARGE_ACTIVITY.pattern})` }">

      <div class="flex justify-center gap-2">
        <button class="text-white font-bold text-md relative w-24 h-auto flex items-center justify-center">
          <img :src="RECHARGE_ACTIVITY.tab" class="w-full" alt="decoration">
          <span class="absolute mt-2">Daily</span>
        </button>

        <button class="text-white font-bold text-md relative w-24 h-auto flex items-center justify-center">
          <img :src="RECHARGE_ACTIVITY.tabActive" class="w-full" alt="decoration">
          <span class="absolute mt-2">Weekly</span>
        </button>

        <button class="text-white font-bold text-md relative w-24 h-auto flex items-center justify-center">
          <img :src="RECHARGE_ACTIVITY.tab" class="w-full" alt="decoration">
          <span class="absolute mt-2">Monthly</span>
        </button>
      </div>

      <div class="mt-4 flex justify-center items-center gap-2">
        <img :src="RECHARGE_ACTIVITY.arrowRight" alt="decoration" class="w-16" >
        <div class="w-16 relative">
          <img :src="RECHARGE_ACTIVITY.timeBg" alt="decoration" class="w-16" >
          <p class="text-2xl text-tertiary font-bold absolute inset-0 flex justify-center items-center pb-4">00</p>
        </div>
        <div class="w-16 relative">
          <img :src="RECHARGE_ACTIVITY.timeBg" alt="decoration" class="w-16" >
          <p class="text-2xl text-tertiary font-bold absolute inset-0 flex justify-center items-center pb-4">00</p>
        </div>
        <div class="w-16 relative">
          <img :src="RECHARGE_ACTIVITY.timeBg" alt="decoration" class="w-16" >
          <p class="text-2xl text-tertiary font-bold absolute inset-0 flex justify-center items-center pb-4">00</p>
        </div>
        <img :src="RECHARGE_ACTIVITY.arrowLeft" alt="decoration" class="w-16" >
      </div>

      <UTabs
          :items="items"
          class="gap-4 w-36 mx-auto mt-4"
          :ui="{
            root: 'min-w-full',
            list: 'rounded-full w-fit',
            indicator: 'bg-linear-to-b from-tertiary-600 to-tertiary-950 rounded-full',
            trigger: 'grow',
            label: 'text-white',
          }"
      >
        <template #ranking="{ item }">
          <div class="px-2 relative">
            <div class="w-3/4 mx-auto relative z-10">
              <img :src="RECHARGE_ACTIVITY.topHeader" alt="decoration" class="w-full" >
              <p class="font-bold absolute inset-0 flex items-center justify-center text-md mt-2 text-white">Recharge 10000 Coins</p>
            </div>
            <img :src="RECHARGE_ACTIVITY.taskBg" alt="decoration" class="w-full -mt-8" >
          </div>
        </template>

        <template #task="{ item }">
          <div class="p-8 bg-secondary">

          </div>
        </template>
      </UTabs>
      
    </div>

  </div>
</template>

<style scoped>

</style>