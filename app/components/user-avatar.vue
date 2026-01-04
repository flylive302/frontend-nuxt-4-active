<script setup lang="ts">
const props = withDefaults(defineProps<{
  frameName?: string    // SVGA name, e.g. "frames/admin/cs_leader"
  img?: string          // avatar url
  top?: number          // % for absolute center point
  left?: number         // % for absolute center point
  frameGirth?: number
  animated?: boolean
  staticSrc?: string
  lazy?: boolean        // Enable lazy loading (default: true for performance)
}>(), {
  frameName: 'frames/5',
  img: 'https://ik.imagekit.io/flylive/siteAssets/seats/default-seat.webp',
  top: 55,
  left: 50,
  frameGirth: 70,
  animated: false,
  staticSrc: 'siteAssets/frames/default-frame.webp',
  lazy: true,
});
</script>

<template>
  <div class="relative aspect-square cursor-pointer">
    <!-- Avatar Image -->
    <NuxtImg
        class="absolute-middle aspect-square rounded-full object-contain"
        :src="props.img"
        alt="avatar"
        :loading="lazy ? 'lazy' : 'eager'"
        :style="{
          top: `${props.top}%`,
          left: `${props.left}%`,
          width: `${props.frameGirth}%`
        }"
    />
    <!-- Frame layer (on top) -->
    <SvgaPlayer
        v-if="props.animated && props.frameName"
        class="relative min-w-full z-10"
        :name="props.frameName"
        height="auto"
    />
  </div>
</template>

<style scoped>
.absolute-middle {
  position: absolute;
  transform: translate(-50%, -50%);
}
</style>
