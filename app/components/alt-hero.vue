<script setup lang="ts">
withDefaults(defineProps<{
  imageSrc?: string
}>(), {
  imageSrc: '/siteAssets/alt-hero/primary.webp',
})

</script>

<template>
  <div class="relative">
    <NuxtImg
        provider="imagekit"
        :src="imageSrc"
        :width="380"
        format="webp"
        densities="x1 x2"
        sizes="320px"
    />
    <div class="px-3 pt-23 absolute inset-0">
      <BgGlass
          :noise-frequency="0.0001"
          :noise-strength="10"
          frost-blur-radius="blur(2px)"
          class="w-full border border-white/60"
      >
        <slot />
      </BgGlass>
    </div>
  </div>
</template>

<style scoped>

</style>