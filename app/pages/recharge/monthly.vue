<script setup lang="ts">
import { RECHARGE_ACTIVITY} from "~/constants/assets";
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
</template>

<style scoped>

</style>