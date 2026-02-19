<script setup lang="ts">
withDefaults(defineProps<{
  imageSrc?: string
  blur?: number
}>(), {
  imageSrc: 'https://ik.imagekit.io/flylive/siteAssets/alt-hero/primary.webp',
  blur: 2
})

</script>

<template>
  <div class="relative w-full">
    <NuxtImg
        :src="imageSrc"
        format="webp"
        densities="x1 x2"
        sizes="320px"
        width="100%"
        class="min-w-full"
    />
    <div class="px-3 pt-[20vw] absolute inset-0">
      <BgGlass
          :noise-frequency="0.0001"
          :noise-strength="10"
          :frost-blur-radius="`blur(${blur}px)`"
          class="w-full border border-white/40"
      >
        <slot />
      </BgGlass>
    </div>
  </div>
</template>

<style scoped>

</style>