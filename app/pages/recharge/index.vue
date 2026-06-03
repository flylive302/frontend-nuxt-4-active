<script setup lang="ts">
import { RECHARGE_ACTIVITY} from "~/constants/assets";
import type { TabsItem } from '@nuxt/ui'

definePageMeta({ layout: 'recharge', middleware: 'auth' });

</script>

<template>
  <div class="px-2 relative">
    <div class="w-3/4 mx-auto relative z-10">
      <img :src="RECHARGE_ACTIVITY.topHeader" alt="decoration" class="w-full" >
      <p class="font-bold absolute inset-0 flex items-center justify-center text-md mt-2 text-white">Recharge 10000 Coins</p>
    </div>
    <img :src="RECHARGE_ACTIVITY.taskBg" alt="decoration" class="w-full -mt-8" >
  </div>
</template>

<style scoped>

</style>