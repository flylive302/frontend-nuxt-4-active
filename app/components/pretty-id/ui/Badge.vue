<script setup lang="ts">
/**
 * The winged crown badge a Pretty ID is shown in on profiles and in rooms.
 * `width` is the badge width (any CSS length); `fontSize` sizes the number to it.
 */
const props = withDefaults(defineProps<{
  id: string
  width: string
  /** Font size of the number: px when a number, otherwise any CSS length (e.g. `14cqw`). */
  fontSize?: number | string
}>(), {
  fontSize: 26,
})

const numFontSize = computed(() => typeof props.fontSize === 'number' ? `${props.fontSize}px` : props.fontSize)
</script>

<template>
  <span class="pid-badge" :style="{ width }">
    <span class="pid-badge__num">
      <span class="pid-num pid-gold" :style="{ fontSize: numFontSize }">{{ id }}</span>
    </span>
  </span>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  .pid-badge {
    position: relative;
    display: block;
    flex: none;
    aspect-ratio: 560 / 257;
    background: var(--pid-img-badge) center / 100% 100%;
  }

  /* The purple cartouche inside the art: the wing on the right is not part of it. */
  .pid-badge__num {
    position: absolute;
    top: 30%;
    left: 6%;
    display: grid;
    place-items: center;
    width: 73%;
    height: 58%;
  }
}
</style>
