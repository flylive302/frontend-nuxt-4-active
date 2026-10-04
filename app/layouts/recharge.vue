<script setup lang="ts">
import { RECHARGE_ACTIVITY } from '~/constants/assets'

const honorWallOpen = ref(false)
</script>

<template>
  <div class="w-full relative min-h-screen bg-[#381f11] pb-16">
    <!-- .recharge-shell / .recharge-tabs are pinned during sibling-tab View
         Transitions (main.css, data-nav-shell="recharge"): they hold still while
         only the <slot/> content slides. The pattern strip below runs behind the
         content too, so it stays with the root and slides with it. -->
    <RechargeHero class="recharge-shell" @honor-wall="honorWallOpen = true" />

    <div class="h-full bg-contain bg-no-repeat w-full pt-10" :style="{ backgroundImage: `url(${RECHARGE_ACTIVITY.pattern})` }">
      <RechargeTabs class="recharge-tabs" />

      <slot />
    </div>

    <RechargeHonorWallModal :open="honorWallOpen" @close="honorWallOpen = false" />
  </div>
</template>
