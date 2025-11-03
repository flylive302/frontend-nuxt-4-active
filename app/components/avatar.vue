<script setup lang="ts">
const props = withDefaults(defineProps<{
  frameName?: string        // SVGA name, e.g. "frames/admin/cs_leader"
  img?: string          // avatar url
  top?: number          // % for absolute center point
  left?: number         // % for absolute center point
  frameGirth?: number
  animated?: boolean
  staticSrc?: string
}>(), {
  frameName: 'frames/5',
  img: '/avatars/placeholder',
  top: 55,
  left: 50,
  frameGirth: 70,
  animated: false,
  staticSrc: 'siteAssets/frames/ladies-frame.webp'
});
</script>

<template>
  <div>
    <div class="relative aspect-square cursor-pointer">
      <!-- Avatar Image -->
      <NuxtImg
          provider="imagekit"
          class="absolute-middle aspect-square rounded-full object-cover"
          :src="props.img"
          alt="avatar"
          preload
          :style="{
            top: `${props.top}%`,
            left: `${props.left}%`,
            width: `${props.frameGirth}%`,
          }"
      />
      <!-- Frame layer (on top) -->
      <LazySvgaPlayer
          v-if="animated"
          hydrate-on-visible
          class="relative min-w-full z-10"
          :name="props.frameName"
          height="auto"
      />

      <NuxtImg
          v-else
          provider="imagekit"
          :src="props.staticSrc"
          alt="avatar"
          class="relative min-w-full z-10"
          height="auto"
      />
    </div>
  </div>
</template>

<style scoped>
.absolute-middle {
  position: absolute;
  transform: translate(-50%, -50%);
}
</style>
