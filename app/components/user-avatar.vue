<script setup lang="ts">
withDefaults(defineProps<{
  frameName?: string    // SVGA name, e.g. "frames/admin/cs_leader"
  img?: string          // avatar url
  top?: number          // % for absolute center point
  left?: number         // % for absolute center point
  frameGirth?: number
  animated?: boolean
  staticSrc?: string
}>(), {
  frameName: 'frames/5',
  img: '/siteAssets/seats/default-seat.webp',
  top: 55,
  left: 50,
  frameGirth: 70,
  animated: false,
  staticSrc: 'siteAssets/frames/default-frame.webp'
});
</script>

<template>
  <div class="relative aspect-square cursor-pointer">
    <!-- Avatar Image -->
    <NuxtImg
        provider="imagekit"
        class="absolute-middle aspect-square rounded-full object-cover"
        :src="img"
        alt="avatar"
        preload
        :style="{
          top: `${top}%`,
          left: `${left}%`,
          width: `${frameGirth}%`,
        }"
    />
    <!-- Frame layer (on top) -->
    <template v-if="animated">
      <SvgaPlayer
          class="relative min-w-full z-10"
          :name="frameName"
          height="auto"
      />
    </template>

    <NuxtImg
        v-if="!animated"
        provider="imagekit"
        :src="staticSrc"
        alt="avatar"
        class="relative min-w-full z-10"
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
