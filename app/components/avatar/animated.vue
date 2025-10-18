<script setup lang="ts">
const props = withDefaults(defineProps<{
  frame?: string        // SVGA name, e.g. "frames/admin/cs_leader"
  img?: string          // avatar url
  top?: number          // % for absolute center point
  left?: number         // % for absolute center point
  frame_overflow?: number        // % frame overflow of frame around the avatar
  frame_girth?: number
}>(), {
  frame: 'frames/19',
  img: '/avatars/placeholder',
  top: 50,
  left: 50,
  frame_overflow: 160,
  frame_girth: 20
});
</script>

<template>
  <div>
    <div class="relative aspect-square mx-auto" :style="{ width: `${100 - props.frame_girth}%` }">
      <!-- Avatar Image -->
      <NuxtImg
          provider="imagekit"
          class="w-full aspect-square rounded-full object-cover"
          :src="props.img"
          alt="avatar"
      />
      <!-- Frame layer (on top) -->
      <LazySvgaPlayer
          hydrate-on-visible
          class="absolute-middle z-10 p-0 pointer-events-none"
          :name="props.frame"
          height="auto"
          :style="{
          top: `${props.top}%`,
          left: `${props.left}%`,
          width: `${props.frame_overflow}%`,
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
