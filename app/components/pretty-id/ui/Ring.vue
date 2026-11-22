<script setup lang="ts">
/**
 * Avatar inside the event's gold ring. The ring art overhangs the photo, so
 * `size` is the OUTER (ring) diameter in px; the photo fills the inner 80%.
 */
import { ASSETS } from '~/constants/assets'

const props = defineProps<{
  /** Avatar URL; `null` falls back to the app's avatar placeholder. */
  src: string | null
  size: number
}>()

const avatarSrc = computed(() => props.src || ASSETS.AVATAR_PLACEHOLDER)
const boxStyle = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }))
</script>

<template>
  <span class="pid-ring" :style="boxStyle">
    <img class="pid-ring__photo" :src="avatarSrc" alt="" loading="lazy" decoding="async">
  </span>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  .pid-ring {
    position: relative;
    display: inline-block;
    flex: none;
  }

  .pid-ring__photo {
    position: absolute;
    top: 10%;
    left: 10%;
    width: 80%;
    height: 80%;
    border-radius: 50%;
    object-fit: cover;
  }

  .pid-ring::after {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--pid-img-ring) center / contain no-repeat;
  }
}
</style>
