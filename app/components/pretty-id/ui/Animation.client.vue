<script setup lang="ts">
/**
 * A looping event animation (.svga) that fills its parent box. Give the parent
 * the size and `position: relative`; this fills it edge to edge.
 *
 * `poster` is a still shown underneath until the animation has parsed, then
 * faded out — the hero is 3.8 MB, so on a cold open the poster is what the
 * user sees first. If the animation fails to load, the poster simply stays.
 */
const props = defineProps<{
  /** A `PRETTY_ID_ASSETS.*Svga` constant. */
  src: string
  /** Still image shown until the animation is ready. */
  poster?: string
}>()

const { url, isReady } = usePrettyIdAnimation(() => props.src)
</script>

<template>
  <div class="absolute inset-0">
    <img
      v-if="poster"
      :src="poster"
      alt=""
      aria-hidden="true"
      class="absolute inset-0 size-full object-cover transition-opacity duration-300 motion-reduce:transition-none"
      :class="isReady ? 'opacity-0' : 'opacity-100'"
    >
    <SvgaPlayer :name="url" class="absolute inset-0" />
  </div>
</template>
