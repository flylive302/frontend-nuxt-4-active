<script setup lang="ts">
import { computed } from 'vue'
import { ACCENT_GRADIENT_CLASS, type AccentColor } from '~/utils/color-classes'

const props = withDefaults(defineProps<{
  type?: AccentColor
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'   // heading tag
  height?: number                                 // bar height (px)
  strokeWidth?: number                            // bar thickness (px)
}>(), {
  type: 'primary',
  as: 'h2',
  height: 24,
  strokeWidth: 5,
})

// Literal lookup — Tailwind v4 never generates a class built at runtime
// (see gotchas/frontend.md); the map lives in utils/color-classes.ts so the
// unit test can guard it.
const gradientClasses = computed(() => ACCENT_GRADIENT_CLASS[props.type] ?? ACCENT_GRADIENT_CLASS.primary)
</script>

<template>
  <header class="flex items-center gap-1.5">
    <aside class="h-5 w-1.5 bg-gradient-to-b rounded-full" :class="gradientClasses" />
    <p class="text-base font-bold"><slot /></p>
  </header>
</template>