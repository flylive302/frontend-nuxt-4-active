<script setup lang="ts">
withDefaults(defineProps<{
  imageSrc?: string
  blur?: number
}>(), {
  imageSrc: '/AppImages/dummy-card/bg-fl.png',
  blur: 2
})

defineOptions({
  inheritAttrs: false
});

</script>

<template>
  <div class="relative w-full">
    <NuxtImg
        :src="imageSrc"
        format="webp"
        densities="x1 x2"
        sizes="320px"
        width="100%"
        class="min-w-full aspect-rectangle object-cover"
    />
    <div class="px-3 pt-[15vw] absolute inset-0">
      <div class="flex items-center justify-center h-full border-3 border-white/5 rounded-2xl backdrop-blur-xs mt-6" v-bind="$attrs">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>