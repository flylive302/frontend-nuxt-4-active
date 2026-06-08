<script setup lang="ts">
import { RECHARGE_ACTIVITY} from "~/constants/assets";
definePageMeta({ middleware: 'auth' });

const route = useRoute()

const honorWallOpen = ref(false)
</script>

<template>
  <div class="w-full relative min-h-screen bg-[#381f11] pb-16">
    <UButton
        icon="i-lucide-chevron-left"
        size="md"
        variant="subtle"
        to="/"
        color="tertiary"
        class="rounded-lg backdrop-blur-sm text-primary absolute top-2 left-4"
    />
    <img :src="RECHARGE_ACTIVITY.banner" alt="recharge activity" class="w-full" />

    <div class="flex justify-between items-center -mt-36">
      <div
          class="size-[28vw] ml-3 bg-cover bg-center bg-no-repeat flex justify-center items-end drop-shadow-md"
          :style="{ backgroundImage: `url(${RECHARGE_ACTIVITY.honerBtn})` }"
          @click="honorWallOpen = true"
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

      <div class="flex justify-center gap-2 mb-3">
        <NuxtLink to="/recharge" class="text-white font-bold text-md relative w-24 h-auto flex items-center justify-center">
          <img :src="route.path === '/recharge' ? RECHARGE_ACTIVITY.tabActive : RECHARGE_ACTIVITY.tab" class="w-full" alt="decoration">
          <span :class="{'text-tertiary' : route.path === '/recharge'}" class="absolute mt-2">Daily</span>
        </NuxtLink>

        <NuxtLink to="/recharge/weekly" class="text-white font-bold text-md relative w-24 h-auto flex items-center justify-center">
          <img :src="route.path === '/recharge/weekly' ? RECHARGE_ACTIVITY.tabActive : RECHARGE_ACTIVITY.tab" class="w-full" alt="decoration">
          <span :class="{'text-tertiary' : route.path === '/recharge/weekly'}" class="absolute mt-2">Weekly</span>
        </NuxtLink>

        <NuxtLink to="/recharge/monthly" class="text-white font-bold text-md relative w-24 h-auto flex items-center justify-center">
          <img :src="route.path === '/recharge/monthly' ? RECHARGE_ACTIVITY.tabActive : RECHARGE_ACTIVITY.tab" class="w-full" alt="decoration">
          <span :class="{'text-tertiary' : route.path === '/recharge/monthly'}" class="absolute mt-2">Monthly</span>
        </NuxtLink>
      </div>

      <slot></slot>

      <!-- Modals -->
      <RechargeHonorWallModal
          :open="honorWallOpen"
          @close="honorWallOpen = false"
      />
    </div>

  </div>
</template>

<style scoped>

</style>