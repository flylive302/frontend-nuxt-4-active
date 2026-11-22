<script setup lang="ts">
/**
 * Small gold plaque that holds a rare ID number inline (winner cards, weekly
 * rows, auction holdings).
 */
</script>

<template>
  <span class="pid-plate">
    <slot />
  </span>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  .pid-plate {
    display: inline-grid;
    place-items: center;
    min-width: 70px;
    padding: 4px 22px 2px;
    background: var(--pid-img-plaque) center / 100% 100%;
  }
}
</style>
