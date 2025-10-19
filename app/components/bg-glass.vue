<template>
  <div>
    <div class="liquid-glass">
      <slot />
    </div>

    <svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
      <defs>
        <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" :baseFrequency="`${props.noiseFrequency} ${props.noiseFrequency}`" numOctaves="2" seed="92" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2" result="blurred" />
          <feDisplacementMap in="SourceGraphic" in2="blurred" :scale="`${props.noiseStrength}`" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  </div>
</template>

<style scoped>
.liquid-glass {
  position: relative;
  isolation: isolate;
}

.liquid-glass:focus {
  outline: none;
}

.liquid-glass::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  backdrop-filter: v-bind(frostBlurRadius);
  -webkit-backdrop-filter: v-bind(frostBlurRadius);
  filter: url(#glass-distortion);
  -webkit-filter: url(#glass-distortion);
}
</style>
<script setup lang="ts">
  const props = withDefaults(defineProps<{
    frostBlurRadius?: string
    noiseFrequency?: number
    noiseStrength?: number
  }>(), {
  frostBlurRadius: "blur(2px)",
  noiseFrequency: 0.012,
  noiseStrength: 150,
  });
</script>