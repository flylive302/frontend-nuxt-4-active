<script setup lang="ts">
const props = withDefaults(defineProps<{
  frameName?: string
  img?: string | undefined | null
  animated?: boolean
}>(), {
  frameName: '',
  img: undefined,
  animated: false,
});

// Use computed for performance (caching) and reactivity.
// Without computed/ref, values won't update when props change.
const frameConfig = computed(() => {
  const parts = props.frameName?.split('-') ?? []

  // Custom format: name-girth-padding-top-left
  if (parts.length === 5) {
    const [name, girth, padd, top, left] = parts
    return {
      name: name || 'frames/5',
      padding: `${padd}%`,
      style: {
        // Fix scaling: convert string to number before division
        transform: `scale(${+(girth || 100) / 100})`,
        top: top || '0%',
        left: left || '0%'
      }
    }
  }

  // Fallback defaults
  return {
    name: 'frames/5',
    padding: '16%',
    style: {
      transform: `scale(${+(110) / 100})`,
      top: '0%',
      left: '0%'
    }
  }
})
</script>

<template>
  <div class="relative aspect-square cursor-pointer">
    <div class="relative" :style="{ padding: frameConfig.padding }">
      <!-- Avatar Image -->
      <NuxtImg
        class="aspect-square rounded-full object-contain w-full"
        :src="props.img ?? 'https://ik.imagekit.io/flylive/siteAssets/seats/default-seat.webp'" alt="avatar"
        :width="96"
        :height="96"
        format="webp"
        densities="x1 x2"
        sizes="96px"
        loading="lazy"
      />
      <!-- Frame layer (on top) -->
      <SvgaPlayer
        v-if="props.animated && frameConfig.name"
        class="absolute" height="auto"
        :name="frameConfig.name"
        :style="frameConfig.style"
      />
    </div>
  </div>
</template>
