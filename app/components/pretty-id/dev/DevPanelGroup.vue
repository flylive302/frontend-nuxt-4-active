<script setup lang="ts">
/**
 * One labelled group of dev-panel levers: a small gold heading over a centred,
 * wrapping row of chips (the default slot).
 */
defineProps<{
  title: string
}>()
</script>

<template>
  <section>
    <h3 class="pid-dev-group__title">{{ title }}</h3>
    <div class="flex flex-wrap justify-center gap-1.5">
      <slot />
    </div>
  </section>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  /* Cinzel 700 / 12px / 0.08em, NOT uppercased (the prototype's `.sheet h4`):
     the headings carry live values like "Time (offset 0h)". */
  .pid-dev-group__title {
    margin: 14px 0 6px;
    color: var(--pid-gold);
    font: 700 12px var(--pid-font-num);
    letter-spacing: 0.08em;
  }
}
</style>
