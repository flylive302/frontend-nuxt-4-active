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

// Map variant → design tokens (Nuxt UI v4 exposes --ui-*)
const colorVar = computed(() => ({
  primary:  'var(--ui-primary)',
  secondary:'var(--ui-secondary)',
  tertiary: 'var(--ui-tertiary)',
}[props.type] ?? 'currentColor'))

// Unique gradient id per instance (SPA-safe). If you enable SSR later,
// consider using Vue's useId() for deterministic hydration.
const gid = (() => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `g-${crypto.randomUUID()}`
  return `g-${Math.random().toString(36).slice(2)}`
})()

// For the SVG sizing attrs
const viewBox = computed(() => `0 0 6 ${props.height}`)
const y2 = computed(() => String(props.height - 3))   // keep same top/bottom padding as original
</script>

<template>
  <div class="flex items-center gap-1.5">
    <svg
        xmlns="http://www.w3.org/2000/svg"
        :width="6"
        :height="height"
        :viewBox="viewBox"
        fill="none"
        aria-hidden="true"
        focusable="false"
        class="shrink-0"
    >
      <path
          d="M3 3L3 21"
          :d="`M3 3L3 ${height - 3}`"
          :stroke="`url(#${gid})`"
          :stroke-width="strokeWidth"
          stroke-linecap="round"
          vector-effect="non-scaling-stroke"
      />
      <defs>
        <linearGradient
            :id="gid"
            x1="3.5"
            y1="3"
            x2="3.5"
            :y2="y2"
            gradientUnits="userSpaceOnUse"
        >
          <!-- top: full color -->
          <stop :stop-color="colorVar" offset="0" />
          <!-- bottom: ~10% opacity -->
          <stop :stop-color="colorVar" :stop-opacity="0.1" offset="1" />
        </linearGradient>
      </defs>
    </svg>

    <component :is="as" class="text-base font-bold">
      <slot />
    </component>
  </div>
</template>

<style scoped>
/* Tailwind handles spacing/typography; no extra CSS needed */
</style>
