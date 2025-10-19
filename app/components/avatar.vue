<script setup lang="ts">
const props = withDefaults(defineProps<{
  frame_name?: string        // SVGA name, e.g. "frames/admin/cs_leader"
  img?: string          // avatar url
  top?: number          // % for absolute center point
  left?: number         // % for absolute center point
  frame_overflow?: number        // % frame overflow of frame around the avatar
  frame_girth?: number
  animated?: boolean
  static_src?: string
}>(), {
  frame_name: 'frames/5',
  img: '/avatars/placeholder',
  top: 50,
  left: 50,
  frame_overflow: 150,
  frame_girth: 20,
  animated: false,
  static_src: 'siteAssets/frames/ladies-frame.webp'
});
</script>

<template>
  <div>
    <div class="relative aspect-square mx-auto cursor-pointer" :style="{ width: `${100 - props.frame_girth}%` }">
      <!-- Avatar Image -->
      <NuxtImg
          provider="imagekit"
          class="w-full aspect-square rounded-full object-cover"
          :src="props.img"
          alt="avatar"
      />
      <!-- Frame layer (on top) -->
      <LazySvgaPlayer
          v-if="animated"
          hydrate-on-visible
          class="absolute-middle z-10"
          :name="props.frame_name"
          height="auto"
          :style="{
            top: `${props.top}%`,
            left: `${props.left}%`,
            width: `${props.frame_overflow}%`,
          }"
      />

      <NuxtImg
          v-else
          provider="imagekit"
          :src="props.static_src"
          alt="avatar"
          class="absolute-middle z-10"
          height="auto"
          :style="{
            top: `${props.top}%`,
            left: `${props.left}%`,
            minWidth: `${props.frame_overflow}%`,
          }"
      />
    </div>
  </div>
</template>

<style scoped>
.absolute-middle {
  position: absolute;
  transform: translate(-50%, -50%); /* center by top/left */
}
</style>
