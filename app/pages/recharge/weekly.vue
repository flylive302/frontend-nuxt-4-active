<script setup lang="ts">
import {ASSETS, RECHARGE_ACTIVITY} from "~/constants/assets";
import type { TabsItem } from '@nuxt/ui'

definePageMeta({ layout: 'recharge', middleware: 'auth' });

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
      <div class="relative">
        <div class="w-3/4 mx-auto relative z-10">
          <img :src="RECHARGE_ACTIVITY.topHeader" alt="decoration" class="w-full" >
          <p class="font-bold absolute inset-0 flex items-center justify-center text-md mt-2 text-white">Recharge 10000 Coins</p>
        </div>
        <div class="flex flex-col justify-center items-center relative">
          <!-- Number 1 Ranker Avatar Frame -->
          <img :src="RECHARGE_ACTIVITY.top1Fame_monthly" class="w-96 z-10" alt="">
          <!-- User's Avatar -->
          <img :src="ASSETS.AVATAR_PLACEHOLDER" class="rounded-full overflow-hidden w-23 absolute mt-11" alt="">

          <div
              class="h-[16vw] w-[26vw] bg-cover bg-center bg-no-repeat flex justify-center items-center drop-shadow-md absolute right-0 z-20 bottom-0"
              :style="{ backgroundImage: `url(${RECHARGE_ACTIVITY.btnRules})` }"
          >
            <p class="font-bold text-md text-white ml-8 pb-1">Rules</p>
          </div>
        </div>
        <img :src="RECHARGE_ACTIVITY.rankingListBg" alt="decoration" class="w-full" >
      </div>
    </template>

    <template #task="{ item }">
      <div class="p-8 bg-secondary">

      </div>
    </template>
  </UTabs>
</template>

<style scoped>

</style>