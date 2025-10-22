<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  // visual controls
  frostBlurRadius?: string
  noiseFrequency?: number
  noiseStrength?: number
  rounded?: string              // Tailwind radius class
  enableDistortion?: boolean    // allows a "lite" mode

  // semantics
  as?: keyof HTMLElementTagNameMap
}>(), {
  frostBlurRadius: 'blur(4px)',
  noiseFrequency: 0.006,
  noiseStrength: 120,
  rounded: 'rounded-xl',
  enableDistortion: true,
  as: 'div',
})

// unique filter id per instance -> no cross-instance collisions
const filterId = `glass-${Math.random().toString(36).slice(2)}`
const filterRef = computed(() => `url(#${filterId})`)
</script>

<template>
  <!-- Apply the same radius on the host; CSS inherits it to ::after -->
  <component
      :is="props.as"
      class="glass focus-within:outline-none focus-within:ring-2 focus-within:ring-inset focus-within:ring-white/20"
      :class="props.rounded"
      :style="{ '--frost-blur': props.frostBlurRadius }"
  >
    <slot />

    <!-- Per-instance filter defs; hidden from a11y -->
    <svg aria-hidden="true" class="absolute h-0 w-0">
      <defs>
        <filter :id="filterId" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence
              v-if="props.enableDistortion"
              type="fractalNoise"
              :baseFrequency="`${props.noiseFrequency} ${props.noiseFrequency}`"
              numOctaves="2"
              seed="92"
              result="noise"
          />
          <feGaussianBlur
              v-if="props.enableDistortion"
              in="noise"
              stdDeviation="2"
              result="blurred"
          />
          <feDisplacementMap
              v-if="props.enableDistortion"
              in="SourceGraphic"
              in2="blurred"
              :scale="`${props.noiseStrength}`"
              xChannelSelector="R"
              yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  </component>
</template>

<style scoped>
.glass {
  position: relative;
  overflow: hidden;     /* clipping for ::after */
  isolation: isolate;
  contain: paint;       /* fixes Chrome/WebKit backdrop bleed */
}

/* Paint layer — inherits radius from host */
.glass::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  pointer-events: none;               /* never block clicks */
  backdrop-filter: var(--frost-blur);
  -webkit-backdrop-filter: var(--frost-blur);
  filter: v-bind('filterRef');        /* per-instance SVG filter */
}

/* Ensure slotted content sits above paint layer */
.glass > * {
  position: relative;
  z-index: 1;
}

/* Fallbacks: no backdrop-filter support */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass::after {
    /* Tokenize this color if you have a design token set */
    background: color-mix(in oklab, canvas, canvasText 12%);
    filter: none;
  }
}

/* Respect reduced transparency preference */
@media (prefers-reduced-transparency: reduce) {
  .glass::after {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: color-mix(in oklab, canvas, canvasText 10%);
    filter: none;
  }
}
</style>
