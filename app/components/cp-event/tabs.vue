<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
import { CP_EVENT_TABS } from '~/constants/cp-event'
</script>

<template>
  <!-- `relative` keeps the row painting above the hero it overlaps (countdown's -mt-20). -->
  <nav aria-label="CP event tabs" class="relative flex justify-center gap-2 p-4">
    <NuxtLink
      v-for="tab in CP_EVENT_TABS"
      v-slot="{ isExactActive }"
      :key="tab.to"
      :to="tab.to"
      class="relative w-full"
    >
      <img :src="isExactActive ? ASSETS.CP_FERRIS_TAB_ACTIVE : ASSETS.CP_FERRIS_TAB" class="w-full" alt="">
      <p
        class="absolute inset-0 -mt-1 flex items-center justify-center text-md font-bold"
        :class="isExactActive ? 'text-black' : 'text-white'"
      >
        {{ tab.label }}
      </p>
    </NuxtLink>
  </nav>
</template>
