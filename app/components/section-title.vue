<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  type?: 'primary' | 'secondary' | 'tertiary'
}>(), { type: 'primary' })

// Map the variant to CSS variables (Nuxt UI exposes --ui-*)
const colorVar = computed(() => ({
  primary:  'var(--ui-primary)',
  secondary:'var(--ui-secondary)',
  tertiary: 'var(--ui-tertiary)',
}[props.type]))

// Unique gradient id per instance to avoid DOM id collisions
const gid = `paint0_${Math.random().toString(36).slice(2)}`
</script>

<template>
  <div class="flex gap-1.5 items-center">
    <svg xmlns="http://www.w3.org/2000/svg" width="6" height="24" viewBox="0 0 6 24" fill="none">
      <path d="M3 3L3 21" :stroke="`url(#${gid})`" stroke-width="5" stroke-linecap="round" />
      <defs>
        <linearGradient :id="gid" x1="3.5" y1="3" x2="3.5" y2="21" gradientUnits="userSpaceOnUse">
          <!-- top: full color -->
          <stop :stop-color="colorVar" />
          <!-- bottom: 10% opacity (like primary/10) -->
          <stop offset="1" :stop-color="colorVar" stop-opacity="0.1" />
        </linearGradient>
      </defs>
    </svg>

    <h2 class="text-base font-bold"><slot /></h2>
  </div>
</template>
