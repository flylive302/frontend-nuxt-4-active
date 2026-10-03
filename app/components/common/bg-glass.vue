<script setup lang="ts">
// Flat translucent surface. Was a frosted/"liquid glass" panel (backdrop-filter
// blur + per-instance SVG turbulence/displacement filter); both are GPU-heavy
// and are banned app-wide since android-anr-regression 01 (ANRs on low-end
// Android WebViews waiting on the GPU). Keep the look flat: translucent dark
// fill, no backdrop-filter, no filter.

const props = withDefaults(defineProps<{
  rounded?: string              // Tailwind radius class
  as?: keyof HTMLElementTagNameMap
}>(), {
  rounded: 'rounded-xl',
  as: 'div',
})
</script>

<template>
  <component
      :is="props.as"
      class="bg-neutral-950/70 focus-within:outline-none focus-within:ring-2 focus-within:ring-inset focus-within:ring-white/20"
      :class="props.rounded"
  >
    <slot />
  </component>
</template>
