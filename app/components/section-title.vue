<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  type?: 'primary' | 'secondary' | 'tertiary'
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'   // heading tag
  height?: number                                 // bar height (px)
  strokeWidth?: number                            // bar thickness (px)
}>(), {
  type: 'primary',
  as: 'h2',
  height: 24,
  strokeWidth: 5,
})

// Map variant → gradient classes (from-* and to-* with opacity)
const gradientClasses = computed(() => {
  const base = {
    primary: 'from-primary',
    secondary: 'from-secondary',
    tertiary: 'from-tertiary',
  }[props.type] ?? 'from-primary'
  
  // Add to-* class with 10% opacity to match original SVG gradient
  const toClass = base.replace('from-', 'to-') + '/10'
  return `${base} ${toClass}`
})
</script>

<template>
  <header class="flex items-center gap-1.5">
    <aside class="h-5 w-1.5 bg-gradient-to-b rounded-full" :class="gradientClasses" />
    <p class="text-base font-bold"><slot /></p>
  </header>
</template>