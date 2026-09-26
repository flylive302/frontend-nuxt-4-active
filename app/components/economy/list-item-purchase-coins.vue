<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
withDefaults(defineProps<{
  coins?: number
  price?: number
}>(), {
  coins: 1700,
  price: 0.99,
})
</script>

<template>
  <div class="px-2 py-1 flex justify-between items-center rounded-md bg-tertiary/10">
    <img :src="ASSETS.COIN_ICON" alt="" class="w-8">
    <h2 class="text-lg font-bold w-full pl-2 leading-none">{{ coins }}</h2>
    <UButton :label="`${price}`" icon="i-lucide-dollar-sign" variant="subtle" color="tertiary" class="min-w-20" />
  </div>
</template>

<style scoped>

</style>