<script setup lang="ts">
/**
 * Small outlined pill (e.g. the Choose tab's length filter).
 *
 * Pass `active` only for a chip that is a toggle (a filter, a lever): it paints
 * the selected gold state and announces `aria-pressed`. Leave it out for a plain
 * action chip, which must not be announced as an unpressed toggle.
 */
withDefaults(defineProps<{
  active?: boolean
}>(), {
  // Explicit `undefined` stops Vue casting an absent boolean prop to `false`.
  active: undefined,
})
</script>

<template>
  <button type="button" class="pid-chip" :class="{ 'pid-chip--on': active }" :aria-pressed="active">
    <slot />
  </button>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  .pid-chip {
    padding: 6px 12px;
    border: 1.5px solid var(--pid-line);
    border-radius: 16px;
    background: var(--pid-surface);
    color: var(--pid-text);
    font: 600 12px var(--pid-font-body);
    cursor: pointer;
  }

  .pid-chip--on {
    border-color: var(--pid-gold);
    background: var(--pid-surface-on);
    color: var(--pid-gold-pale);
  }

  .pid-chip:focus-visible {
    outline: 2px solid var(--pid-gold);
    outline-offset: 2px;
  }
}
</style>
