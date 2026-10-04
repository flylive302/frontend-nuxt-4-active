<script setup lang="ts">
import { RECHARGE_ACTIVITY } from '~/constants/assets'
import { RECHARGE_TABS } from '~/constants/recharge'
</script>

<template>
  <nav aria-label="Recharge mission tabs" class="flex justify-center gap-2 mb-3">
    <NuxtLink
      v-for="tab in RECHARGE_TABS"
      v-slot="{ isExactActive }"
      :key="tab.to"
      :to="tab.to"
      class="text-white font-bold text-md relative w-24 h-auto flex items-center justify-center"
    >
      <img :src="isExactActive ? RECHARGE_ACTIVITY.tabActive : RECHARGE_ACTIVITY.tab" class="w-full" alt="">
      <span class="absolute mt-2" :class="{ 'text-tertiary': isExactActive }">{{ tab.label }}</span>
    </NuxtLink>
  </nav>
</template>
