<script setup lang="ts">
withDefaults(defineProps<{
  imageSrc?: string
}>(), {
  imageSrc: '/siteAssets/alt-hero/primary.webp',
})

</script>

<template>
  <div class="relative w-full">
    <NuxtImg
        provider="imagekit"
        :src="imageSrc"
        format="webp"
        densities="x1 x2"
        sizes="320px"
        width="100%"
        class="min-w-full"
        :modifiers="{ effectSharpen: 1 }"
    />
    <div class="px-3 pt-[20vw] absolute inset-0">
      <BgGlass
          :noise-frequency="0.0001"
          :noise-strength="10"
          frost-blur-radius="blur(2px)"
          class="w-full border border-white/40"
      >
        <slot />
      </BgGlass>
    </div>
  </div>
</template>

<style scoped>

</style>