<script setup lang="ts">
import { RECHARGE_ACTIVITY} from "~/constants/assets";
</script>

<template>
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
</template>

<style scoped>

</style>