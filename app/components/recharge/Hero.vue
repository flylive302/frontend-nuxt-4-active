<script setup lang="ts">
/**
 * Static top chrome of the recharge layout: back button, banner, Honor Wall /
 * Rules buttons. No reactive inputs → renders once and never redraws.
 */
import { RECHARGE_ACTIVITY } from '~/constants/assets'

defineEmits<{
  (e: 'honor-wall'): void
}>()
</script>

<template>
  <div>
    <UButton
      icon="i-lucide-chevron-left"
      size="md"
      variant="subtle"
      to="/"
      color="tertiary"
      aria-label="Back"
      class="rounded-lg text-primary absolute top-[calc(0.5rem+env(safe-area-inset-top,0))] left-4"
    />
    <img :src="RECHARGE_ACTIVITY.banner" alt="recharge activity" class="w-full">

    <div class="flex justify-between items-center -mt-36">
      <button
        type="button"
        class="size-[28vw] ml-3 bg-cover bg-center bg-no-repeat flex justify-center items-end drop-shadow-md"
        :style="{ backgroundImage: `url(${RECHARGE_ACTIVITY.honerBtn})` }"
        @click="$emit('honor-wall')"
      >
        <span class="font-bold text-sm text-white pb-6">Honor Wall</span>
      </button>

      <!-- Rules has no action yet (same as before — the old <div> had no handler). -->
      <button
        type="button"
        class="h-[16vw] w-[26vw] bg-cover bg-center bg-no-repeat flex justify-center items-center drop-shadow-md"
        :style="{ backgroundImage: `url(${RECHARGE_ACTIVITY.btnRules})` }"
      >
        <span class="font-bold text-md text-white ml-8 pb-1">Rules</span>
      </button>
    </div>
  </div>
</template>
