<script setup lang="ts">
withDefaults(defineProps<{
  coins?: number
  price?: number
}>(), {
  coins: 1700,
  price: 0.99,
})
</script>

<template>
  <div class="border-2 border-tertiary px-2 py-1 flex justify-between items-center rounded-md bg-gradient-to-br from-tertiary/5 to-tertiary/40">
    <NuxtImg provider="imagekit" src="/siteAssets/props/flylive_coin.webp" class="w-8" />
    <h2 class="text-lg font-bold w-full pl-2 leading-none">{{ coins }}</h2>
    <UButton :label="`${price}`" icon="i-lucide-dollar-sign" variant="subtle" :color="('tertiary' as any)" class="min-w-20" />
  </div>
</template>

<style scoped>

</style>